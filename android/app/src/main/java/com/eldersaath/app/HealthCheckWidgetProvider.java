package com.eldersaath.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.text.TextUtils;
import android.util.Log;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HealthCheckWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "HealthCheckWidget";
    private static final String PREF_NAME = "ElderSaathAlarms";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        
        String requiredVitals = prefs.getString("health_required_vitals", "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT");
        String vitalsDate = prefs.getString("health_vitals_date", "");
        boolean checkDoneToday = prefs.getBoolean("health_check_done_today", false);
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String todayStr = sdf.format(new Date());

        SimpleDateFormat displaySdf = new SimpleDateFormat("EEEE, d MMM", Locale.getDefault());
        String displayDate = displaySdf.format(new Date());

        boolean isDone = todayStr.equals(vitalsDate) && checkDoneToday;

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_health_check);

            views.setTextViewText(R.id.tv_widget_date, displayDate);

            if (isDone) {
                views.setTextViewText(R.id.tv_widget_status, "✓ Recorded Today");
                views.setInt(R.id.tv_widget_status, "setBackgroundResource", R.drawable.bg_widget_status_done);
                views.setTextColor(R.id.tv_widget_status, Color.parseColor("#A7F3D0"));

                // Build recorded summary honoring ONLY configured vitals
                List<String> items = new ArrayList<>();
                if (requiredVitals.contains("BP")) {
                    String bp = prefs.getString("vital_last_bp", "");
                    items.add("BP: " + (bp.isEmpty() ? "Recorded" : bp));
                }
                if (requiredVitals.contains("SUGAR")) {
                    String sugar = prefs.getString("vital_last_sugar", "");
                    items.add("Sugar: " + (sugar.isEmpty() ? "Recorded" : sugar + " mg/dL"));
                }
                if (requiredVitals.contains("SPO2")) {
                    String spo2 = prefs.getString("vital_last_spo2", "");
                    items.add("SpO2: " + (spo2.isEmpty() ? "Recorded" : spo2 + "%"));
                }
                if (requiredVitals.contains("PULSE")) {
                    String pulse = prefs.getString("vital_last_pulse", "");
                    items.add("Pulse: " + (pulse.isEmpty() ? "Recorded" : pulse + " BPM"));
                }
                if (requiredVitals.contains("TEMP")) {
                    String temp = prefs.getString("vital_last_temp", "");
                    items.add("Temp: " + (temp.isEmpty() ? "Recorded" : temp + "°F"));
                }
                if (requiredVitals.contains("WEIGHT")) {
                    String weight = prefs.getString("vital_last_weight", "");
                    items.add("Weight: " + (weight.isEmpty() ? "Recorded" : weight + " kg"));
                }

                String summary = items.isEmpty() ? "All daily vitals completed!" : TextUtils.join("  •  ", items);
                views.setTextViewText(R.id.tv_widget_summary, summary);
                views.setTextViewText(R.id.btn_widget_action, "✎ Update Vitals");
            } else {
                views.setTextViewText(R.id.tv_widget_status, "Pending Today");
                views.setInt(R.id.tv_widget_status, "setBackgroundResource", R.drawable.bg_widget_status_pending);
                views.setTextColor(R.id.tv_widget_status, Color.parseColor("#FDE68A"));

                // Show only child-configured vitals in pending state
                List<String> pendingList = new ArrayList<>();
                if (requiredVitals.contains("BP")) pendingList.add("Blood Pressure");
                if (requiredVitals.contains("SUGAR")) pendingList.add("Sugar");
                if (requiredVitals.contains("SPO2")) pendingList.add("SpO2");
                if (requiredVitals.contains("PULSE")) pendingList.add("Pulse");
                if (requiredVitals.contains("TEMP")) pendingList.add("Temp");
                if (requiredVitals.contains("WEIGHT")) pendingList.add("Weight");

                String summary = pendingList.isEmpty() 
                    ? "Tap below to log today's health check." 
                    : "Required: " + TextUtils.join(", ", pendingList);
                views.setTextViewText(R.id.tv_widget_summary, summary);
                views.setTextViewText(R.id.btn_widget_action, "+ Enter Daily Vitals");
            }

            // Launch QuickVitalsActivity on 1-tap (floating dialog without opening full app)
            Intent intent = new Intent(context, QuickVitalsActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            views.setOnClickPendingIntent(R.id.health_widget_root, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_widget_action, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    public static void updateAllWidgets(Context context) {
        if (context == null) return;
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, HealthCheckWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            if (appWidgetIds != null && appWidgetIds.length > 0) {
                Intent updateIntent = new Intent(context, HealthCheckWidgetProvider.class);
                updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
                context.sendBroadcast(updateIntent);
                Log.i(TAG, "Sent widget update broadcast to " + appWidgetIds.length + " health widgets.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to broadcast widget update", e);
        }
    }
}
