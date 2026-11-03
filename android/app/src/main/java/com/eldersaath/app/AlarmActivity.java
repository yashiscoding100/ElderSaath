package com.eldersaath.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
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
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;

        // 1. Force the screen ON and display cleanly over Samsung lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        // 2. Keep CPU and Screen awake while alarm is ringing
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::AlarmActivityWake"
                );
                wakeLock.acquire(5 * 60 * 1000L); // 5 mins max
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

        final String elderId = getIntent().getStringExtra("elderId");

        // 4. Set Clean, Responsive XML Layout
        setContentView(R.layout.activity_alarm);

        TextView alertBadge = findViewById(R.id.tvAlarmBadge);
        TextView iconView = findViewById(R.id.tvAlarmIcon);
        TextView titleView = findViewById(R.id.tvAlarmTitle);
        TextView bodyView = findViewById(R.id.tvAlarmBody);
        Button stopBtn = findViewById(R.id.btnStopAlarm);
        Button snoozeBtn = findViewById(R.id.btnSnoozeAlarm);

        String alarmType = getIntent().getStringExtra("type");
        if (label.contains("SOS") || label.contains("EMERGENCY")) {
            iconView.setText("🚨");
            alertBadge.setText("🚨 EMERGENCY SOS ACTIVE!");
        } else if ("TASK".equalsIgnoreCase(alarmType) || label.toLowerCase().startsWith("task")) {
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
        final String finalElderId = elderId;
        
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
                if (finalElderId != null) snoozeIntent.putExtra("elderId", finalElderId);
                
                if (finalElderId != null) {
                    new Thread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                java.net.URL url = new java.net.URL("https://eldersaath.vercel.app/api/alarms/snooze");
                                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                                conn.setRequestMethod("POST");
                                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                                conn.setDoOutput(true);
                                String jsonInputString = "{\"elderId\": \"" + finalElderId + "\"}";
                                java.io.OutputStream os = conn.getOutputStream();
                                byte[] input = jsonInputString.getBytes("utf-8");
                                os.write(input, 0, input.length);
                                os.flush();
                                os.close();
                                conn.getResponseCode();
                            } catch (Exception ignored) {}
                        }
                    }).start();
                }
                
                snoozeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    AlarmActivity.this, 
                    (int)System.currentTimeMillis(), 
                    snoozeIntent, 
                    flags
                );
                
                AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                long snoozeTime = System.currentTimeMillis() + (snoozeDuration * 60 * 1000L);
                
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeTime, pendingIntent);
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, snoozeTime, pendingIntent);
                    }
                    Toast.makeText(AlarmActivity.this, "Snoozed! Waking you up again in " + snoozeDuration + " mins.", Toast.LENGTH_LONG).show();
                } catch (SecurityException e) {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, snoozeTime, pendingIntent);
                    Toast.makeText(AlarmActivity.this, "Snoozed for " + snoozeDuration + " mins.", Toast.LENGTH_LONG).show();
                }

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
