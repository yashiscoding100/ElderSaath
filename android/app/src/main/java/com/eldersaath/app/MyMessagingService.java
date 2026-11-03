package com.eldersaath.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.MessagingService;

public class MyMessagingService extends MessagingService {

    // THROTTLE: Only allow one alarm every 8 seconds to prevent duplicate storm
    private static long lastAlarmTime = 0;
    private static final long ALARM_COOLDOWN_MS = 8000;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        
        // 1. SILENT BACKGROUND SYNC: Update offline alarms from cloud without ringing
        if (remoteMessage.getData().size() > 0 && "SYNC_MEDICATIONS".equals(remoteMessage.getData().get("type"))) {
            Log.i("ALARM_DEBUG", "FCM SYNC_MEDICATIONS RECEIVED - Updating offline hardware alarm schedule in background");
            String medsJson = remoteMessage.getData().get("medications");
            if (medsJson != null && !medsJson.trim().isEmpty()) {
                AlarmScheduler.saveAndSchedule(this, medsJson);
            } else {
                AlarmScheduler.rescheduleAll(this);
            }
            return;
        }

        // 2. SILENT BACKGROUND SYNC: Update offline SOS widget settings
        if (remoteMessage.getData().size() > 0 && "SYNC_SETTINGS".equals(remoteMessage.getData().get("type"))) {
            Log.i("ALARM_DEBUG", "FCM SYNC_SETTINGS RECEIVED - Updating SOS widget configuration in background");
            String ambulanceNumber = remoteMessage.getData().get("ambulanceNumber");
            String callAmbulanceStr = remoteMessage.getData().get("sosCallAmbulance");
            String alertFamilyStr = remoteMessage.getData().get("sosAlertFamily");
            String localSirenStr = remoteMessage.getData().get("sosLocalSiren");
            String elderId = remoteMessage.getData().get("elderId");

            android.content.SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            if (ambulanceNumber != null) editor.putString("sos_ambulance_number", ambulanceNumber);
            if (callAmbulanceStr != null) editor.putBoolean("sos_call_ambulance", "true".equalsIgnoreCase(callAmbulanceStr));
            if (alertFamilyStr != null) editor.putBoolean("sos_alert_family", "true".equalsIgnoreCase(alertFamilyStr));
            if (localSirenStr != null) editor.putBoolean("sos_local_siren", "true".equalsIgnoreCase(localSirenStr));
            if (elderId != null) editor.putString("elder_id", elderId);
            editor.apply();

            SosWidgetProvider.updateAllWidgets(this);
            return;
        }

        if (remoteMessage.getData().size() > 0 && "ALARM".equals(remoteMessage.getData().get("type"))) {
            
            long now = System.currentTimeMillis();
            if (now - lastAlarmTime < ALARM_COOLDOWN_MS) {
                Log.e("ALARM_DEBUG", "THROTTLED - Skipping duplicate alarm (fired " + (now - lastAlarmTime) + "ms ago)");
                return;
            }
            lastAlarmTime = now;
            
            Log.e("ALARM_DEBUG", "FCM ALARM RECEIVED - FIRING AGGRESSIVE WAKEUP");
            
            String label = remoteMessage.getData().get("label");
            if (label == null) label = "EMERGENCY ALARM";
            
            String body = remoteMessage.getData().get("body");
            if (body == null) body = "If you don't want to take your medicine right now, snooze it and take it after 5 mins.";

            String snoozeText = remoteMessage.getData().get("snoozeText");
            String actionText = remoteMessage.getData().get("actionText");
            String snoozeDurationStr = remoteMessage.getData().get("snoozeDuration");
            int snoozeDuration = 10;
            if (snoozeDurationStr != null) {
                try { snoozeDuration = Integer.parseInt(snoozeDurationStr); } catch (Exception ignored) {}
            }
            String elderId = remoteMessage.getData().get("elderId");
            if (snoozeText == null) snoozeText = "I'll take the medicines later";
            if (actionText == null) actionText = "TAKE MEDICINE / STOP ALARM";

            try {
                // 1. FORCE THE CPU AND SCREEN AWAKE
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                        PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, 
                        "ElderSaath::HyperAlarmWakeLock"
                    );
                    wakeLock.acquire(3 * 60 * 1000L); // 3 minutes
                }
                
                // 2. High-Priority Alarm Notification Channel
                NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                String channelId = "whatsapp_style_alarms";
                Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmSound == null) {
                    alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                long[] vibrationPattern = new long[]{0, 1000, 500, 1000, 500, 1000};

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
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
                    notificationManager.createNotificationChannel(channel);
                }

                // 3. Prepare Full-Screen Intent
                Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
                fullScreenIntent.putExtra("label", label);
                fullScreenIntent.putExtra("body", body);
                fullScreenIntent.putExtra("snoozeText", snoozeText);
                fullScreenIntent.putExtra("actionText", actionText);
                fullScreenIntent.putExtra("snoozeDuration", snoozeDuration);
                boolean showSticky = true;
                if (remoteMessage.getData().containsKey("stickyNotification")) {
                    if ("false".equals(remoteMessage.getData().get("stickyNotification"))) showSticky = false;
                }
                fullScreenIntent.putExtra("stickyNotification", showSticky);
                if (elderId != null) fullScreenIntent.putExtra("elderId", elderId);
                
                fullScreenIntent.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK | 
                    Intent.FLAG_ACTIVITY_CLEAR_TOP | 
                    Intent.FLAG_ACTIVITY_SINGLE_TOP |
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                );

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                        this, 0, fullScreenIntent, flags
                );

                int ALARM_NOTIFICATION_ID = 99999;

                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(android.R.drawable.ic_dialog_alert)
                        .setContentTitle(remoteMessage.getData().containsKey("actionText") ? remoteMessage.getData().get("actionText") : "ALARM")
                        .setContentText(label)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setSound(alarmSound)
                        .setVibrate(vibrationPattern)
                        .setFullScreenIntent(fullScreenPendingIntent, true)
                        .setAutoCancel(true)
                        .setOngoing(showSticky);

                notificationManager.notify(ALARM_NOTIFICATION_ID, builder.build());
                Log.e("ALARM_DEBUG", "Notification Fired with FullScreenIntent! Sticky: " + showSticky);
                
                // 4. AGGRESSIVELY FORCE LAUNCH ACTIVITY DIRECTLY
                try {
                    startActivity(fullScreenIntent);
                    Log.e("ALARM_DEBUG", "Direct startActivity succeeded!");
                } catch (Exception e1) {
                    try {
                        getApplicationContext().startActivity(fullScreenIntent);
                        Log.e("ALARM_DEBUG", "ApplicationContext startActivity succeeded!");
                    } catch (Exception e2) {
                        Log.e("ALARM_DEBUG", "Could not force background startActivity: " + e2.getMessage());
                    }
                }
                
            } catch (Exception e) {
                Log.e("ALARM_DEBUG", "FATAL CRASH IN JAVA: " + e.getMessage());
                e.printStackTrace();
            }
        } else {
            super.onMessageReceived(remoteMessage);
            Log.e("ALARM_DEBUG", "Received normal push, passed to Capacitor.");
        }
    }
}
