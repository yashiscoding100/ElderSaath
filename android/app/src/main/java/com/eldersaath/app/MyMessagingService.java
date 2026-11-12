package com.eldersaath.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
            }

            // Persist child snooze, admin auto-snooze & button layout settings into phone memory
            if (remoteMessage.getData().containsKey("autoSnoozeEnabled") ||
                remoteMessage.getData().containsKey("autoSnoozeAfterSeconds") ||
                remoteMessage.getData().containsKey("alarmSnoozeDuration") ||
                remoteMessage.getData().containsKey("alarmSnoozeText") ||
                remoteMessage.getData().containsKey("stickyAlarmNotification") ||
                remoteMessage.getData().containsKey("alarmButtonOrder") ||
                remoteMessage.getData().containsKey("alarmTakeBtnColor") ||
                remoteMessage.getData().containsKey("alarmSnoozeBtnColor")) {
                SharedPreferences syncPrefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
                String syncElderId = remoteMessage.getData().get("elderId");
                if (syncElderId == null || syncElderId.trim().isEmpty()) {
                    syncElderId = syncPrefs.getString("elder_id", "");
                }
                String syncSnoozeText = remoteMessage.getData().containsKey("alarmSnoozeText")
                    ? remoteMessage.getData().get("alarmSnoozeText")
                    : AlarmScheduler.getChildSnoozeText(this, syncElderId, "MEDICATION");
                int syncSnoozeDur = AlarmScheduler.getChildSnoozeDuration(this, syncElderId);
                try {
                    String sDur = remoteMessage.getData().get("alarmSnoozeDuration");
                    if (sDur != null) syncSnoozeDur = Integer.parseInt(sDur);
                } catch (Exception ignored) {}
                boolean syncAutoEnabled = remoteMessage.getData().containsKey("autoSnoozeEnabled")
                    ? "true".equalsIgnoreCase(remoteMessage.getData().get("autoSnoozeEnabled"))
                    : AlarmScheduler.isAutoSnoozeEnabled(this, syncElderId);
                int syncAutoSec = AlarmScheduler.getAutoSnoozeAfterSeconds(this, syncElderId);
                try {
                    String sAutoSec = remoteMessage.getData().get("autoSnoozeAfterSeconds");
                    if (sAutoSec != null) syncAutoSec = Integer.parseInt(sAutoSec);
                } catch (Exception ignored) {}
                boolean syncSticky = remoteMessage.getData().containsKey("stickyAlarmNotification")
                    ? !"false".equalsIgnoreCase(remoteMessage.getData().get("stickyAlarmNotification"))
                    : syncPrefs.getBoolean("sticky_alarm_notification", true);
                String syncButtonOrder = remoteMessage.getData().containsKey("alarmButtonOrder")
                    ? remoteMessage.getData().get("alarmButtonOrder")
                    : AlarmScheduler.getAlarmButtonOrder(this, syncElderId);
                String syncTakeColor = remoteMessage.getData().containsKey("alarmTakeBtnColor")
                    ? remoteMessage.getData().get("alarmTakeBtnColor")
                    : AlarmScheduler.getAlarmTakeBtnColor(this, syncElderId);
                String syncSnoozeColor = remoteMessage.getData().containsKey("alarmSnoozeBtnColor")
                    ? remoteMessage.getData().get("alarmSnoozeBtnColor")
                    : AlarmScheduler.getAlarmSnoozeBtnColor(this, syncElderId);

                AlarmScheduler.saveAlarmSettings(
                    this,
                    syncElderId,
                    syncSnoozeText,
                    syncSnoozeDur,
                    syncAutoEnabled,
                    syncAutoSec,
                    syncSticky,
                    syncButtonOrder,
                    syncTakeColor,
                    syncSnoozeColor
                );
            }
            return;
        }

        // 2. SILENT BACKGROUND SYNC: Update offline SOS widget settings
        if (remoteMessage.getData().size() > 0 && "SYNC_SETTINGS".equals(remoteMessage.getData().get("type"))) {
            Log.i("ALARM_DEBUG", "FCM SYNC_SETTINGS RECEIVED - Updating SOS widget configuration in background");
            String ambulanceNumber = remoteMessage.getData().get("ambulanceNumber");
            String callAmbulanceStr = remoteMessage.getData().get("sosCallAmbulance");
            String callTarget = remoteMessage.getData().get("sosCallTarget");
            String customPhone = remoteMessage.getData().get("sosCustomPhone");
            String alertFamilyStr = remoteMessage.getData().get("sosAlertFamily");
            String localSirenStr = remoteMessage.getData().get("sosLocalSiren");
            String sirenMode = remoteMessage.getData().get("sosSirenMode");
            String strobeFlashlightStr = remoteMessage.getData().get("sosStrobeFlashlight");
            String countdownSecondsStr = remoteMessage.getData().get("sosCountdownSeconds");
            String elderId = remoteMessage.getData().get("elderId");

            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            if (ambulanceNumber != null) editor.putString("sos_ambulance_number", ambulanceNumber);
            if (callAmbulanceStr != null) editor.putBoolean("sos_call_ambulance", "true".equalsIgnoreCase(callAmbulanceStr));
            if (callTarget != null) editor.putString("sos_call_target", callTarget);
            if (customPhone != null) editor.putString("sos_custom_phone", customPhone);
            if (alertFamilyStr != null) editor.putBoolean("sos_alert_family", "true".equalsIgnoreCase(alertFamilyStr));
            if (localSirenStr != null) editor.putBoolean("sos_local_siren", "true".equalsIgnoreCase(localSirenStr));
            if (sirenMode != null) editor.putString("sos_siren_mode", sirenMode);
            if (strobeFlashlightStr != null) editor.putBoolean("sos_strobe_flashlight", "true".equalsIgnoreCase(strobeFlashlightStr));
            if (countdownSecondsStr != null) {
                try { editor.putInt("sos_countdown_seconds", Integer.parseInt(countdownSecondsStr)); } catch (Exception ignored) {}
            }
            if (elderId != null) editor.putString("elder_id", elderId);
            editor.apply();

            SosWidgetProvider.updateAllWidgets(this);
            return;
        }

        // 3. SILENT BACKGROUND SYNC: Update global alarm tone
        if (remoteMessage.getData().size() > 0 && "SYNC_ALARM_TONE".equals(remoteMessage.getData().get("type"))) {
            Log.i("ALARM_DEBUG", "FCM SYNC_ALARM_TONE RECEIVED - Updating global alarm tone");
            String enabledStr = remoteMessage.getData().get("customToneEnabled");
            String toneUrl = remoteMessage.getData().get("customToneUrl");
            String toneTitle = remoteMessage.getData().get("customToneTitle");
            boolean enabled = "true".equalsIgnoreCase(enabledStr);

            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean("custom_tone_enabled", enabled)
                .putString("custom_tone_url", toneUrl != null ? toneUrl : "")
                .putString("custom_tone_title", toneTitle != null ? toneTitle : "Custom Tone")
                .apply();

            if (enabled && toneUrl != null && !toneUrl.trim().isEmpty()) {
                AlarmSyncPlugin.cacheAlarmTone(this, toneUrl);
            }
            return;
        }

        if (remoteMessage.getData().size() > 0 && "ALARM".equals(remoteMessage.getData().get("type"))) {
            
            long now = System.currentTimeMillis();
            if (now - lastAlarmTime < ALARM_COOLDOWN_MS) {
                Log.e("ALARM_DEBUG", "THROTTLED - Skipping duplicate alarm (fired " + (now - lastAlarmTime) + "ms ago)");
                return;
            }
            lastAlarmTime = now;

            // Shared deduplication with hardware alarm to prevent double ringing
            SharedPreferences prefs = getSharedPreferences("ElderSaathAlarms", Context.MODE_PRIVATE);
            long lastHardwareFired = prefs.getLong("last_alarm_fired_timestamp", 0);
            String lastMedId = prefs.getString("last_alarm_fired_med_id", "");
            String incomingMedId = remoteMessage.getData().get("medicationId");

            if (incomingMedId != null && incomingMedId.equals(lastMedId) && (now - lastHardwareFired) < 45000) {
                Log.i("ALARM_DEBUG", "FCM alarm suppressed: Local hardware alarm already fired " + (now - lastHardwareFired) + "ms ago");
                return;
            }

            prefs.edit()
                .putLong("last_alarm_fired_timestamp", now)
                .putString("last_alarm_fired_med_id", incomingMedId != null ? incomingMedId : "FCM_ALARM")
                .apply();
            
            Log.e("ALARM_DEBUG", "FCM ALARM RECEIVED - FIRING WAKEUP");
            
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
            if (elderId == null || elderId.trim().isEmpty()) {
                elderId = prefs.getString("elder_id", "");
            }
            if (snoozeText == null) snoozeText = AlarmScheduler.getChildSnoozeText(this, elderId, "MEDICATION");
            if (actionText == null) actionText = "TAKE MEDICINE / STOP ALARM";

            boolean autoSnoozeEnabled = AlarmScheduler.isAutoSnoozeEnabled(this, elderId);
            if (remoteMessage.getData().containsKey("autoSnoozeEnabled")) {
                autoSnoozeEnabled = "true".equalsIgnoreCase(remoteMessage.getData().get("autoSnoozeEnabled"));
            }
            int autoSnoozeAfterSeconds = AlarmScheduler.getAutoSnoozeAfterSeconds(this, elderId);
            if (remoteMessage.getData().containsKey("autoSnoozeAfterSeconds")) {
                try {
                    autoSnoozeAfterSeconds = Math.max(5, Integer.parseInt(remoteMessage.getData().get("autoSnoozeAfterSeconds")));
                } catch (Exception ignored) {}
            }

            try {
                // 1. FORCE THE CPU AND SCREEN AWAKE
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, 
                        "ElderSaath::HyperAlarmWakeLock"
                    );
                    long wakeMs = autoSnoozeEnabled
                        ? Math.min(30 * 60 * 1000L, Math.max(3 * 60 * 1000L, (autoSnoozeAfterSeconds + 30L) * 1000L))
                        : 3 * 60 * 1000L;
                    wakeLock.acquire(wakeMs);
                }
                
                // 2. High-Priority Alarm Notification Channel (Silent on Notification Channel so only AlarmActivity plays audio!)
                NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                String channelId = "eldersaath_fullscreen_alarms_v2";
                long[] vibrationPattern = new long[]{0, 800, 400, 800, 400, 800};

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        notificationManager.deleteNotificationChannel("whatsapp_style_alarms"); // delete old channel with sound cache
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
                    notificationManager.createNotificationChannel(channel);
                }

                // 3. Prepare Full-Screen Intent
                Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
                fullScreenIntent.putExtra("label", label);
                fullScreenIntent.putExtra("body", body);
                fullScreenIntent.putExtra("snoozeText", snoozeText);
                fullScreenIntent.putExtra("actionText", actionText);
                fullScreenIntent.putExtra("snoozeDuration", snoozeDuration);
                fullScreenIntent.putExtra("autoSnoozeEnabled", autoSnoozeEnabled);
                fullScreenIntent.putExtra("autoSnoozeAfterSeconds", autoSnoozeAfterSeconds);
                String alarmButtonOrder = AlarmScheduler.sanitizeButtonOrder(
                    remoteMessage.getData().containsKey("alarmButtonOrder")
                        ? remoteMessage.getData().get("alarmButtonOrder")
                        : AlarmScheduler.getAlarmButtonOrder(this, elderId)
                );
                String alarmTakeBtnColor = AlarmScheduler.sanitizeHexColor(
                    remoteMessage.getData().containsKey("alarmTakeBtnColor")
                        ? remoteMessage.getData().get("alarmTakeBtnColor")
                        : AlarmScheduler.getAlarmTakeBtnColor(this, elderId),
                    AlarmScheduler.DEFAULT_TAKE_BTN_COLOR
                );
                String alarmSnoozeBtnColor = AlarmScheduler.sanitizeHexColor(
                    remoteMessage.getData().containsKey("alarmSnoozeBtnColor")
                        ? remoteMessage.getData().get("alarmSnoozeBtnColor")
                        : AlarmScheduler.getAlarmSnoozeBtnColor(this, elderId),
                    AlarmScheduler.DEFAULT_SNOOZE_BTN_COLOR
                );
                fullScreenIntent.putExtra("alarmButtonOrder", alarmButtonOrder);
                fullScreenIntent.putExtra("alarmTakeBtnColor", alarmTakeBtnColor);
                fullScreenIntent.putExtra("alarmSnoozeBtnColor", alarmSnoozeBtnColor);
                fullScreenIntent.putExtra("triggerNonce", System.currentTimeMillis());
                fullScreenIntent.putExtra("isLocalAlarm", false);
                if (elderId != null && !elderId.trim().isEmpty() && remoteMessage.getData().containsKey("autoSnoozeEnabled")) {
                    AlarmScheduler.saveAlarmSettings(
                        this,
                        elderId,
                        AlarmScheduler.getChildSnoozeText(this, elderId, "MEDICATION"),
                        AlarmScheduler.getChildSnoozeDuration(this, elderId),
                        autoSnoozeEnabled,
                        autoSnoozeAfterSeconds,
                        !"false".equals(remoteMessage.getData().get("stickyNotification")),
                        alarmButtonOrder,
                        alarmTakeBtnColor,
                        alarmSnoozeBtnColor
                    );
                }
                boolean showSticky = true;
                if (remoteMessage.getData().containsKey("stickyNotification")) {
                    if ("false".equals(remoteMessage.getData().get("stickyNotification"))) showSticky = false;
                }
                fullScreenIntent.putExtra("stickyNotification", showSticky);
                if (elderId != null) fullScreenIntent.putExtra("elderId", elderId);
                String medicationId = remoteMessage.getData().get("medicationId");
                if (medicationId != null) fullScreenIntent.putExtra("medicationId", medicationId);
                String alarmType = remoteMessage.getData().get("type");
                if (alarmType != null) fullScreenIntent.putExtra("type", alarmType);

                // Forward optional post-alarm Special Notice metadata (used when testing alarms from dashboard)
                if (remoteMessage.getData().containsKey("specialNoticeEnabled")) {
                    boolean snEnabled = "true".equalsIgnoreCase(remoteMessage.getData().get("specialNoticeEnabled"));
                    fullScreenIntent.putExtra("specialNoticeEnabled", snEnabled);
                    if (snEnabled) {
                        fullScreenIntent.putExtra("specialNoticeType", remoteMessage.getData().get("specialNoticeType"));
                        fullScreenIntent.putExtra("specialNoticeText", remoteMessage.getData().get("specialNoticeText"));
                        fullScreenIntent.putExtra("specialNoticeAudioUrl", remoteMessage.getData().get("specialNoticeAudioUrl"));
                        fullScreenIntent.putExtra("specialNoticeVersion", remoteMessage.getData().get("specialNoticeVersion"));
                        try {
                            String maxStr = remoteMessage.getData().get("specialNoticeMaxCount");
                            if (maxStr != null) fullScreenIntent.putExtra("specialNoticeMaxCount", Integer.parseInt(maxStr));
                            String shownStr = remoteMessage.getData().get("specialNoticeShownCount");
                            if (shownStr != null) fullScreenIntent.putExtra("specialNoticeShownCount", Integer.parseInt(shownStr));
                        } catch (Exception ignored) {}
                    }
                }
                
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

                // Stop Intent for notification action button and swipe-to-dismiss delete intent
                Intent stopIntent = new Intent(this, LocalAlarmReceiver.class);
                stopIntent.setAction(LocalAlarmReceiver.ACTION_STOP_ALARM);
                if (medicationId != null) stopIntent.putExtra("medicationId", medicationId);
                if (elderId != null) stopIntent.putExtra("elderId", elderId);
                if (alarmType != null) stopIntent.putExtra("type", alarmType);
                PendingIntent stopPendingIntent = PendingIntent.getBroadcast(
                    this,
                    99125,
                    stopIntent,
                    flags
                );

                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(android.R.drawable.ic_dialog_alert)
                        .setContentTitle(remoteMessage.getData().containsKey("actionText") ? remoteMessage.getData().get("actionText") : "ALARM")
                        .setContentText(label)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setSilent(true)
                        .setVibrate(vibrationPattern)
                        .setFullScreenIntent(fullScreenPendingIntent, true)
                        .setContentIntent(fullScreenPendingIntent)
                        .setDeleteIntent(stopPendingIntent) // Dismissing notification on lockscreen stops alarm sound!
                        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP ALARM", stopPendingIntent)
                        .setAutoCancel(true)
                        .setOngoing(false);

                notificationManager.notify(ALARM_NOTIFICATION_ID, builder.build());
                Log.e("ALARM_DEBUG", "Notification Fired with FullScreenIntent!");
                
                // 4. AGGRESSIVELY FORCE LAUNCH ACTIVITY DIRECTLY
                try {
                    startActivity(fullScreenIntent);
                    Log.e("ALARM_DEBUG", "Direct startActivity succeeded!");
                } catch (Exception e1) {
                    Log.e("ALARM_DEBUG", "Direct startActivity failed on this OEM (Android 10+ background restriction). FullScreenIntent will wake device.");
                }

            } catch (Exception e) {
                Log.e("ALARM_DEBUG", "Error triggering alarm notification", e);
            }
        }
    }
}
