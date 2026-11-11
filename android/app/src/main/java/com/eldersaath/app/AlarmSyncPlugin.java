package com.eldersaath.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlarmSyncPlugin")
public class AlarmSyncPlugin extends Plugin {
    private static final String TAG = "AlarmSyncPlugin";
    private static final String PREF_NAME = "ElderSaathAlarms";

    @PluginMethod
    public void syncAlarms(PluginCall call) {
        JSArray meds = call.getArray("medications");
        if (meds == null) {
            call.reject("Medications array is required");
            return;
        }

        try {
            String jsonString = meds.toString();
            AlarmScheduler.saveAndSchedule(getContext(), jsonString);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("count", meds.length());
            Log.i(TAG, "Synced " + meds.length() + " medications into offline hardware alarm schedule.");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync alarms", e);
            call.reject("Failed to sync alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingTakenMedications(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            Set<String> pending = prefs.getStringSet("pending_taken_med_ids", new HashSet<String>());
            JSArray arr = new JSArray();
            for (String id : pending) {
                arr.put(id);
            }
            JSObject ret = new JSObject();
            ret.put("pendingIds", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error getting pending taken medications: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingTakenMedication(PluginCall call) {
        try {
            String medicationId = call.getString("medicationId");
            if (medicationId != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                Set<String> pending = new HashSet<>(prefs.getStringSet("pending_taken_med_ids", new HashSet<String>()));
                pending.remove(medicationId);
                prefs.edit().putStringSet("pending_taken_med_ids", pending).apply();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error clearing pending medication: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingSpecialNoticeSync(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            Set<String> pending = prefs.getStringSet("pending_special_notice_sync", new HashSet<String>());
            JSArray items = new JSArray();
            for (String entry : pending) {
                String[] parts = entry.split("\\|");
                if (parts.length >= 3) {
                    try {
                        JSObject obj = new JSObject();
                        obj.put("medicationId", parts[0]);
                        obj.put("version", parts[1]);
                        obj.put("shownCount", Integer.parseInt(parts[2]));
                        obj.put("entry", entry);
                        items.put(obj);
                    } catch (Exception ignored) {}
                }
            }
            JSObject ret = new JSObject();
            ret.put("items", items);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading pending special notice sync: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingSpecialNoticeSync(PluginCall call) {
        try {
            JSArray entries = call.getArray("entries");
            if (entries != null && entries.length() > 0) {
                SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                Set<String> pending = new HashSet<>(prefs.getStringSet("pending_special_notice_sync", new HashSet<String>()));
                for (int i = 0; i < entries.length(); i++) {
                    String e = entries.optString(i, null);
                    if (e != null) pending.remove(e);
                }
                prefs.edit().putStringSet("pending_special_notice_sync", pending).apply();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error clearing pending special notice sync: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncAlarmTone(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", false);
            String toneUrl = call.getString("toneUrl", "");
            String toneTitle = call.getString("toneTitle", "Custom Tone");

            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean("custom_tone_enabled", enabled)
                .putString("custom_tone_url", toneUrl)
                .putString("custom_tone_title", toneTitle)
                .apply();

            if (enabled && toneUrl != null && !toneUrl.trim().isEmpty()) {
                cacheAlarmTone(getContext(), toneUrl);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", enabled);
            Log.i(TAG, "Global alarm tone synced: enabled=" + enabled + ", title=" + toneTitle);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error syncing alarm tone", e);
            call.reject("Error syncing alarm tone: " + e.getMessage());
        }
    }

    public static void cacheAlarmTone(final Context context, final String toneUrl) {
        if (context == null || toneUrl == null || toneUrl.trim().isEmpty()) return;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    File targetFile = new File(context.getFilesDir(), "custom_alarm_tone.mp3");
                    if (toneUrl.startsWith("data:")) {
                        int commaIdx = toneUrl.indexOf(",");
                        if (commaIdx != -1) {
                            String base64Data = toneUrl.substring(commaIdx + 1);
                            byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);
                            FileOutputStream fos = new FileOutputStream(targetFile);
                            fos.write(audioBytes);
                            fos.flush();
                            fos.close();
                            Log.i("AlarmSyncPlugin", "Cached base64 custom alarm tone: " + targetFile.length() + " bytes");
                        }
                    } else {
                        String fullUrl = toneUrl.trim();
                        if (fullUrl.startsWith("/")) {
                            fullUrl = "https://eldersaath.vercel.app" + fullUrl;
                        }
                        if (fullUrl.startsWith("http")) {
                            URL url = new URL(fullUrl);
                            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                            conn.setConnectTimeout(10000);
                            conn.setReadTimeout(15000);
                            conn.connect();
                            if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                                InputStream is = conn.getInputStream();
                                FileOutputStream fos = new FileOutputStream(targetFile);
                                byte[] buffer = new byte[4096];
                                int read;
                                while ((read = is.read(buffer)) != -1) {
                                    fos.write(buffer, 0, read);
                                }
                                fos.flush();
                                fos.close();
                                is.close();
                                Log.i("AlarmSyncPlugin", "Cached remote custom alarm tone: " + targetFile.length() + " bytes");
                            }
                            conn.disconnect();
                        }
                    }
                } catch (Exception e) {
                    Log.w("AlarmSyncPlugin", "Failed to cache custom alarm tone: " + e.getMessage());
                }
            }
        }).start();
    }

    @PluginMethod
    public void syncSosSettings(PluginCall call) {
        try {
            String ambulanceNumber = call.getString("ambulanceNumber", "108");
            Boolean callAmbulance = call.getBoolean("sosCallAmbulance", true);
            String callTarget = call.getString("sosCallTarget", "AMBULANCE");
            String customPhone = call.getString("sosCustomPhone", "");
            Boolean alertFamily = call.getBoolean("sosAlertFamily", true);
            Boolean localSiren = call.getBoolean("sosLocalSiren", true);
            String sirenMode = call.getString("sosSirenMode", "LOUD");
            Boolean strobeFlashlight = call.getBoolean("sosStrobeFlashlight", true);
            Integer countdownSeconds = call.getInt("sosCountdownSeconds", 3);
            String elderId = call.getString("elderId", "");
            String elderName = call.getString("elderName", "Elder");

            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString("sos_ambulance_number", ambulanceNumber)
                .putBoolean("sos_call_ambulance", callAmbulance != null ? callAmbulance : true)
                .putString("sos_call_target", callTarget != null ? callTarget : "AMBULANCE")
                .putString("sos_custom_phone", customPhone != null ? customPhone : "")
                .putBoolean("sos_alert_family", alertFamily != null ? alertFamily : true)
                .putBoolean("sos_local_siren", localSiren != null ? localSiren : true)
                .putString("sos_siren_mode", sirenMode != null ? sirenMode : "LOUD")
                .putBoolean("sos_strobe_flashlight", strobeFlashlight != null ? strobeFlashlight : true)
                .putInt("sos_countdown_seconds", countdownSeconds != null ? countdownSeconds : 3)
                .putString("elder_id", elderId)
                .putString("elder_name", elderName)
                .apply();

            SosWidgetProvider.updateAllWidgets(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            Log.i(TAG, "Advanced SOS settings synced to widget: ambulance=" + ambulanceNumber + ", target=" + callTarget);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync SOS settings", e);
            call.reject("Failed to sync SOS settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void strobeFlashlight(PluginCall call) {
        final int durationSec = call.getInt("duration", 15);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.hardware.camera2.CameraManager camManager = 
                    (android.hardware.camera2.CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
                if (camManager != null) {
                    String[] ids = camManager.getCameraIdList();
                    if (ids.length > 0) {
                        final String camId = ids[0];
                        new Thread(() -> {
                            long end = System.currentTimeMillis() + (durationSec * 1000L);
                            try {
                                while (System.currentTimeMillis() < end) {
                                    camManager.setTorchMode(camId, true);
                                    Thread.sleep(220);
                                    camManager.setTorchMode(camId, false);
                                    Thread.sleep(180);
                                }
                            } catch (Exception ignored) {
                            } finally {
                                try { camManager.setTorchMode(camId, false); } catch (Exception ignored) {}
                            }
                        }).start();
                        call.resolve();
                        return;
                    }
                }
            }
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "Flashlight strobe not supported or failed: " + e.getMessage());
            call.resolve();
        }
    }

    @PluginMethod
    public void directCall(PluginCall call) {
        String phone = call.getString("phone", "108");
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || 
                getContext().checkSelfPermission(android.Manifest.permission.CALL_PHONE) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Intent callIntent = new Intent(Intent.ACTION_CALL);
                callIntent.setData(Uri.parse("tel:" + phone));
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(callIntent);
                Log.i(TAG, "Direct call placed to " + phone);
                call.resolve();
            } else {
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.setData(Uri.parse("tel:" + phone));
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(dialIntent);
                Log.i(TAG, "ACTION_DIAL fallback opened for " + phone);
                call.resolve();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to place call", e);
            call.reject("Failed to place call: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearAlarms(PluginCall call) {
        try {
            AlarmScheduler.cancelAll(getContext());
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear alarms", e);
            call.reject("Failed to clear alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getScheduledAlarms(PluginCall call) {
        try {
            String saved = AlarmScheduler.getSavedMedications(getContext());
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String elderId = prefs.getString("elder_id", "");

            JSObject ret = new JSObject();
            ret.put("savedMedications", saved);
            ret.put("autoSnoozeEnabled", AlarmScheduler.isAutoSnoozeEnabled(getContext(), elderId));
            ret.put("autoSnoozeAfterSeconds", AlarmScheduler.getAutoSnoozeAfterSeconds(getContext(), elderId));
            ret.put("alarmSnoozeDuration", AlarmScheduler.getChildSnoozeDuration(getContext(), elderId));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get scheduled alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncAlarmSettings(PluginCall call) {
        try {
            String elderId = call.getString("elderId", "");
            String snoozeText = call.getString("alarmSnoozeText", "Take later");
            Integer snoozeDuration = call.getInt("alarmSnoozeDuration", 10);
            Boolean autoSnoozeEnabled = call.getBoolean("autoSnoozeEnabled", false);
            Integer autoSnoozeAfterSeconds = call.getInt("autoSnoozeAfterSeconds", 60);
            Boolean stickyNotification = call.getBoolean("stickyAlarmNotification", true);

            AlarmScheduler.saveAlarmSettings(
                getContext(),
                elderId,
                snoozeText,
                snoozeDuration != null ? snoozeDuration : 10,
                autoSnoozeEnabled != null && autoSnoozeEnabled,
                autoSnoozeAfterSeconds != null ? autoSnoozeAfterSeconds : 60,
                stickyNotification == null || stickyNotification
            );

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("autoSnoozeEnabled", autoSnoozeEnabled != null && autoSnoozeEnabled);
            ret.put("autoSnoozeAfterSeconds", autoSnoozeAfterSeconds != null ? autoSnoozeAfterSeconds : 60);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync alarm settings", e);
            call.reject("Failed to sync alarm settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncHealthPreferences(PluginCall call) {
        try {
            String requiredVitals = call.getString("requiredVitals", "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT");
            String elderId = call.getString("elderId", "");
            String elderName = call.getString("elderName", "Elder");
            Boolean healthCheckDone = call.getBoolean("healthCheckDone", false);
            String lastBp = call.getString("bp", "");
            String lastSugar = call.getString("sugar", "");
            String lastSpo2 = call.getString("spo2", "");
            String lastPulse = call.getString("pulse", "");
            String lastTemp = call.getString("temp", "");
            String lastWeight = call.getString("weight", "");
            String lastDate = call.getString("date", "");

            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit()
                .putString("health_required_vitals", requiredVitals);

            if (healthCheckDone != null) editor.putBoolean("health_check_done_today", healthCheckDone);
            if (elderId != null && !elderId.isEmpty()) editor.putString("elder_id", elderId);
            if (elderName != null && !elderName.isEmpty()) editor.putString("elder_name", elderName);
            if (lastBp != null && !lastBp.isEmpty()) editor.putString("vital_last_bp", lastBp);
            if (lastSugar != null && !lastSugar.isEmpty()) editor.putString("vital_last_sugar", lastSugar);
            if (lastSpo2 != null && !lastSpo2.isEmpty()) editor.putString("vital_last_spo2", lastSpo2);
            if (lastPulse != null && !lastPulse.isEmpty()) editor.putString("vital_last_pulse", lastPulse);
            if (lastTemp != null && !lastTemp.isEmpty()) editor.putString("vital_last_temp", lastTemp);
            if (lastWeight != null && !lastWeight.isEmpty()) editor.putString("vital_last_weight", lastWeight);
            if (lastDate != null && !lastDate.isEmpty()) editor.putString("health_vitals_date", lastDate);

            editor.apply();

            HealthCheckWidgetProvider.updateAllWidgets(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            Log.i(TAG, "Health check widget preferences synced: " + requiredVitals + ", doneToday=" + healthCheckDone);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync health preferences to widget", e);
            call.reject("Failed to sync health preferences: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getHealthWidgetData(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            JSObject ret = new JSObject();
            ret.put("requiredVitals", prefs.getString("health_required_vitals", "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT"));
            ret.put("vitalsDate", prefs.getString("health_vitals_date", ""));
            ret.put("checkDoneToday", prefs.getBoolean("health_check_done_today", false));
            ret.put("bp", prefs.getString("vital_last_bp", ""));
            ret.put("sugar", prefs.getString("vital_last_sugar", ""));
            ret.put("spo2", prefs.getString("vital_last_spo2", ""));
            ret.put("pulse", prefs.getString("vital_last_pulse", ""));
            ret.put("temp", prefs.getString("vital_last_temp", ""));
            ret.put("weight", prefs.getString("vital_last_weight", ""));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get health widget data: " + e.getMessage());
        }
    }
}
