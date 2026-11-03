package com.eldersaath.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class LocalAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "LocalAlarmReceiver";
    public static final String ACTION_STOP_ALARM = "com.eldersaath.app.ACTION_STOP_ALARM";
    public static final String ACTION_SNOOZE_ALARM = "com.eldersaath.app.ACTION_SNOOZE_ALARM";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        // 1. Handle STOP action from notification button or swipe-dismiss
        if (ACTION_STOP_ALARM.equals(action)) {
            Log.i(TAG, "Notification STOP or swipe-dismiss action triggered. Stopping all alarm audio.");
            AlarmActivity.stopCurrentAlarm(context);
            String medId = intent.getStringExtra("medicationId");
            String elderId = intent.getStringExtra("elderId");
            String type = intent.getStringExtra("type");
            if (medId != null && !medId.isEmpty()) {
                AlarmActivity.markMedicationOrTaskTaken(context, medId, elderId, type);
            }
            return;
        }

        Log.e(TAG, ">>> HARDWARE ALARM TRIGGERED! Waking device...");

        String medicationId = intent.getStringExtra("medicationId");
        String name = intent.getStringExtra("name");
        String dosage = intent.getStringExtra("dosage");
        String time = intent.getStringExtra("time");
        String frequency = intent.getStringExtra("frequency");
        String instructions = intent.getStringExtra("instructions");
        String elderId = intent.getStringExtra("elderId");
        String type = intent.getStringExtra("type");
        String label = intent.getStringExtra("label");
        String body = intent.getStringExtra("body");
        String actionText = intent.getStringExtra("actionText");

        // 2. Prevent duplicate alarm storm with FCM cloud push
        SharedPreferences prefs = context.getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
        long lastFired = prefs.getLong("last_alarm_fired_timestamp", 0);
        String lastMed = prefs.getString("last_alarm_fired_med_id", "");
        long now = System.currentTimeMillis();

        if (medicationId != null && medicationId.equals(lastMed) && (now - lastFired) < 45000) {
            Log.w(TAG, "Duplicate alarm suppressed (already fired " + (now - lastFired) + "ms ago)");
            return;
        }

        prefs.edit()
            .putLong("last_alarm_fired_timestamp", now)
            .putString("last_alarm_fired_med_id", medicationId != null ? medicationId : "LOCAL_ALARM")
            .apply();

        if (type == null) type = "MEDICATION";
        if (name == null || name.isEmpty()) name = "TASK".equalsIgnoreCase(type) ? "Task Reminder" : "Medication";
        if (dosage == null) dosage = "Scheduled Dose";

        if (label == null || label.isEmpty()) {
            label = "TASK".equalsIgnoreCase(type) ? "Task: " + name : "Time for " + name;
        }

        if (body == null || body.isEmpty()) {
            if ("TASK".equalsIgnoreCase(type)) {
                body = (instructions != null && !instructions.isEmpty()) ? instructions : "Scheduled task due now.";
            } else {
                body = "Dosage: " + dosage + (instructions != null && !instructions.isEmpty() ? ". " + instructions : "");
            }
        }

        if (actionText == null || actionText.isEmpty()) {
            actionText = "TASK".equalsIgnoreCase(type) ? "COMPLETE TASK / STOP ALARM" : "TAKE MEDICINE / STOP ALARM";
        }

        // 3. Force CPU and Screen awake immediately
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::LocalHardwareAlarmWakeLock"
                );
                wakeLock.acquire(3 * 60 * 1000L); // 3 mins
            } catch (Exception e) {
                Log.w(TAG, "Could not acquire WakeLock", e);
            }
        }

        // 4. Queue up next occurrence
        try {
            AlarmScheduler.scheduleNextOccurrence(context, medicationId, name, dosage, time, frequency, instructions, elderId, type, label, body, actionText);
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling next occurrence", e);
        }

        // 5. Prepare AlarmActivity intent
        Intent alarmIntent = new Intent(context, AlarmActivity.class);
        alarmIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        alarmIntent.putExtra("label", label);
        alarmIntent.putExtra("body", body);
        alarmIntent.putExtra("actionText", actionText);
        alarmIntent.putExtra("snoozeText", "TASK".equalsIgnoreCase(type) ? "Do task later" : "Take later");
        alarmIntent.putExtra("snoozeDuration", 10);
        alarmIntent.putExtra("elderId", elderId);
        alarmIntent.putExtra("medicationId", medicationId);
        alarmIntent.putExtra("type", type);
        alarmIntent.putExtra("stickyNotification", true);

        // 6. Notification Channel: SILENT sound on channel so AlarmActivity MediaPlayer is the SINGLE voice!
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "eldersaath_fullscreen_alarms_v2";
        long[] vibrationPattern = new long[]{0, 800, 400, 800, 400, 800};

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            try {
                nm.deleteNotificationChannel("whatsapp_style_alarms"); // delete old channel with sound cache
            } catch (Exception ignored) {}

            NotificationChannel channel = new NotificationChannel(
                channelId,
                "Emergency Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical life-saving medication and SOS alarms");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(vibrationPattern);
            channel.setSound(null, null); // SILENT: Audio is owned by AlarmActivity MediaPlayer
            nm.createNotificationChannel(channel);
        }

        int requestCode = AlarmScheduler.getRequestCode(medicationId);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Stop Intent for notification action button and swipe-to-dismiss delete intent
        Intent stopIntent = new Intent(context, LocalAlarmReceiver.class);
        stopIntent.setAction(ACTION_STOP_ALARM);
        stopIntent.putExtra("medicationId", medicationId);
        stopIntent.putExtra("elderId", elderId);
        stopIntent.putExtra("type", type);
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode + 50000,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ Time for " + name)
            .setContentText("Dosage: " + dosage)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(false)
            .setSilent(true)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setDeleteIntent(stopPendingIntent) // Dismissing notification on lockscreen stops alarm sound!
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP ALARM", stopPendingIntent);

        if (nm != null) {
            nm.notify(requestCode, builder.build());
        }

        // 7. Directly start AlarmActivity to pop up over lock screen
        try {
            context.startActivity(alarmIntent);
            Log.i(TAG, "AlarmActivity launched directly!");
        } catch (Exception e) {
            Log.w(TAG, "Direct startActivity failed, fullScreenIntent will handle it", e);
        }
    }
}
