package com.eldersaath.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class LocalAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "LocalAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.e(TAG, ">>> HARDWARE ALARM TRIGGERED EXACTLY ON TIME! Waking device...");

        String medicationId = intent.getStringExtra("medicationId");
        String name = intent.getStringExtra("name");
        String dosage = intent.getStringExtra("dosage");
        String time = intent.getStringExtra("time");
        String frequency = intent.getStringExtra("frequency");
        String instructions = intent.getStringExtra("instructions");
        String elderId = intent.getStringExtra("elderId");

        if (name == null || name.isEmpty()) name = "Medication";
        if (dosage == null) dosage = "Scheduled Dose";

        // 1. Force the CPU and Screen awake immediately
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::LocalHardwareAlarmWakeLock"
                );
                wakeLock.acquire(3 * 60 * 1000L); // Keep awake for 3 mins
            } catch (Exception e) {
                Log.w(TAG, "Could not acquire WakeLock", e);
            }
        }

        // 2. Queue up the NEXT occurrence of this recurring alarm
        try {
            AlarmScheduler.scheduleNextOccurrence(context, medicationId, name, dosage, time, frequency, instructions, elderId);
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling next occurrence", e);
        }

        // 3. Prepare AlarmActivity intent
        Intent alarmIntent = new Intent(context, AlarmActivity.class);
        alarmIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        alarmIntent.putExtra("label", "Time for " + name);
        alarmIntent.putExtra("body", "Dosage: " + dosage + (instructions != null && !instructions.isEmpty() ? ". " + instructions : ""));
        alarmIntent.putExtra("actionText", "TAKE MEDICINE / STOP ALARM");
        alarmIntent.putExtra("snoozeText", "Take later");
        alarmIntent.putExtra("snoozeDuration", 10);
        alarmIntent.putExtra("elderId", elderId);
        alarmIntent.putExtra("medicationId", medicationId);
        alarmIntent.putExtra("stickyNotification", true);

        // 4. Notification Channel with Alarm priority & sound
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "whatsapp_style_alarms";
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        long[] vibrationPattern = new long[]{0, 1000, 500, 1000, 500, 1000};

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
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
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            channel.setSound(alarmSound, audioAttributes);
            nm.createNotificationChannel(channel);
        }

        int requestCode = AlarmScheduler.getRequestCode(medicationId);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ Time for " + name)
            .setContentText("Dosage: " + dosage)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setVibrate(vibrationPattern)
            .setSound(alarmSound);

        if (nm != null) {
            nm.notify(requestCode, builder.build());
        }

        // 5. Directly start AlarmActivity to pop up over lock screen
        try {
            context.startActivity(alarmIntent);
            Log.i(TAG, "AlarmActivity launched directly!");
        } catch (Exception e) {
            Log.w(TAG, "Direct startActivity failed (OEM restricted), fullScreenIntent will handle it", e);
        }
    }
}
