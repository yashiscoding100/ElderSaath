package com.eldersaath.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.util.Log;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SosWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "SosWidgetProvider";
    public static final String ACTION_TRIGGER_SOS_WIDGET = "com.eldersaath.app.ACTION_TRIGGER_SOS_WIDGET";
    private static final String PREF_NAME = "ElderSaathAlarms";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String ambulanceNumber = prefs.getString("sos_ambulance_number", "108");
        boolean callAmbulance = prefs.getBoolean("sos_call_ambulance", true);

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_sos);

            if (callAmbulance) {
                views.setTextViewText(R.id.sos_call_subtext, "Tap: Call " + ambulanceNumber + " & Alert");
            } else {
                views.setTextViewText(R.id.sos_call_subtext, "Tap to Alert Family");
            }

            Intent intent = new Intent(context, SosWidgetProvider.class);
            intent.setAction(ACTION_TRIGGER_SOS_WIDGET);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            views.setOnClickPendingIntent(R.id.sos_widget_root, pendingIntent);
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null || !ACTION_TRIGGER_SOS_WIDGET.equals(intent.getAction())) {
            return;
        }

        Log.e(TAG, "🚨 SOS WIDGET BUTTON CLICKED ON HOME SCREEN!");

        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String ambulanceNumber = prefs.getString("sos_ambulance_number", "108");
        boolean callAmbulance = prefs.getBoolean("sos_call_ambulance", true);
        boolean alertFamily = prefs.getBoolean("sos_alert_family", true);
        boolean localSiren = prefs.getBoolean("sos_local_siren", true);
        String elderId = prefs.getString("elder_id", "");
        String elderName = prefs.getString("elder_name", "Elder");

        // 1. Force the CPU and Screen awake
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "ElderSaath::SosWidgetWakeLock"
                );
                wl.acquire(3 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock", e);
        }

        // 2. Local Siren on this device (if enabled in settings)
        if (localSiren) {
            try {
                Intent alarmIntent = new Intent(context, AlarmActivity.class);
                alarmIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                );
                alarmIntent.putExtra("label", "🚨 EMERGENCY SOS ACTIVE!");
                alarmIntent.putExtra("body", "Emergency alert is sounding. Contacting ambulance and family members.");
                alarmIntent.putExtra("actionText", "I AM SAFE / STOP ALARM");
                alarmIntent.putExtra("snoozeText", "Snooze 5 mins");
                alarmIntent.putExtra("snoozeDuration", "5");
                alarmIntent.putExtra("stickyNotification", true);
                context.startActivity(alarmIntent);
            } catch (Exception e) {
                Log.e(TAG, "Failed to start local AlarmActivity", e);
            }
        }

        // 3. Launch Default Phone Dialer to Ambulance (if enabled in settings)
        if (callAmbulance) {
            try {
                String phone = (ambulanceNumber != null && !ambulanceNumber.trim().isEmpty()) ? ambulanceNumber : "108";
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.setData(Uri.parse("tel:" + phone));
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(dialIntent);
                Log.i(TAG, "Dialer opened for ambulance number: " + phone);
            } catch (Exception e) {
                Log.e(TAG, "Failed to open phone dialer", e);
            }
        }

        // 4. Alert All Family Members on Cloud (if enabled in settings)
        if (alertFamily) {
            new Thread(() -> {
                try {
                    URL url = new URL("https://eldersaath.vercel.app/api/sos");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);

                    JSONObject body = new JSONObject();
                    body.put("elderId", elderId);
                    body.put("source", "ANDROID_WIDGET");
                    byte[] input = body.toString().getBytes("utf-8");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Family SOS broadcast response: " + code);
                    conn.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send network SOS alert", e);
                }
            }).start();
        }
    }

    public static void updateAllWidgets(Context context) {
        if (context == null) return;
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, SosWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            Intent updateIntent = new Intent(context, SosWidgetProvider.class);
            updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
            context.sendBroadcast(updateIntent);
        }
    }
}
