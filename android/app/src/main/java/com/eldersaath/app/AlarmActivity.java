package com.eldersaath.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class AlarmActivity extends Activity {
    private static final String TAG = "AlarmActivity";
    public static volatile AlarmActivity currentInstance = null;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    public static void stopCurrentAlarm(Context context) {
        try {
            if (currentInstance != null) {
                currentInstance.stopAlarmAndSound();
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
                currentInstance.stopAlarmAndSound();
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

        // 2. CPU WakeLock for duration of alarm
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::AlarmActivityWakeLock"
                );
                wakeLock.acquire(3 * 60 * 1000L); // 3 minutes timeout
            }
        } catch (Exception ignored) {}

        // 3. Extract Alarm Details
        String actionText = getIntent().getStringExtra("actionText");
        if (actionText == null || actionText.isEmpty()) actionText = "TAKE MEDICINE / STOP ALARM";

        String label = getIntent().getStringExtra("label");
        if (label == null) label = "EMERGENCY ALARM!";
        
        String body = getIntent().getStringExtra("body");
        if (body == null) body = "Please take your medications on time.";

        String snoozeText = getIntent().getStringExtra("snoozeText");
        if (snoozeText == null || snoozeText.isEmpty()) snoozeText = "I'll take the medicines later";
        
        int parsedSnooze = 10;
        try {
            if (getIntent().hasExtra("snoozeDuration")) {
                Object obj = getIntent().getExtras().get("snoozeDuration");
                if (obj instanceof Integer) {
                    parsedSnooze = (Integer) obj;
                } else if (obj instanceof String) {
                    parsedSnooze = Integer.parseInt((String) obj);
                }
            }
        } catch (Exception ignored) {}
        final int snoozeDuration = parsedSnooze;

        String elderId = getIntent().getStringExtra("elderId");
        if (elderId == null || elderId.isEmpty()) {
            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            elderId = prefs.getString("elder_id", "");
        }

        String medicationId = getIntent().getStringExtra("medicationId");
        String alarmType = getIntent().getStringExtra("type");

        // If medicationId wasn't passed directly, look it up in cached alarms
        if ((medicationId == null || medicationId.isEmpty()) && label != null) {
            try {
                SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
                String cachedMeds = prefs.getString("cached_alarms_json", "");
                if (cachedMeds != null && !cachedMeds.isEmpty()) {
                    JSONArray arr = new JSONArray(cachedMeds);
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        String name = obj.optString("name", "");
                        if (!name.isEmpty() && label.contains(name)) {
                            medicationId = obj.optString("id");
                            if (alarmType == null) alarmType = obj.optString("type", "MEDICATION");
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        final String finalMedicationId = medicationId;
        final String finalElderId = elderId;
        final String finalAlarmType = alarmType != null ? alarmType : "MEDICATION";

        // 4. Set Clean, Responsive XML Layout
        setContentView(R.layout.activity_alarm);

        TextView alertBadge = findViewById(R.id.tvAlarmBadge);
        TextView iconView = findViewById(R.id.tvAlarmIcon);
        TextView titleView = findViewById(R.id.tvAlarmTitle);
        TextView bodyView = findViewById(R.id.tvAlarmBody);
        Button stopBtn = findViewById(R.id.btnStopAlarm);
        Button snoozeBtn = findViewById(R.id.btnSnoozeAlarm);

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

        String displaySnooze = snoozeText;
        if (!displaySnooze.toLowerCase().contains("min") && !displaySnooze.toLowerCase().contains("m)")) {
            displaySnooze = displaySnooze + " (" + snoozeDuration + " mins)";
        }
        snoozeBtn.setText(displaySnooze);

        // Immediate responsive click and touch handling for Samsung lockscreen wakeup
        View.OnClickListener stopClickListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarmAndSound();
                if ("TASK".equalsIgnoreCase(finalAlarmType)) {
                    markMedicationOrTaskTaken(AlarmActivity.this, finalMedicationId, finalElderId, "TASK");
                    Toast.makeText(AlarmActivity.this, "✓ Task completed!", Toast.LENGTH_SHORT).show();
                } else {
                    markMedicationOrTaskTaken(AlarmActivity.this, finalMedicationId, finalElderId, "MEDICATION");
                    Toast.makeText(AlarmActivity.this, "✓ Medicine marked as taken!", Toast.LENGTH_SHORT).show();
                }
                finish();
            }
        };
        stopBtn.setOnClickListener(stopClickListener);
        stopBtn.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    v.performClick();
                    return true;
                }
                return false;
            }
        });

        final String finalActionText = actionText;
        final String finalLabel = label;
        final String finalBody = body;
        final String finalSnoozeText = snoozeText;
        
        View.OnClickListener snoozeClickListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarmAndSound();
                
                Intent snoozeIntent = new Intent(AlarmActivity.this, AlarmActivity.class);
                snoozeIntent.putExtra("actionText", finalActionText);
                snoozeIntent.putExtra("label", finalLabel);
                snoozeIntent.putExtra("body", finalBody);
                snoozeIntent.putExtra("snoozeText", finalSnoozeText);
                snoozeIntent.putExtra("snoozeDuration", snoozeDuration);
                snoozeIntent.putExtra("medicationId", finalMedicationId);
                snoozeIntent.putExtra("type", finalAlarmType);
                if (finalElderId != null) snoozeIntent.putExtra("elderId", finalElderId);
                
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

                int reqCode = (int) (System.currentTimeMillis() % 100000);
                PendingIntent pi = PendingIntent.getActivity(AlarmActivity.this, reqCode, snoozeIntent, flags);
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                long triggerAt = System.currentTimeMillis() + (snoozeDuration * 60 * 1000L);

                if (am != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    } else {
                        am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    }
                }
                
                Toast.makeText(AlarmActivity.this, "Alarm snoozed for " + snoozeDuration + " minutes", Toast.LENGTH_LONG).show();
                finish();
            }
        };
        snoozeBtn.setOnClickListener(snoozeClickListener);
        snoozeBtn.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    v.performClick();
                    return true;
                }
                return false;
            }
        });

        // 5. Start Single Continuous Sound and Aggressive Vibration
        startAlarmSoundAndVibration();
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

    private void startAlarmSoundAndVibration() {
        try {
            // Audio via MediaPlayer (Single Continuous Loop on ALARM channel)
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(getApplicationContext(), alarmUri);
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
        stopAlarmAndSound();
        if (currentInstance == this) {
            currentInstance = null;
        }
        super.onDestroy();
    }
}
