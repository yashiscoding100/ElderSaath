package com.eldersaath.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AlarmScheduler {
    private static final String TAG = "AlarmScheduler";
    private static final String PREF_NAME = "ElderSaathAlarms";
    private static final String KEY_SAVED_MEDS = "saved_medications";
    private static final String KEY_SCHEDULED_IDS = "scheduled_ids";
    public static final String DEFAULT_BUTTON_ORDER = "TAKE_FIRST";
    public static final String DEFAULT_TAKE_BTN_COLOR = "#10B981";
    public static final String DEFAULT_SNOOZE_BTN_COLOR = "#334155";
    private static final Pattern HEX_COLOR_PATTERN = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    public static String sanitizeButtonOrder(String val) {
        if (val != null && "SNOOZE_FIRST".equalsIgnoreCase(val.trim())) {
            return "SNOOZE_FIRST";
        }
        return DEFAULT_BUTTON_ORDER;
    }

    public static String sanitizeHexColor(String val, String fallback) {
        if (val != null) {
            String trimmed = val.trim();
            if (HEX_COLOR_PATTERN.matcher(trimmed).matches()) {
                return trimmed.toUpperCase();
            }
        }
        return fallback;
    }

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
            SharedPreferences.Editor snEditor = prefs.edit();

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

                // Reconcile per-medication special notice counter in phone memory
                if (id != null && !id.isEmpty() && obj.optBoolean("specialNoticeEnabled", false)) {
                    String ver = obj.optString("specialNoticeVersion", "1");
                    int serverShown = Math.max(0, obj.optInt("specialNoticeShownCount", 0));
                    String storedVer = prefs.getString("sn_ver_" + id, null);
                    if (storedVer == null || !storedVer.equals(ver)) {
                        snEditor.putString("sn_ver_" + id, ver);
                        snEditor.putInt("sn_count_" + id, serverShown);
                    } else {
                        int localCount = prefs.getInt("sn_count_" + id, 0);
                        snEditor.putInt("sn_count_" + id, Math.max(localCount, serverShown));
                    }
                }

                if (id == null || id.isEmpty() || time == null || time.isEmpty()) continue;

                long triggerMs = calculateNextTriggerTime(time, frequency);
                if (triggerMs <= 0) continue;

                scheduleSingleAlarm(context, am, id, name, dosage, time, frequency, instructions, elderId, type, label, body, actionText, triggerMs);
                scheduledIds.add(id);
            }

            snEditor.putStringSet(KEY_SCHEDULED_IDS, scheduledIds).apply();
            Log.i(TAG, "Hardware alarms synced successfully! Total scheduled (meds & tasks): " + scheduledIds.size());

            // Asynchronously cache any Special Notice voice audio files into phone storage for 100% offline playback
            cacheSpecialNoticeAudioFiles(context.getApplicationContext(), arr);
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

    /**
     * Finds a medication object in phone-memory cached schedule by ID or fallback label match.
     */
    public static JSONObject getMedicationFromCache(Context context, String medicationId, String fallbackLabel) {
        if (context == null) return null;
        try {
            String saved = getSavedMedications(context);
            if (saved == null || saved.trim().isEmpty()) return null;
            JSONArray arr = new JSONArray(saved);
            if (medicationId != null && !medicationId.trim().isEmpty()) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    if (medicationId.equals(obj.optString("id"))) {
                        return obj;
                    }
                }
            }
            if (fallbackLabel != null && !fallbackLabel.trim().isEmpty()) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String name = obj.optString("name", "");
                    if (!name.isEmpty() && fallbackLabel.contains(name)) {
                        return obj;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "getMedicationFromCache warning", e);
        }
        return null;
    }

    /**
     * Gets how many times the special notice has already been shown for this medication & version.
     */
    public static int getSpecialNoticeShownCount(Context context, String medId, String version, int serverCount) {
        if (context == null || medId == null || medId.trim().isEmpty()) return Math.max(0, serverCount);
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String ver = (version != null && !version.trim().isEmpty()) ? version.trim() : "1";
        String storedVer = prefs.getString("sn_ver_" + medId, null);
        if (storedVer == null || !storedVer.equals(ver)) {
            return Math.max(0, serverCount);
        }
        int localCount = prefs.getInt("sn_count_" + medId, 0);
        return Math.max(localCount, Math.max(0, serverCount));
    }

    /**
     * Records one more post-alarm special notice display in phone memory and queues server sync.
     */
    public static int incrementSpecialNoticeShownCount(Context context, String medId, String version, int currentKnownCount) {
        int nextCount = Math.max(1, currentKnownCount + 1);
        if (context == null || medId == null || medId.trim().isEmpty()) return nextCount;

        String ver = (version != null && !version.trim().isEmpty()) ? version.trim() : "1";
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        Set<String> pending = new HashSet<>(prefs.getStringSet("pending_special_notice_sync", new HashSet<String>()));
        String prefix = medId + "|" + ver + "|";
        Set<String> cleaned = new HashSet<>();
        for (String entry : pending) {
            if (!entry.startsWith(prefix)) {
                cleaned.add(entry);
            }
        }
        cleaned.add(prefix + nextCount);

        prefs.edit()
            .putString("sn_ver_" + medId, ver)
            .putInt("sn_count_" + medId, nextCount)
            .putStringSet("pending_special_notice_sync", cleaned)
            .apply();

        Log.i(TAG, "Recorded special notice shown in phone memory [" + medId + ", ver=" + ver + ", count=" + nextCount + "]");
        return nextCount;
    }

    public static File getSpecialNoticeAudioFile(Context context, String medId) {
        String safeId = (medId != null ? medId : "unknown").replaceAll("[^a-zA-Z0-9._-]", "_");
        return new File(context.getFilesDir(), "special_notice_" + safeId + ".audio");
    }

    public static boolean isSpecialNoticeAudioCached(Context context, String medId, String audioUrl, String version) {
        if (context == null || medId == null || audioUrl == null || audioUrl.trim().isEmpty()) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        File targetFile = getSpecialNoticeAudioFile(context, medId);
        if (!targetFile.exists() || targetFile.length() <= 100) return false;
        String ver = (version != null && !version.trim().isEmpty()) ? version.trim() : "1";
        String sig = ver + "|" + audioUrl.hashCode();
        String existingSig = prefs.getString("sn_audio_sig_" + medId, "");
        return sig.equals(existingSig);
    }

    public static boolean cacheSingleSpecialNoticeAudio(Context context, String medId, String audioUrl, String version) {
        if (context == null || medId == null || audioUrl == null || audioUrl.trim().isEmpty()) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        File targetFile = getSpecialNoticeAudioFile(context, medId);
        String ver = (version != null && !version.trim().isEmpty()) ? version.trim() : "1";
        String sig = ver + "|" + audioUrl.hashCode();
        String existingSig = prefs.getString("sn_audio_sig_" + medId, "");

        if (sig.equals(existingSig) && targetFile.exists() && targetFile.length() > 100) {
            return true;
        }

        try {
            String trimmed = audioUrl.trim();
            if (trimmed.startsWith("data:")) {
                int commaIdx = trimmed.indexOf(",");
                if (commaIdx != -1) {
                    byte[] audioBytes = Base64.decode(trimmed.substring(commaIdx + 1), Base64.DEFAULT);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(audioBytes);
                        fos.flush();
                    }
                    prefs.edit().putString("sn_audio_sig_" + medId, sig).apply();
                    Log.i(TAG, "Cached base64 special notice audio for " + medId + " (" + targetFile.length() + " bytes)");
                    return true;
                }
            } else {
                String fullUrl = trimmed.startsWith("/") ? "https://eldersaath.vercel.app" + trimmed : trimmed;
                if (fullUrl.startsWith("http")) {
                    HttpURLConnection conn = (HttpURLConnection) new URL(fullUrl).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");
                    conn.setConnectTimeout(12000);
                    conn.setReadTimeout(20000);
                    conn.connect();
                    if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                        File tmpFile = new File(context.getFilesDir(), targetFile.getName() + ".tmp");
                        try (InputStream is = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(tmpFile)) {
                            byte[] buffer = new byte[4096];
                            int read;
                            while ((read = is.read(buffer)) != -1) {
                                fos.write(buffer, 0, read);
                            }
                            fos.flush();
                        }
                        if (tmpFile.length() > 100) {
                            if (targetFile.exists()) targetFile.delete();
                            if (!tmpFile.renameTo(targetFile)) {
                                // Copy fallback if rename fails across mounts
                                try (InputStream fis = new java.io.FileInputStream(tmpFile);
                                     FileOutputStream fos = new FileOutputStream(targetFile)) {
                                    byte[] buf = new byte[4096];
                                    int r;
                                    while ((r = fis.read(buf)) != -1) fos.write(buf, 0, r);
                                }
                                tmpFile.delete();
                            }
                            prefs.edit().putString("sn_audio_sig_" + medId, sig).apply();
                            Log.i(TAG, "Cached special notice audio for " + medId + " (" + targetFile.length() + " bytes)");
                            conn.disconnect();
                            return true;
                        } else {
                            tmpFile.delete();
                        }
                    }
                    conn.disconnect();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to cache special notice audio for " + medId + ": " + e.getMessage());
        }
        return false;
    }

    private static void cacheSpecialNoticeAudioFiles(final Context context, final JSONArray arr) {
        if (context == null || arr == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Set<String> activeAudioFilenames = new HashSet<>();
                    Map<String, String[]> toDownload = new HashMap<>();

                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.optJSONObject(i);
                        if (obj == null) continue;
                        String id = obj.optString("id", "");
                        boolean enabled = obj.optBoolean("specialNoticeEnabled", false);
                        String noticeType = obj.optString("specialNoticeType", "TEXT");
                        String audioUrl = obj.optString("specialNoticeAudioUrl", "");
                        String ver = obj.optString("specialNoticeVersion", "1");

                        if (!id.isEmpty() && enabled && "VOICE".equalsIgnoreCase(noticeType) && !audioUrl.trim().isEmpty()) {
                            File target = getSpecialNoticeAudioFile(context, id);
                            activeAudioFilenames.add(target.getName());
                            toDownload.put(id, new String[]{audioUrl, ver});
                        }
                    }

                    // Clean up unused/expired special notice audio files
                    File[] files = context.getFilesDir().listFiles();
                    if (files != null) {
                        for (File f : files) {
                            String fname = f.getName();
                            if (fname.startsWith("special_notice_") && fname.endsWith(".audio") && !activeAudioFilenames.contains(fname)) {
                                f.delete();
                            }
                        }
                    }

                    for (Map.Entry<String, String[]> entry : toDownload.entrySet()) {
                        cacheSingleSpecialNoticeAudio(context, entry.getKey(), entry.getValue()[0], entry.getValue()[1]);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "cacheSpecialNoticeAudioFiles error: " + e.getMessage());
                }
            }
        }).start();
    }

    /**
     * Persists child-configured snooze settings and admin-configured auto-snooze & button layout settings directly in phone memory.
     */
    public static void saveAlarmSettings(Context context, String elderId, String snoozeText,
                                         int snoozeDuration, boolean autoSnoozeEnabled,
                                         int autoSnoozeAfterSeconds, boolean stickyNotification) {
        saveAlarmSettings(
            context,
            elderId,
            snoozeText,
            snoozeDuration,
            autoSnoozeEnabled,
            autoSnoozeAfterSeconds,
            stickyNotification,
            null,
            null,
            null
        );
    }

    public static void saveAlarmSettings(Context context, String elderId, String snoozeText,
                                         int snoozeDuration, boolean autoSnoozeEnabled,
                                         int autoSnoozeAfterSeconds, boolean stickyNotification,
                                         String buttonOrder, String takeBtnColor, String snoozeBtnColor) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        int safeSnoozeDuration = Math.max(1, snoozeDuration);
        int safeAutoSec = Math.max(5, autoSnoozeAfterSeconds);
        String safeSnoozeText = (snoozeText != null && !snoozeText.trim().isEmpty()) ? snoozeText : "Take later";

        String resolvedButtonOrder = (buttonOrder != null && !buttonOrder.trim().isEmpty())
            ? sanitizeButtonOrder(buttonOrder)
            : getAlarmButtonOrder(context, elderId);
        String resolvedTakeColor = (takeBtnColor != null && HEX_COLOR_PATTERN.matcher(takeBtnColor.trim()).matches())
            ? takeBtnColor.trim().toUpperCase()
            : getAlarmTakeBtnColor(context, elderId);
        String resolvedSnoozeColor = (snoozeBtnColor != null && HEX_COLOR_PATTERN.matcher(snoozeBtnColor.trim()).matches())
            ? snoozeBtnColor.trim().toUpperCase()
            : getAlarmSnoozeBtnColor(context, elderId);

        // Global active keys
        editor.putString("alarm_snooze_text", safeSnoozeText);
        editor.putInt("alarm_snooze_duration", safeSnoozeDuration);
        editor.putBoolean("auto_snooze_enabled", autoSnoozeEnabled);
        editor.putInt("auto_snooze_after_seconds", safeAutoSec);
        editor.putBoolean("sticky_alarm_notification", stickyNotification);
        editor.putString("alarm_button_order", resolvedButtonOrder);
        editor.putString("alarm_take_btn_color", resolvedTakeColor);
        editor.putString("alarm_snooze_btn_color", resolvedSnoozeColor);

        // Per-account keys
        String effectiveElderId = (elderId != null && !elderId.trim().isEmpty())
            ? elderId.trim()
            : prefs.getString("elder_id", "").trim();
        if (!effectiveElderId.isEmpty()) {
            String keySuffix = "_" + effectiveElderId;
            editor.putString("elder_id", effectiveElderId);
            editor.putString("alarm_snooze_text" + keySuffix, safeSnoozeText);
            editor.putInt("alarm_snooze_duration" + keySuffix, safeSnoozeDuration);
            editor.putBoolean("auto_snooze_enabled" + keySuffix, autoSnoozeEnabled);
            editor.putInt("auto_snooze_after_seconds" + keySuffix, safeAutoSec);
            editor.putBoolean("sticky_alarm_notification" + keySuffix, stickyNotification);
            editor.putString("alarm_button_order" + keySuffix, resolvedButtonOrder);
            editor.putString("alarm_take_btn_color" + keySuffix, resolvedTakeColor);
            editor.putString("alarm_snooze_btn_color" + keySuffix, resolvedSnoozeColor);
        }

        editor.apply();
        Log.i(TAG, "Saved alarm, auto-snooze & button UI config in phone memory [elderId=" + effectiveElderId +
              ", autoSnoozeEnabled=" + autoSnoozeEnabled +
              ", autoSnoozeAfterSec=" + safeAutoSec +
              ", childSnoozeDurationMin=" + safeSnoozeDuration +
              ", buttonOrder=" + resolvedButtonOrder +
              ", takeColor=" + resolvedTakeColor +
              ", snoozeColor=" + resolvedSnoozeColor + "]");
    }

    public static String getAlarmButtonOrder(Context context, String elderId) {
        if (context == null) return DEFAULT_BUTTON_ORDER;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "alarm_button_order_" + elderId.trim();
            if (prefs.contains(key)) {
                return sanitizeButtonOrder(prefs.getString(key, DEFAULT_BUTTON_ORDER));
            }
        }
        return sanitizeButtonOrder(prefs.getString("alarm_button_order", DEFAULT_BUTTON_ORDER));
    }

    public static String getAlarmTakeBtnColor(Context context, String elderId) {
        if (context == null) return DEFAULT_TAKE_BTN_COLOR;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "alarm_take_btn_color_" + elderId.trim();
            if (prefs.contains(key)) {
                return sanitizeHexColor(prefs.getString(key, DEFAULT_TAKE_BTN_COLOR), DEFAULT_TAKE_BTN_COLOR);
            }
        }
        return sanitizeHexColor(prefs.getString("alarm_take_btn_color", DEFAULT_TAKE_BTN_COLOR), DEFAULT_TAKE_BTN_COLOR);
    }

    public static String getAlarmSnoozeBtnColor(Context context, String elderId) {
        if (context == null) return DEFAULT_SNOOZE_BTN_COLOR;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "alarm_snooze_btn_color_" + elderId.trim();
            if (prefs.contains(key)) {
                return sanitizeHexColor(prefs.getString(key, DEFAULT_SNOOZE_BTN_COLOR), DEFAULT_SNOOZE_BTN_COLOR);
            }
        }
        return sanitizeHexColor(prefs.getString("alarm_snooze_btn_color", DEFAULT_SNOOZE_BTN_COLOR), DEFAULT_SNOOZE_BTN_COLOR);
    }

    public static boolean isAutoSnoozeEnabled(Context context, String elderId) {
        if (context == null) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "auto_snooze_enabled_" + elderId.trim();
            if (prefs.contains(key)) {
                return prefs.getBoolean(key, false);
            }
        }
        return prefs.getBoolean("auto_snooze_enabled", false);
    }

    public static int getAutoSnoozeAfterSeconds(Context context, String elderId) {
        if (context == null) return 60;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "auto_snooze_after_seconds_" + elderId.trim();
            if (prefs.contains(key)) {
                return Math.max(5, prefs.getInt(key, 60));
            }
        }
        return Math.max(5, prefs.getInt("auto_snooze_after_seconds", 60));
    }

    public static int getChildSnoozeDuration(Context context, String elderId) {
        if (context == null) return 10;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "alarm_snooze_duration_" + elderId.trim();
            if (prefs.contains(key)) {
                return Math.max(1, prefs.getInt(key, 10));
            }
        }
        return Math.max(1, prefs.getInt("alarm_snooze_duration", 10));
    }

    public static String getChildSnoozeText(Context context, String elderId, String alarmType) {
        String defaultText = "TASK".equalsIgnoreCase(alarmType) ? "Do task later" : "Take later";
        if (context == null) return defaultText;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String val = null;
        if (elderId != null && !elderId.trim().isEmpty()) {
            String key = "alarm_snooze_text_" + elderId.trim();
            if (prefs.contains(key)) {
                val = prefs.getString(key, null);
            }
        }
        if (val == null || val.trim().isEmpty()) {
            val = prefs.getString("alarm_snooze_text", null);
        }
        if (val == null || val.trim().isEmpty()) return defaultText;
        if ("TASK".equalsIgnoreCase(alarmType) && "Take later".equalsIgnoreCase(val.trim())) {
            return "Do task later";
        }
        return val;
    }
}
