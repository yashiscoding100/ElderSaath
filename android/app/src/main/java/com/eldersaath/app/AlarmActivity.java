package com.eldersaath.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class AlarmActivity extends Activity {
    private static final String TAG = "AlarmActivity";
    public static volatile AlarmActivity currentInstance = null;

    private MediaPlayer mediaPlayer;
    private MediaPlayer specialNoticePlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private Handler autoSnoozeHandler;
    private Runnable autoSnoozeRunnable;
    private volatile boolean alarmHandled = false;

    private long currentTriggerNonce = 0L;
    private long intentGeneration = 0L;
    private long ringStartElapsed = 0L;
    private volatile boolean currentAutoSnoozeEnabled = false;
    private volatile int currentAutoSnoozeAfterSeconds = 60;
    private volatile int currentSnoozeDuration = 10;
    private volatile String currentSnoozeText = "Take later";
    private String currentElderId = "";
    private boolean currentIsEmergencySos = false;
    private Button currentSnoozeBtn = null;
    private TextView currentAutoSnoozeStatusView = null;
    private Runnable currentPerformSnoozeAction = null;

    private void cancelAutoSnoozeTimer() {
        try {
            if (autoSnoozeHandler != null && autoSnoozeRunnable != null) {
                autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable);
            }
        } catch (Exception ignored) {}
    }

    public static void stopCurrentAlarm(Context context) {
        try {
            if (currentInstance != null) {
                currentInstance.alarmHandled = true;
                currentInstance.cancelAutoSnoozeTimer();
                currentInstance.stopAlarmAndSound();
                currentInstance.stopSpecialNoticeAudio();
                currentInstance.finish();
                currentInstance = null;
            }
            if (context != null) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancelAll();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in stopCurrentAlarm", e);
        }
    }

    public static void stopActiveAlarmSound(Context context) {
        try {
            if (currentInstance != null) {
                currentInstance.alarmHandled = true;
                currentInstance.cancelAutoSnoozeTimer();
                currentInstance.stopAlarmAndSound();
                currentInstance.stopSpecialNoticeAudio();
                currentInstance.finish();
                currentInstance = null;
            }
            if (context != null) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(99999);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "stopActiveAlarmSound warning", e);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;

        // 1. Force Screen ON and Show Over Lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent newIntent) {
        super.onNewIntent(newIntent);
        currentInstance = this;
        if (newIntent == null) return;

        long newNonce = newIntent.getLongExtra("triggerNonce", 0L);
        if (!alarmHandled && newNonce != 0L && newNonce == currentTriggerNonce) {
            Log.d(TAG, "Ignoring duplicate re-delivery for same alarm triggerNonce=" + newNonce);
            return;
        }

        Log.i(TAG, "onNewIntent received for AlarmActivity (newNonce=" + newNonce + ", prevNonce=" + currentTriggerNonce + ") - resetting alarm state");
        cancelAutoSnoozeTimer();
        stopAlarmAndSound();
        stopSpecialNoticeAudio();
        setIntent(newIntent);
        handleAlarmIntent(newIntent);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null) {
            finish();
            return;
        }

        intentGeneration++;
        final long myGeneration = intentGeneration;
        alarmHandled = false;
        currentTriggerNonce = intent.getLongExtra("triggerNonce", 0L);
        ringStartElapsed = SystemClock.elapsedRealtime();

        // 2. Extract Alarm Details & Stored On-Device Settings
        final boolean isSnooze = intent.getBooleanExtra("isSnooze", false);
        final boolean isLocalAlarm = intent.getBooleanExtra("isLocalAlarm", false);

        String elderId = intent.getStringExtra("elderId");
        if (elderId == null || elderId.isEmpty()) {
            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            elderId = prefs.getString("elder_id", "");
        }
        currentElderId = elderId != null ? elderId : "";

        String actionText = intent.getStringExtra("actionText");
        if (actionText == null || actionText.isEmpty()) actionText = "TAKE MEDICINE / STOP ALARM";

        String label = intent.getStringExtra("label");
        if (label == null) label = "EMERGENCY ALARM!";

        String body = intent.getStringExtra("body");
        if (body == null) body = "Please take your medications on time.";

        String alarmType = intent.getStringExtra("type");
        String medicationId = intent.getStringExtra("medicationId");
        JSONObject cachedMed = AlarmScheduler.getMedicationFromCache(this, medicationId, label);
        if ((medicationId == null || medicationId.isEmpty()) && cachedMed != null) {
            medicationId = cachedMed.optString("id", "");
            if (alarmType == null || "ALARM".equalsIgnoreCase(alarmType)) {
                String cachedType = cachedMed.optString("type", "MEDICATION");
                if (!cachedType.isEmpty()) alarmType = cachedType;
            }
        }

        final String finalMedicationId = medicationId;
        final String finalElderId = elderId;
        final String finalAlarmType = alarmType != null ? alarmType : "MEDICATION";

        // For snoozed or locally scheduled alarms, ALWAYS read live preferences from SharedPreferences
        // so updates made after an alarm was scheduled or snoozed take effect immediately.
        boolean useLivePrefs = isSnooze || isLocalAlarm;

        String snoozeText = useLivePrefs ? null : intent.getStringExtra("snoozeText");
        if (snoozeText == null || snoozeText.isEmpty()) {
            snoozeText = AlarmScheduler.getChildSnoozeText(this, elderId, finalAlarmType);
        }

        int parsedSnooze = AlarmScheduler.getChildSnoozeDuration(this, elderId);
        if (!useLivePrefs) {
            try {
                if (intent.hasExtra("snoozeDuration") && intent.getExtras() != null) {
                    Object obj = intent.getExtras().get("snoozeDuration");
                    if (obj instanceof Integer) {
                        parsedSnooze = (Integer) obj;
                    } else if (obj instanceof String) {
                        parsedSnooze = Integer.parseInt((String) obj);
                    }
                }
            } catch (Exception ignored) {}
        }
        currentSnoozeDuration = Math.max(1, parsedSnooze);
        currentSnoozeText = snoozeText;

        currentAutoSnoozeEnabled = (!useLivePrefs && intent.hasExtra("autoSnoozeEnabled"))
            ? intent.getBooleanExtra("autoSnoozeEnabled", false)
            : AlarmScheduler.isAutoSnoozeEnabled(this, elderId);
        currentAutoSnoozeAfterSeconds = Math.max(5, (!useLivePrefs && intent.hasExtra("autoSnoozeAfterSeconds"))
            ? intent.getIntExtra("autoSnoozeAfterSeconds", 60)
            : AlarmScheduler.getAutoSnoozeAfterSeconds(this, elderId));

        final String alarmButtonOrder = AlarmScheduler.sanitizeButtonOrder(
            (!useLivePrefs && intent.hasExtra("alarmButtonOrder"))
                ? intent.getStringExtra("alarmButtonOrder")
                : AlarmScheduler.getAlarmButtonOrder(this, elderId)
        );
        final String alarmTakeBtnColor = AlarmScheduler.sanitizeHexColor(
            (!useLivePrefs && intent.hasExtra("alarmTakeBtnColor"))
                ? intent.getStringExtra("alarmTakeBtnColor")
                : AlarmScheduler.getAlarmTakeBtnColor(this, elderId),
            AlarmScheduler.DEFAULT_TAKE_BTN_COLOR
        );
        final String alarmSnoozeBtnColor = AlarmScheduler.sanitizeHexColor(
            (!useLivePrefs && intent.hasExtra("alarmSnoozeBtnColor"))
                ? intent.getStringExtra("alarmSnoozeBtnColor")
                : AlarmScheduler.getAlarmSnoozeBtnColor(this, elderId),
            AlarmScheduler.DEFAULT_SNOOZE_BTN_COLOR
        );

        // 3. CPU WakeLock for duration of alarm + auto-snooze countdown
        refreshWakeLockForAutoSnooze();

        // 4. Set Clean, Responsive XML Layout
        setContentView(R.layout.activity_alarm);

        final LinearLayout layoutAlarmControls = findViewById(R.id.layoutAlarmControls);
        final LinearLayout layoutSpecialNotice = findViewById(R.id.layoutSpecialNotice);
        final TextView tvSpecialNoticeCounter = findViewById(R.id.tvSpecialNoticeCounter);
        final TextView tvSpecialNoticeMed = findViewById(R.id.tvSpecialNoticeMed);
        final LinearLayout layoutNoticeTextBox = findViewById(R.id.layoutNoticeTextBox);
        final TextView tvSpecialNoticeText = findViewById(R.id.tvSpecialNoticeText);
        final LinearLayout layoutNoticeVoiceBox = findViewById(R.id.layoutNoticeVoiceBox);
        final TextView tvSpecialNoticeVoiceStatus = findViewById(R.id.tvSpecialNoticeVoiceStatus);
        final Button btnReplaySpecialNotice = findViewById(R.id.btnReplaySpecialNotice);
        final Button btnCloseSpecialNotice = findViewById(R.id.btnCloseSpecialNotice);

        TextView alertBadge = findViewById(R.id.tvAlarmBadge);
        TextView iconView = findViewById(R.id.tvAlarmIcon);
        TextView titleView = findViewById(R.id.tvAlarmTitle);
        TextView bodyView = findViewById(R.id.tvAlarmBody);
        Button stopBtn = findViewById(R.id.btnStopAlarm);
        Button snoozeBtn = findViewById(R.id.btnSnoozeAlarm);
        LinearLayout layoutAlarmButtonsInner = findViewById(R.id.layoutAlarmButtonsInner);
        final TextView autoSnoozeStatusView = findViewById(R.id.tvAutoSnoozeStatus);

        currentSnoozeBtn = snoozeBtn;
        currentAutoSnoozeStatusView = autoSnoozeStatusView;
        currentIsEmergencySos = label.contains("EMERGENCY SOS") || "EMERGENCY_SOS".equalsIgnoreCase(finalAlarmType);

        if (label.contains("SOS") || label.contains("EMERGENCY")) {
            iconView.setText("🚨");
            alertBadge.setText("🚨 EMERGENCY SOS ACTIVE!");
        } else if ("TASK".equalsIgnoreCase(finalAlarmType) || label.toLowerCase().startsWith("task")) {
            iconView.setText("📋");
            alertBadge.setText("📋 SCHEDULED TASK REMINDER");
        } else {
            iconView.setText("⏰");
            alertBadge.setText("⏰ MEDICATION REMINDER");
        }

        titleView.setText(label);
        bodyView.setText(body);
        stopBtn.setText(actionText.toUpperCase());

        String displaySnooze = currentSnoozeText;
        if (!displaySnooze.toLowerCase().contains("min") && !displaySnooze.toLowerCase().contains("m)")) {
            displaySnooze = displaySnooze + " (" + currentSnoozeDuration + " mins)";
        }
        snoozeBtn.setText(displaySnooze);

        boolean isSosUiLock = label.contains("EMERGENCY SOS") || label.contains("SOS") || "EMERGENCY_SOS".equalsIgnoreCase(finalAlarmType);
        if (!isSosUiLock) {
            applyCustomAlarmButtonUi(
                layoutAlarmButtonsInner,
                stopBtn,
                snoozeBtn,
                alarmButtonOrder,
                alarmTakeBtnColor,
                alarmSnoozeBtnColor
            );
        }

        final String finalActionText = actionText;
        final String finalLabel = label;
        final String finalBody = body;

        final Runnable performSnoozeAction = new Runnable() {
            @Override
            public void run() {
                if (alarmHandled) return;
                alarmHandled = true;
                cancelAutoSnoozeTimer();
                stopAlarmAndSound();

                boolean triggeredAutomatically = "AUTO".equals(autoSnoozeStatusView.getTag());
                int activeSnoozeMinutes = Math.max(1, currentSnoozeDuration);

                // Notify caregiver server in background that snooze was triggered
                notifySnoozeToServer(AlarmActivity.this, finalElderId, triggeredAutomatically);

                // Route snooze alarm through LocalAlarmReceiver using setAlarmClock
                // Never freeze mutable preferences (autoSnooze, button colors/order, snoozeDuration) into PendingIntent extras
                // so changes made while snoozed apply immediately when the snoozed alarm wakes up.
                Intent snoozeIntent = new Intent(AlarmActivity.this, LocalAlarmReceiver.class);
                snoozeIntent.setAction(LocalAlarmReceiver.ACTION_SNOOZE_ALARM);
                snoozeIntent.putExtra("isSnooze", true);
                snoozeIntent.putExtra("actionText", finalActionText);
                snoozeIntent.putExtra("label", finalLabel);
                snoozeIntent.putExtra("body", finalBody);
                snoozeIntent.putExtra("medicationId", finalMedicationId);
                snoozeIntent.putExtra("name", finalLabel);
                snoozeIntent.putExtra("type", finalAlarmType);
                if (finalElderId != null) snoozeIntent.putExtra("elderId", finalElderId);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

                int reqCode = 200000 + (int) (System.currentTimeMillis() % 100000);
                PendingIntent pi = PendingIntent.getBroadcast(AlarmActivity.this, reqCode, snoozeIntent, flags);

                Intent showIntent = new Intent(AlarmActivity.this, MainActivity.class);
                PendingIntent showPi = PendingIntent.getActivity(AlarmActivity.this, reqCode, showIntent, flags);

                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                long triggerAt = System.currentTimeMillis() + (activeSnoozeMinutes * 60 * 1000L);

                if (am != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAt, showPi);
                        am.setAlarmClock(clockInfo, pi);
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    } else {
                        am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    }
                }

                String toastMsg = triggeredAutomatically
                    ? "No response — Alarm auto-snoozed for " + activeSnoozeMinutes + " minutes"
                    : "Alarm snoozed for " + activeSnoozeMinutes + " minutes";
                Toast.makeText(AlarmActivity.this, toastMsg, Toast.LENGTH_LONG).show();
                finish();
            }
        };
        currentPerformSnoozeAction = performSnoozeAction;

        // Immediate responsive click handling for lockscreen wakeup
        View.OnClickListener stopClickListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (alarmHandled) return;
                alarmHandled = true;
                cancelAutoSnoozeTimer();
                stopAlarmAndSound();
                if ("TASK".equalsIgnoreCase(finalAlarmType)) {
                    markMedicationOrTaskTaken(AlarmActivity.this, finalMedicationId, finalElderId, "TASK");
                    Toast.makeText(AlarmActivity.this, "✓ Task completed!", Toast.LENGTH_SHORT).show();
                    finish();
                    return;
                }

                markMedicationOrTaskTaken(AlarmActivity.this, finalMedicationId, finalElderId, "MEDICATION");

                // Check phone memory + intent for a post-alarm Special Notice for this medicine
                JSONObject latestMed = AlarmScheduler.getMedicationFromCache(AlarmActivity.this, finalMedicationId, finalLabel);
                boolean snEnabled = false;
                String snType = "TEXT";
                String snText = "";
                String snAudioUrl = "";
                int snMaxCount = 5;
                int snServerShown = 0;
                String snVersion = "1";

                if (getIntent().hasExtra("specialNoticeEnabled")) {
                    snEnabled = getIntent().getBooleanExtra("specialNoticeEnabled", false);
                    String t = getIntent().getStringExtra("specialNoticeType");
                    if (t != null) snType = t;
                    String txt = getIntent().getStringExtra("specialNoticeText");
                    if (txt != null) snText = txt;
                    String aud = getIntent().getStringExtra("specialNoticeAudioUrl");
                    if (aud != null) snAudioUrl = aud;
                    snMaxCount = Math.max(1, getIntent().getIntExtra("specialNoticeMaxCount", 5));
                    snServerShown = Math.max(0, getIntent().getIntExtra("specialNoticeShownCount", 0));
                    String ver = getIntent().getStringExtra("specialNoticeVersion");
                    if (ver != null && !ver.isEmpty()) snVersion = ver;
                } else if (latestMed != null && latestMed.optBoolean("specialNoticeEnabled", false)) {
                    snEnabled = true;
                    snType = latestMed.optString("specialNoticeType", "TEXT");
                    snText = latestMed.optString("specialNoticeText", "");
                    snAudioUrl = latestMed.optString("specialNoticeAudioUrl", "");
                    snMaxCount = Math.max(1, latestMed.optInt("specialNoticeMaxCount", 5));
                    snServerShown = Math.max(0, latestMed.optInt("specialNoticeShownCount", 0));
                    snVersion = latestMed.optString("specialNoticeVersion", "1");
                }

                boolean isEmergencySos = finalLabel.contains("EMERGENCY SOS") || finalLabel.contains("SOS");
                boolean isVoice = "VOICE".equalsIgnoreCase(snType);
                boolean hasValidPayload = isVoice ? (snAudioUrl != null && !snAudioUrl.trim().isEmpty()) : (snText != null && !snText.trim().isEmpty());

                int currentShown = AlarmScheduler.getSpecialNoticeShownCount(AlarmActivity.this, finalMedicationId, snVersion, snServerShown);

                if (!isEmergencySos && snEnabled && hasValidPayload && currentShown < snMaxCount) {
                    int newCount = AlarmScheduler.incrementSpecialNoticeShownCount(AlarmActivity.this, finalMedicationId, snVersion, currentShown);
                    syncSpecialNoticeShownToServer(AlarmActivity.this, finalMedicationId, finalElderId, snVersion, newCount);

                    String counterLabel = "📢 SPECIAL NOTICE • " + newCount + " OF " + snMaxCount;
                    if (newCount >= snMaxCount) {
                        counterLabel = counterLabel + " (FINAL)";
                    }
                    tvSpecialNoticeCounter.setText(counterLabel);

                    String medDisplay = finalLabel;
                    if (latestMed != null && !latestMed.optString("name", "").isEmpty()) {
                        String n = latestMed.optString("name");
                        String d = latestMed.optString("dosage", "");
                        medDisplay = d.isEmpty() ? n : (n + " • " + d);
                    }
                    tvSpecialNoticeMed.setText(medDisplay);

                    layoutAlarmControls.setVisibility(View.GONE);
                    layoutSpecialNotice.setVisibility(View.VISIBLE);

                    if (isVoice) {
                        layoutNoticeTextBox.setVisibility(View.GONE);
                        layoutNoticeVoiceBox.setVisibility(View.VISIBLE);
                        final String finalAudioUrl = snAudioUrl;
                        final String finalVersion = snVersion;
                        btnReplaySpecialNotice.setOnClickListener(new View.OnClickListener() {
                            @Override
                            public void onClick(View btnView) {
                                playSpecialNoticeVoice(finalMedicationId, finalAudioUrl, finalVersion, tvSpecialNoticeVoiceStatus);
                            }
                        });
                        playSpecialNoticeVoice(finalMedicationId, snAudioUrl, snVersion, tvSpecialNoticeVoiceStatus);
                    } else {
                        layoutNoticeVoiceBox.setVisibility(View.GONE);
                        layoutNoticeTextBox.setVisibility(View.VISIBLE);
                        tvSpecialNoticeText.setText(snText);
                    }

                    btnCloseSpecialNotice.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View closeView) {
                            stopSpecialNoticeAudio();
                            Toast.makeText(AlarmActivity.this, "✓ Medicine marked as taken!", Toast.LENGTH_SHORT).show();
                            finish();
                        }
                    });
                    return;
                }

                Toast.makeText(AlarmActivity.this, "✓ Medicine marked as taken!", Toast.LENGTH_SHORT).show();
                finish();
            }
        };
        stopBtn.setOnClickListener(stopClickListener);

        View.OnClickListener snoozeClickListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                autoSnoozeStatusView.setTag("MANUAL");
                performSnoozeAction.run();
            }
        };
        snoozeBtn.setOnClickListener(snoozeClickListener);

        // 5. Start Auto-Snooze Countdown (ONLY if enabled by Admin for this account)
        applyAutoSnoozeSchedule();

        // 6. Start Single Continuous Sound and Aggressive Vibration immediately (100% offline-first)
        startAlarmSoundAndVibration();

        // 7. Non-blocking background check against server in case Doze/battery-saver delayed silent FCM settings push
        boolean shouldUpdateSnoozeLabel = useLivePrefs || (finalMedicationId != null && !finalMedicationId.trim().isEmpty());
        syncLivePreferencesFromServer(finalElderId, finalAlarmType, myGeneration, currentIsEmergencySos, shouldUpdateSnoozeLabel);
    }

    private void refreshWakeLockForAutoSnooze() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::AlarmActivityWakeLock"
                );
                long wakeMs = currentAutoSnoozeEnabled
                    ? Math.min(30 * 60 * 1000L, Math.max(3 * 60 * 1000L, (currentAutoSnoozeAfterSeconds + 30L) * 1000L))
                    : 3 * 60 * 1000L;
                wakeLock.acquire(wakeMs);
            }
        } catch (Exception ignored) {}
    }

    private void applyAutoSnoozeSchedule() {
        cancelAutoSnoozeTimer();
        if (alarmHandled || isFinishing() || isDestroyed() || currentAutoSnoozeStatusView == null) return;

        if (!currentAutoSnoozeEnabled || currentAutoSnoozeAfterSeconds <= 0 || currentIsEmergencySos) {
            currentAutoSnoozeStatusView.setVisibility(View.GONE);
            return;
        }

        final long deadlineElapsed = ringStartElapsed + (currentAutoSnoozeAfterSeconds * 1000L);
        currentAutoSnoozeStatusView.setVisibility(View.VISIBLE);
        if (autoSnoozeHandler == null) {
            autoSnoozeHandler = new Handler(Looper.getMainLooper());
        }
        autoSnoozeRunnable = new Runnable() {
            @Override
            public void run() {
                if (alarmHandled || isFinishing() || isDestroyed()) return;
                long remainingMs = deadlineElapsed - SystemClock.elapsedRealtime();
                if (remainingMs <= 0) {
                    Log.i(TAG, "Auto-snooze countdown reached 0 for account " + currentElderId + " - auto-snoozing for " + currentSnoozeDuration + " mins.");
                    currentAutoSnoozeStatusView.setTag("AUTO");
                    if (currentPerformSnoozeAction != null) {
                        currentPerformSnoozeAction.run();
                    }
                    return;
                }
                long remainingSec = (long) Math.ceil(remainingMs / 1000.0);
                currentAutoSnoozeStatusView.setText("⏱️ Auto-snoozing in " + remainingSec + "s if no response...");
                autoSnoozeHandler.postDelayed(this, 1000L);
            }
        };
        autoSnoozeHandler.post(autoSnoozeRunnable);
    }

    private void syncLivePreferencesFromServer(
        final String elderId,
        final String alarmType,
        final long generation,
        final boolean isEmergencySos,
        final boolean shouldUpdateSnoozeLabel
    ) {
        if (elderId == null || elderId.trim().isEmpty() || isEmergencySos) return;

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    String encodedElderId = URLEncoder.encode(elderId.trim(), "UTF-8");
                    URL url = new URL("https://eldersaath.vercel.app/api/elder/preferences?elderId=" + encodedElderId + "&_t=" + System.currentTimeMillis());
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setUseCaches(false);
                    conn.setRequestProperty("Cache-Control", "no-cache");
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");

                    try {
                        String cookie = CookieManager.getInstance().getCookie("https://eldersaath.vercel.app");
                        if (cookie != null && !cookie.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookie);
                        }
                    } catch (Exception ignored) {}

                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);

                    int code = conn.getResponseCode();
                    if (code < 200 || code >= 300) return;

                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            sb.append(line);
                        }
                    }

                    JSONObject json = new JSONObject(sb.toString());
                    final boolean srvAutoEnabled = json.optBoolean("autoSnoozeEnabled", false);
                    final int srvAutoSeconds = Math.max(5, json.optInt("autoSnoozeAfterSeconds", 60));
                    final int srvSnoozeDuration = Math.max(1, json.optInt("alarmSnoozeDuration", 10));
                    final String srvSnoozeText = json.optString("alarmSnoozeText", "Take later");
                    final boolean srvSticky = json.optBoolean("stickyAlarmNotification", true);
                    final String srvButtonOrder = json.optString("alarmButtonOrder", AlarmScheduler.DEFAULT_BUTTON_ORDER);
                    final String srvTakeColor = json.optString("alarmTakeBtnColor", AlarmScheduler.DEFAULT_TAKE_BTN_COLOR);
                    final String srvSnoozeColor = json.optString("alarmSnoozeBtnColor", AlarmScheduler.DEFAULT_SNOOZE_BTN_COLOR);

                    AlarmScheduler.saveAlarmSettings(
                        getApplicationContext(),
                        elderId,
                        srvSnoozeText,
                        srvSnoozeDuration,
                        srvAutoEnabled,
                        srvAutoSeconds,
                        srvSticky,
                        srvButtonOrder,
                        srvTakeColor,
                        srvSnoozeColor
                    );

                    final String resolvedSnoozeText = AlarmScheduler.getChildSnoozeText(getApplicationContext(), elderId, alarmType);

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (generation != intentGeneration || alarmHandled || isFinishing() || isDestroyed()) {
                                return;
                            }

                            if (shouldUpdateSnoozeLabel) {
                                currentSnoozeDuration = srvSnoozeDuration;
                                if (resolvedSnoozeText != null && !resolvedSnoozeText.trim().isEmpty()) {
                                    currentSnoozeText = resolvedSnoozeText;
                                }
                                if (currentSnoozeBtn != null) {
                                    String displaySnooze = currentSnoozeText;
                                    if (!displaySnooze.toLowerCase().contains("min") && !displaySnooze.toLowerCase().contains("m)")) {
                                        displaySnooze = displaySnooze + " (" + currentSnoozeDuration + " mins)";
                                    }
                                    currentSnoozeBtn.setText(displaySnooze);
                                }
                            }

                            if (srvAutoEnabled != currentAutoSnoozeEnabled || srvAutoSeconds != currentAutoSnoozeAfterSeconds) {
                                Log.i(TAG, "Hot-updating live auto-snooze from server: enabled=" + srvAutoEnabled + ", seconds=" + srvAutoSeconds);
                                currentAutoSnoozeEnabled = srvAutoEnabled;
                                currentAutoSnoozeAfterSeconds = srvAutoSeconds;
                                refreshWakeLockForAutoSnooze();
                                applyAutoSnoozeSchedule();
                            }
                        }
                    });
                } catch (Exception e) {
                    Log.d(TAG, "Non-blocking live preference check skipped/offline: " + e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    private void applyCustomAlarmButtonUi(
        LinearLayout buttonsContainer,
        Button stopBtn,
        Button snoozeBtn,
        String buttonOrder,
        String takeBtnColor,
        String snoozeBtnColor
    ) {
        try {
            if (stopBtn != null && !AlarmScheduler.DEFAULT_TAKE_BTN_COLOR.equalsIgnoreCase(takeBtnColor)) {
                applyButtonBackgroundAndContrast(stopBtn, takeBtnColor, false);
            }
            if (snoozeBtn != null && !AlarmScheduler.DEFAULT_SNOOZE_BTN_COLOR.equalsIgnoreCase(snoozeBtnColor)) {
                applyButtonBackgroundAndContrast(snoozeBtn, snoozeBtnColor, true);
            }

            if ("SNOOZE_FIRST".equals(buttonOrder) && buttonsContainer != null && stopBtn != null && snoozeBtn != null) {
                buttonsContainer.removeView(stopBtn);
                buttonsContainer.removeView(snoozeBtn);

                LinearLayout.LayoutParams snoozeLp = (LinearLayout.LayoutParams) snoozeBtn.getLayoutParams();
                LinearLayout.LayoutParams stopLp = (LinearLayout.LayoutParams) stopBtn.getLayoutParams();
                int margin16Dp = (int) TypedValue.applyDimension(
                    TypedValue.COMPLEX_UNIT_DIP, 16f, getResources().getDisplayMetrics()
                );
                if (snoozeLp != null) snoozeLp.bottomMargin = margin16Dp;
                if (stopLp != null) stopLp.bottomMargin = 0;

                buttonsContainer.addView(snoozeBtn, snoozeLp);
                buttonsContainer.addView(stopBtn, stopLp);
            }
        } catch (Exception e) {
            Log.w(TAG, "Non-fatal error applying custom alarm button UI; keeping XML defaults", e);
        }
    }

    private void applyButtonBackgroundAndContrast(Button btn, String hexColor, boolean isSnoozeButton) {
        if (btn == null || hexColor == null) return;
        int bgColor = Color.parseColor(hexColor);
        float radiusPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 28f, getResources().getDisplayMetrics()
        );
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(bgColor);
        drawable.setCornerRadius(radiusPx);

        double lum = (0.299 * Color.red(bgColor) + 0.587 * Color.green(bgColor) + 0.114 * Color.blue(bgColor)) / 255.0;
        if (isSnoozeButton || lum < 0.10) {
            int strokePx = Math.max(2, (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 2f, getResources().getDisplayMetrics()
            ));
            int strokeColor = lum > 0.62 ? Color.argb(75, 15, 23, 42) : Color.argb(95, 255, 255, 255);
            drawable.setStroke(strokePx, strokeColor);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            btn.setBackgroundTintList(null);
        }
        btn.setBackground(drawable);
        btn.setTextColor(
            lum > 0.62
                ? Color.parseColor("#0F172A")
                : Color.parseColor(isSnoozeButton ? "#F1F5F9" : "#FFFFFF")
        );
    }

    private void playSpecialNoticeVoice(final String medId, final String audioUrl, final String version, final TextView statusView) {
        stopSpecialNoticeAudio();
        final File localFile = AlarmScheduler.getSpecialNoticeAudioFile(this, medId);

        if (AlarmScheduler.isSpecialNoticeAudioCached(this, medId, audioUrl, version)) {
            playSpecialNoticeFromFile(localFile, statusView);
            return;
        }

        if (statusView != null) {
            statusView.setText("⏳ Loading voice message...");
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                final boolean cached = AlarmScheduler.cacheSingleSpecialNoticeAudio(AlarmActivity.this, medId, audioUrl, version);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (isFinishing() || isDestroyed()) return;
                        if (localFile.exists() && localFile.length() > 100) {
                            playSpecialNoticeFromFile(localFile, statusView);
                        } else {
                            if (statusView != null) {
                                statusView.setText("⚠️ Voice message could not load offline. Please check internet for first sync.");
                            }
                        }
                    }
                });
            }
        }).start();
    }

    private void playSpecialNoticeFromFile(File localFile, final TextView statusView) {
        try {
            stopSpecialNoticeAudio();
            if (statusView != null) {
                statusView.setText("🔊 Playing voice notice from your family...");
            }
            specialNoticePlayer = new MediaPlayer();
            specialNoticePlayer.setDataSource(localFile.getAbsolutePath());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
                specialNoticePlayer.setAudioAttributes(attrs);
            } else {
                specialNoticePlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }
            specialNoticePlayer.setLooping(false);
            specialNoticePlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    if (statusView != null) {
                        statusView.setText("✓ Voice notice finished. Tap Replay to hear again.");
                    }
                }
            });
            specialNoticePlayer.prepare();
            specialNoticePlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Error playing special notice audio", e);
            if (statusView != null) {
                statusView.setText("⚠️ Unable to play voice file.");
            }
        }
    }

    private void stopSpecialNoticeAudio() {
        try {
            if (specialNoticePlayer != null) {
                if (specialNoticePlayer.isPlaying()) specialNoticePlayer.stop();
                specialNoticePlayer.release();
                specialNoticePlayer = null;
            }
        } catch (Exception ignored) {}
    }

    /**
     * Reports incremented special notice display count asynchronously to server and clears matching pending entry.
     */
    public static void syncSpecialNoticeShownToServer(final Context context, final String medId, final String elderId, final String version, final int shownCount) {
        if (context == null || medId == null || medId.trim().isEmpty()) return;

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://eldersaath.vercel.app/api/medications/notice-shown");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");

                    try {
                        String cookie = CookieManager.getInstance().getCookie("https://eldersaath.vercel.app");
                        if (cookie != null && !cookie.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookie);
                        }
                    } catch (Exception ignored) {}

                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);
                    conn.setDoOutput(true);

                    String ver = (version != null && !version.trim().isEmpty()) ? version.trim() : "1";
                    JSONObject payload = new JSONObject();
                    payload.put("medicationId", medId);
                    if (elderId != null && !elderId.isEmpty()) {
                        payload.put("elderId", elderId);
                    }
                    payload.put("version", ver);
                    payload.put("shownCount", shownCount);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Special notice shown count synced to server! HTTP Response: " + code);
                    if (code >= 200 && code < 300) {
                        SharedPreferences p = context.getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
                        Set<String> pend = new HashSet<>(p.getStringSet("pending_special_notice_sync", new HashSet<String>()));
                        pend.remove(medId + "|" + ver + "|" + shownCount);
                        p.edit().putStringSet("pending_special_notice_sync", pend).apply();
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Offline or network error syncing special notice count (kept in pending phone memory): " + e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    /**
     * Records medication or task as taken in local offline storage AND synchronizes with the server.
     */
    public static void markMedicationOrTaskTaken(final Context context, final String medId, final String elderId, final String type) {
        if (context == null || medId == null || medId.trim().isEmpty()) {
            Log.w("ALARM_DEBUG", "Cannot mark taken: medId is null or empty");
            return;
        }

        // 1. Store in local SharedPreferences pending queue so it's guaranteed to sync even when offline
        try {
            SharedPreferences prefs = context.getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            Set<String> pending = new HashSet<>(prefs.getStringSet("pending_taken_med_ids", new HashSet<String>()));
            pending.add(medId);
            prefs.edit().putStringSet("pending_taken_med_ids", pending).apply();
            Log.i("ALARM_DEBUG", "Added medId to local pending taken list: " + medId);
        } catch (Exception e) {
            Log.w("ALARM_DEBUG", "Error saving to pending_taken_med_ids", e);
        }

        // 2. Fire asynchronous background network request to server
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://eldersaath.vercel.app/api/medications/log");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");
                    
                    try {
                        String cookie = CookieManager.getInstance().getCookie("https://eldersaath.vercel.app");
                        if (cookie != null && !cookie.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookie);
                        }
                    } catch (Exception ignored) {}

                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);
                    conn.setDoOutput(true);

                    JSONObject payload = new JSONObject();
                    payload.put("medicationId", medId);
                    if (elderId != null && !elderId.isEmpty()) {
                        payload.put("elderId", elderId);
                    }
                    payload.put("status", "TAKEN");
                    payload.put("type", type != null ? type : "MEDICATION");

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i("ALARM_DEBUG", "Medication/Task logged to server successfully! HTTP Response: " + code);

                    if (code >= 200 && code < 300) {
                        // Cleared from pending list since server confirmed receipt
                        SharedPreferences p = context.getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
                        Set<String> pend = new HashSet<>(p.getStringSet("pending_taken_med_ids", new HashSet<String>()));
                        pend.remove(medId);
                        p.edit().putStringSet("pending_taken_med_ids", pend).apply();
                    }
                } catch (Exception e) {
                    Log.w("ALARM_DEBUG", "Network log call failed (will be synced when app opens / comes online): " + e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    /**
     * Notifies caregiver server asynchronously that the elder snoozed (manually or automatically) their alarm.
     */
    public static void notifySnoozeToServer(final Context context, final String elderId) {
        notifySnoozeToServer(context, elderId, false);
    }

    public static void notifySnoozeToServer(final Context context, final String elderId, final boolean autoSnoozed) {
        if (elderId == null || elderId.trim().isEmpty()) {
            Log.d("ALARM_DEBUG", "No elderId provided for snooze notification, skipping.");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://eldersaath.vercel.app/api/alarms/snooze");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");
                    
                    try {
                        String cookie = CookieManager.getInstance().getCookie("https://eldersaath.vercel.app");
                        if (cookie != null && !cookie.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookie);
                        }
                    } catch (Exception ignored) {}

                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);

                    JSONObject payload = new JSONObject();
                    payload.put("elderId", elderId);
                    payload.put("autoSnoozed", autoSnoozed);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i("ALARM_DEBUG", "Snooze notified to server! HTTP Response: " + code + " (autoSnoozed=" + autoSnoozed + ")");
                } catch (Exception e) {
                    Log.w("ALARM_DEBUG", "Server snooze notification failed: " + e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    private void startAlarmSoundAndVibration() {
        try {
            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            boolean customToneEnabled = prefs.getBoolean("custom_tone_enabled", false);
            String customToneUrl = prefs.getString("custom_tone_url", "");
            File localToneFile = new File(getFilesDir(), "custom_alarm_tone.mp3");

            boolean customPlayed = false;
            if (customToneEnabled) {
                try {
                    if (localToneFile.exists() && localToneFile.length() > 500) {
                        Log.i(TAG, "Playing local cached custom alarm tone: " + localToneFile.length() + " bytes");
                        mediaPlayer = new MediaPlayer();
                        mediaPlayer.setDataSource(localToneFile.getAbsolutePath());
                        setupAndPlayMediaPlayer();
                        customPlayed = true;
                    } else if (customToneUrl != null && !customToneUrl.trim().isEmpty() && customToneUrl.startsWith("http")) {
                        Log.i(TAG, "Playing remote custom alarm tone: " + customToneUrl);
                        mediaPlayer = new MediaPlayer();
                        mediaPlayer.setDataSource(customToneUrl);
                        setupAndPlayMediaPlayer();
                        customPlayed = true;
                    }
                } catch (Exception customEx) {
                    Log.w(TAG, "Failed to play custom alarm tone, seamlessly falling back to system default tone", customEx);
                    customPlayed = false;
                    if (mediaPlayer != null) {
                        try { mediaPlayer.release(); } catch (Exception ignored) {}
                        mediaPlayer = null;
                    }
                }
            }

            // If custom tone is disabled, or if it failed to play: use phone's system default alarm tone
            if (!customPlayed) {
                Log.i(TAG, "Using phone's native system default alarm tone (customToneEnabled=" + customToneEnabled + ")");
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(getApplicationContext(), alarmUri);
                setupAndPlayMediaPlayer();
            }
        } catch (Exception e) {
            Log.w(TAG, "MediaPlayer failed, using RingtoneManager fallback", e);
            try {
                Uri alarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                android.media.Ringtone fallbackRingtone = RingtoneManager.getRingtone(getApplicationContext(), alarm);
                if (fallbackRingtone != null) fallbackRingtone.play();
            } catch (Exception ignored) {}
        }

        try {
            // Continuous Vibration Pattern
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 800, 400, 800, 400, 800};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = repeat endlessly
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {}
    }

    private void setupAndPlayMediaPlayer() throws Exception {
        if (mediaPlayer == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);
        } else {
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
        }
        mediaPlayer.setLooping(true);
        mediaPlayer.prepare();
        mediaPlayer.start();
    }

    public void stopAlarmAndSound() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception ignored) {}

        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {}

        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}

        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancelAll();
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        alarmHandled = true;
        cancelAutoSnoozeTimer();
        stopAlarmAndSound();
        stopSpecialNoticeAudio();
        if (currentInstance == this) {
            currentInstance = null;
        }
        super.onDestroy();
    }
}
