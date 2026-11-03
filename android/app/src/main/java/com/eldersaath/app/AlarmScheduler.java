package com.eldersaath.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AlarmScheduler {
    private static final String TAG = "AlarmScheduler";
    private static final String PREF_NAME = "ElderSaathAlarms";
    private static final String KEY_SAVED_MEDS = "saved_medications";
    private static final String KEY_SCHEDULED_IDS = "scheduled_ids";

    public static int getRequestCode(String id) {
        if (id == null) return 1000;
        int code = id.hashCode();
        return code == Integer.MIN_VALUE ? 0 : Math.abs(code);
    }

    /**
     * Parses standard 12-hour or 24-hour time strings.
     * Returns int[]{hour (0-23), minute (0-59)} or null.
     */
    public static int[] parseTime(String timeStr) {
        if (timeStr == null || timeStr.trim().isEmpty()) return null;
        String cleaned = timeStr.trim().toUpperCase().replace("\u202F", " ").replaceAll("\\s+", " ");

        // 12-hour format: "08:30 AM", "8:30 PM", "12:00 PM"
        Pattern p12 = Pattern.compile("^(\\d{1,2}):(\\d{2})\\s*(AM|PM)$");
        Matcher m12 = p12.matcher(cleaned);
        if (m12.matches()) {
            try {
                int h = Integer.parseInt(m12.group(1));
                int m = Integer.parseInt(m12.group(2));
                boolean isPm = "PM".equals(m12.group(3));
                if (isPm && h < 12) h += 12;
                if (!isPm && h == 12) h = 0;
                return new int[]{h, m};
            } catch (Exception ignored) {}
        }

        // 24-hour format: "08:30", "20:30"
        Pattern p24 = Pattern.compile("^(\\d{1,2}):(\\d{2})$");
        Matcher m24 = p24.matcher(cleaned);
        if (m24.matches()) {
            try {
                int h = Integer.parseInt(m24.group(1));
                int m = Integer.parseInt(m24.group(2));
                return new int[]{h, m};
            } catch (Exception ignored) {}
        }

        return null;
    }

    /**
     * Calculates the exact next millisecond timestamp for an alarm based on time and days of week.
     */
    public static long calculateNextTriggerTime(String timeStr, String frequency) {
        int[] parsed = parseTime(timeStr);
        if (parsed == null) return 0;
        int targetHour = parsed[0];
        int targetMinute = parsed[1];

        String freq = frequency;
        if (freq == null || freq.trim().isEmpty() || freq.equalsIgnoreCase("daily")) {
            freq = "0,1,2,3,4,5,6";
        }

        long now = System.currentTimeMillis();
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, targetHour);
        cal.set(Calendar.MINUTE, targetMinute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        // Scan ahead up to 8 days to find the next valid occurrence
        for (int i = 0; i < 8; i++) {
            long triggerTime = cal.getTimeInMillis();
            // Alarm must be at least 3 seconds in the future
            if (triggerTime > now + 3000) {
                int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK); // 1 = Sunday, 2 = Monday, ... 7 = Saturday
                int schemaDay = dayOfWeek - 1; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
                if (freq.contains(String.valueOf(schemaDay))) {
                    return triggerTime;
                }
            }
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }

        return 0;
    }

    /**
     * Saves the medications list in SharedPreferences and registers exact AlarmManager alarms.
     */
    public static void saveAndSchedule(Context context, String medicationsJson) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_SAVED_MEDS, medicationsJson).apply();

        // 1. Cancel previous alarms
        cancelAll(context);

        if (medicationsJson == null || medicationsJson.trim().isEmpty()) {
            Log.d(TAG, "Empty medications list, all alarms cancelled.");
            return;
        }

        try {
            JSONArray arr = new JSONArray(medicationsJson);
            Set<String> scheduledIds = new HashSet<>();
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String id = obj.optString("id");
                String name = obj.optString("name", obj.optString("title", "Reminder"));
                String dosage = obj.optString("dosage", "");
                String time = obj.optString("time");
                String frequency = obj.optString("frequency", "daily");
                String instructions = obj.optString("instructions", obj.optString("description", ""));
                String elderId = obj.optString("elderId", "");
                String type = obj.optString("type", "MEDICATION");
                String label = obj.optString("label", "TASK".equalsIgnoreCase(type) ? "Task: " + name : "Time for " + name);
                String body = obj.optString("body", "");
                String actionText = obj.optString("actionText", "TASK".equalsIgnoreCase(type) ? "COMPLETE TASK / STOP ALARM" : "TAKE MEDICINE / STOP ALARM");

                if (id == null || id.isEmpty() || time == null || time.isEmpty()) continue;

                long triggerMs = calculateNextTriggerTime(time, frequency);
                if (triggerMs <= 0) continue;

                scheduleSingleAlarm(context, am, id, name, dosage, time, frequency, instructions, elderId, type, label, body, actionText, triggerMs);
                scheduledIds.add(id);
            }

            prefs.edit().putStringSet(KEY_SCHEDULED_IDS, scheduledIds).apply();
            Log.i(TAG, "Hardware alarms synced successfully! Total scheduled (meds & tasks): " + scheduledIds.size());
        } catch (Exception e) {
            Log.e(TAG, "Error parsing and scheduling alarms", e);
        }
    }

    /**
     * Schedules a single exact alarm with Android AlarmManager using setAlarmClock.
     */
    public static void scheduleSingleAlarm(Context context, AlarmManager am, String id, String name,
                                           String dosage, String time, String frequency,
                                           String instructions, String elderId, String type,
                                           String label, String body, String actionText, long triggerMs) {
        if (am == null) am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, LocalAlarmReceiver.class);
        intent.setAction("com.eldersaath.app.ACTION_LOCAL_ALARM");
        intent.putExtra("medicationId", id);
        intent.putExtra("name", name);
        intent.putExtra("dosage", dosage);
        intent.putExtra("time", time);
        intent.putExtra("frequency", frequency);
        intent.putExtra("instructions", instructions);
        intent.putExtra("elderId", elderId);
        intent.putExtra("type", type);
        intent.putExtra("label", label);
        intent.putExtra("body", body);
        intent.putExtra("actionText", actionText);

        int requestCode = getRequestCode(id);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerMs, showPendingIntent);
            am.setAlarmClock(clockInfo, pendingIntent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent);
        }

        long secondsUntil = (triggerMs - System.currentTimeMillis()) / 1000;
        Log.i(TAG, ">>> Exact Hardware Alarm SET: [" + type + "] '" + name + "' (" + time + ") in " + secondsUntil + " seconds (at " + triggerMs + "ms)");
    }

    /**
     * Reschedules the next recurrence of a medication or task after it fires.
     */
    public static void scheduleNextOccurrence(Context context, String medicationId, String name,
                                              String dosage, String time, String frequency,
                                              String instructions, String elderId, String type,
                                              String label, String body, String actionText) {
        if (medicationId == null || time == null) return;
        long triggerMs = calculateNextTriggerTime(time, frequency);
        if (triggerMs > 0) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            scheduleSingleAlarm(context, am, medicationId, name, dosage, time, frequency, instructions, elderId, type, label, body, actionText, triggerMs);
        }
    }

    /**
     * Cancels all currently scheduled alarms.
     */
    public static void cancelAll(Context context) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        Set<String> scheduledIds = prefs.getStringSet(KEY_SCHEDULED_IDS, null);
        if (scheduledIds != null && !scheduledIds.isEmpty()) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            for (String id : scheduledIds) {
                int requestCode = getRequestCode(id);
                Intent intent = new Intent(context, LocalAlarmReceiver.class);
                intent.setAction("com.eldersaath.app.ACTION_LOCAL_ALARM");
                PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                if (am != null) am.cancel(pi);
            }
            prefs.edit().remove(KEY_SCHEDULED_IDS).apply();
            Log.d(TAG, "Cancelled " + scheduledIds.size() + " existing alarms.");
        }
    }

    /**
     * Re-schedules all saved alarms from SharedPreferences (e.g. after phone reboot).
     */
    public static void rescheduleAll(Context context) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String saved = prefs.getString(KEY_SAVED_MEDS, null);
        if (saved != null && !saved.trim().isEmpty()) {
            Log.i(TAG, "Restoring alarms from offline storage...");
            saveAndSchedule(context, saved);
        }
    }

    public static String getSavedMedications(Context context) {
        if (context == null) return "[]";
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_SAVED_MEDS, "[]");
    }
}
