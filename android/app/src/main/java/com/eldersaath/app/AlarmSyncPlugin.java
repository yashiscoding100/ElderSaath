package com.eldersaath.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
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
            JSObject ret = new JSObject();
            ret.put("savedMedications", saved);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get scheduled alarms: " + e.getMessage());
        }
    }
}
