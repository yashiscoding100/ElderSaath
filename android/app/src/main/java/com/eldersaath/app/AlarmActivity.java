package com.eldersaath.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
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
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class AlarmActivity extends Activity {
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Force the screen ON, show over lockscreen, dismiss keyguard
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            try {
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null) {
                    km.requestDismissKeyguard(this, null);
                }
            } catch (Exception ignored) {}
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        // 2. Keep CPU and Screen alive while alarm is ringing
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
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

        boolean stickyNotification = getIntent().getBooleanExtra("stickyNotification", true);
        if (!stickyNotification) {
            try {
                android.app.NotificationManager notificationManager = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                notificationManager.cancel(99999);
            } catch (Exception ignored) {}
        }

        String snoozeText = getIntent().getStringExtra("snoozeText");
        if (snoozeText == null || snoozeText.isEmpty()) snoozeText = "I'll take the medicines later";
        
        final int snoozeDuration = getIntent().getIntExtra("snoozeDuration", 10);
        final String elderId = getIntent().getStringExtra("elderId");

        // 4. Build Fullscreen High-Contrast UI
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        
        android.graphics.drawable.GradientDrawable bgGrad = new android.graphics.drawable.GradientDrawable(
            android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {Color.parseColor("#0F172A"), Color.parseColor("#1E1B4B")}
        );
        layout.setBackground(bgGrad);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(60, 60, 60, 60);

        TextView alertBadge = new TextView(this);
        alertBadge.setText("⏰ ELDERSAATH ALARM");
        alertBadge.setTextSize(14);
        alertBadge.setTextColor(Color.parseColor("#38BDF8"));
        alertBadge.setGravity(Gravity.CENTER);
        alertBadge.setPadding(0, 0, 0, 20);

        TextView titleView = new TextView(this);
        titleView.setText(label);
        titleView.setTextSize(28);
        titleView.setTextColor(Color.WHITE);
        titleView.setGravity(Gravity.CENTER);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setPadding(0, 0, 0, 20);

        TextView bodyView = new TextView(this);
        bodyView.setText(body);
        bodyView.setTextSize(18);
        bodyView.setTextColor(Color.parseColor("#E2E8F0"));
        bodyView.setGravity(Gravity.CENTER);
        bodyView.setPadding(0, 0, 0, 60);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.setMargins(0, 0, 0, 30);

        // STOP / TAKE MEDICINE BUTTON
        Button stopBtn = new Button(this);
        stopBtn.setText(actionText.toUpperCase());
        stopBtn.setTextSize(17);
        stopBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        android.graphics.drawable.GradientDrawable stopBg = new android.graphics.drawable.GradientDrawable();
        stopBg.setColor(Color.parseColor("#10B981")); // Emerald Green
        stopBg.setCornerRadius(24);
        stopBtn.setBackground(stopBg);
        stopBtn.setTextColor(Color.WHITE);
        stopBtn.setPadding(30, 45, 30, 45);
        stopBtn.setLayoutParams(btnParams);
        stopBtn.setElevation(10);

        stopBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarmAndSound();
                finish();
            }
        });

        // SNOOZE BUTTON
        Button snoozeBtn = new Button(this);
        snoozeBtn.setText(snoozeText);
        snoozeBtn.setTextSize(16);
        snoozeBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        android.graphics.drawable.GradientDrawable snoozeBg = new android.graphics.drawable.GradientDrawable();
        snoozeBg.setColor(Color.parseColor("#F97316")); // Bright Orange
        snoozeBg.setCornerRadius(24);
        snoozeBtn.setBackground(snoozeBg);
        snoozeBtn.setTextColor(Color.WHITE);
        snoozeBtn.setPadding(30, 35, 30, 35);
        snoozeBtn.setLayoutParams(btnParams);

        final String finalActionText = actionText;
        final String finalLabel = label;
        final String finalBody = body;
        final String finalSnoozeText = snoozeText;
        final String finalElderId = elderId;
        
        snoozeBtn.setOnClickListener(new View.OnClickListener() {
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
        });

        layout.addView(alertBadge);
        layout.addView(titleView);
        layout.addView(bodyView);
        layout.addView(snoozeBtn);
        layout.addView(stopBtn);
        setContentView(layout);

        // 5. Start Continuous Sound and Aggressive Vibration
        startAlarmSoundAndVibration();
    }

    private void startAlarmSoundAndVibration() {
        try {
            // Audio via MediaPlayer (Continuous Loop on ALARM channel)
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
            // Fallback to RingtoneManager if MediaPlayer fails
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

    private void stopAlarmAndSound() {
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
    }

    @Override
    protected void onDestroy() {
        stopAlarmAndSound();
        super.onDestroy();
    }
}
