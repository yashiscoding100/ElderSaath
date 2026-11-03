package com.eldersaath.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
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
    public void syncSosSettings(PluginCall call) {
        try {
            String ambulanceNumber = call.getString("ambulanceNumber", "108");
            Boolean callAmbulance = call.getBoolean("sosCallAmbulance", true);
            Boolean alertFamily = call.getBoolean("sosAlertFamily", true);
            Boolean localSiren = call.getBoolean("sosLocalSiren", true);
            String elderId = call.getString("elderId", "");
            String elderName = call.getString("elderName", "Elder");

            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString("sos_ambulance_number", ambulanceNumber)
                .putBoolean("sos_call_ambulance", callAmbulance != null ? callAmbulance : true)
                .putBoolean("sos_alert_family", alertFamily != null ? alertFamily : true)
                .putBoolean("sos_local_siren", localSiren != null ? localSiren : true)
                .putString("elder_id", elderId)
                .putString("elder_name", elderName)
                .apply();

            SosWidgetProvider.updateAllWidgets(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            Log.i(TAG, "SOS settings synced to widget: ambulance=" + ambulanceNumber + ", dial=" + callAmbulance);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to sync SOS settings", e);
            call.reject("Failed to sync SOS settings: " + e.getMessage());
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
            JSObject ret = new JSObject();
            ret.put("savedMedications", saved);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get scheduled alarms: " + e.getMessage());
        }
    }
}
