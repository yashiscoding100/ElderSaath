package com.eldersaath.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class QuickVitalsActivity extends Activity {
    private static final String TAG = "QuickVitalsActivity";
    private static final String PREF_NAME = "ElderSaathAlarms";

    private View layoutBp;
    private View layoutSugar;
    private View layoutSpo2;
    private View layoutPulse;
    private View layoutTemp;
    private View layoutWeight;

    private EditText etBpSys;
    private EditText etBpDia;
    private EditText etSugar;
    private EditText etSpo2;
    private EditText etPulse;
    private EditText etTemp;
    private EditText etWeight;

    private Button btnSave;
    private TextView btnClose;
    private TextView btnCancel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_vitals);

        // Adjust floating dialog card width for mobile/tablet screens
        DisplayMetrics dm = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(dm);
        int width = (int) (dm.widthPixels * 0.92);
        int maxWidth = (int) (480 * dm.density);
        if (width > maxWidth) width = maxWidth;

        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.width = width;
        params.height = WindowManager.LayoutParams.WRAP_CONTENT;
        params.gravity = Gravity.CENTER;
        getWindow().setAttributes(params);

        // Bind layout views
        layoutBp = findViewById(R.id.layout_vital_bp);
        layoutSugar = findViewById(R.id.layout_vital_sugar);
        layoutSpo2 = findViewById(R.id.layout_vital_spo2);
        layoutPulse = findViewById(R.id.layout_vital_pulse);
        layoutTemp = findViewById(R.id.layout_vital_temp);
        layoutWeight = findViewById(R.id.layout_vital_weight);

        etBpSys = findViewById(R.id.et_bp_sys);
        etBpDia = findViewById(R.id.et_bp_dia);
        etSugar = findViewById(R.id.et_sugar);
        etSpo2 = findViewById(R.id.et_spo2);
        etPulse = findViewById(R.id.et_pulse);
        etTemp = findViewById(R.id.et_temp);
        etWeight = findViewById(R.id.et_weight);

        btnSave = findViewById(R.id.btn_save_vitals);
        btnClose = findViewById(R.id.btn_close_dialog);
        btnCancel = findViewById(R.id.btn_cancel_vitals);

        final SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        final String requiredVitals = prefs.getString("health_required_vitals", "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT");

        // CRITICAL RULE: Honor child's configuration. ONLY show configured vitals!
        layoutBp.setVisibility(requiredVitals.contains("BP") ? View.VISIBLE : View.GONE);
        layoutSugar.setVisibility(requiredVitals.contains("SUGAR") ? View.VISIBLE : View.GONE);
        layoutSpo2.setVisibility(requiredVitals.contains("SPO2") ? View.VISIBLE : View.GONE);
        layoutPulse.setVisibility(requiredVitals.contains("PULSE") ? View.VISIBLE : View.GONE);
        layoutTemp.setVisibility(requiredVitals.contains("TEMP") ? View.VISIBLE : View.GONE);
        layoutWeight.setVisibility(requiredVitals.contains("WEIGHT") ? View.VISIBLE : View.GONE);

        // Pre-populate if already entered today
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String todayStr = sdf.format(new Date());
        if (todayStr.equals(prefs.getString("health_vitals_date", ""))) {
            String lastBp = prefs.getString("vital_last_bp", "");
            if (lastBp.contains("/")) {
                String[] parts = lastBp.split("/");
                etBpSys.setText(parts[0].trim());
                if (parts.length > 1) etBpDia.setText(parts[1].trim());
            } else if (!lastBp.isEmpty()) {
                etBpSys.setText(lastBp);
            }
            etSugar.setText(prefs.getString("vital_last_sugar", ""));
            etSpo2.setText(prefs.getString("vital_last_spo2", ""));
            etPulse.setText(prefs.getString("vital_last_pulse", ""));
            etTemp.setText(prefs.getString("vital_last_temp", ""));
            etWeight.setText(prefs.getString("vital_last_weight", ""));
        }

        // Dismiss handlers
        btnClose.setOnClickListener(v -> finish());
        btnCancel.setOnClickListener(v -> finish());

        // Save handler
        btnSave.setOnClickListener(v -> {
            String sys = etBpSys.getText().toString().trim();
            String dia = etBpDia.getText().toString().trim();
            String sugar = etSugar.getText().toString().trim();
            String spo2 = etSpo2.getText().toString().trim();
            String pulse = etPulse.getText().toString().trim();
            String temp = etTemp.getText().toString().trim();
            String weight = etWeight.getText().toString().trim();

            String bp = "";
            if (!sys.isEmpty() && !dia.isEmpty()) {
                bp = sys + "/" + dia;
            } else if (!sys.isEmpty()) {
                bp = sys;
            }

            // Verify at least one measurement entered
            boolean hasAny = (!bp.isEmpty() && requiredVitals.contains("BP")) ||
                             (!sugar.isEmpty() && requiredVitals.contains("SUGAR")) ||
                             (!spo2.isEmpty() && requiredVitals.contains("SPO2")) ||
                             (!pulse.isEmpty() && requiredVitals.contains("PULSE")) ||
                             (!temp.isEmpty() && requiredVitals.contains("TEMP")) ||
                             (!weight.isEmpty() && requiredVitals.contains("WEIGHT"));

            if (!hasAny) {
                Toast.makeText(this, "Please enter at least one health vital to save.", Toast.LENGTH_SHORT).show();
                return;
            }

            // 1. Immediately update offline SharedPreferences
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("health_vitals_date", todayStr);
            editor.putBoolean("health_check_done_today", true);
            if (!bp.isEmpty()) editor.putString("vital_last_bp", bp);
            if (!sugar.isEmpty()) editor.putString("vital_last_sugar", sugar);
            if (!spo2.isEmpty()) editor.putString("vital_last_spo2", spo2);
            if (!pulse.isEmpty()) editor.putString("vital_last_pulse", pulse);
            if (!temp.isEmpty()) editor.putString("vital_last_temp", temp);
            if (!weight.isEmpty()) editor.putString("vital_last_weight", weight);
            editor.apply();

            // 2. Immediately update the Home Screen Widget
            HealthCheckWidgetProvider.updateAllWidgets(this);

            // 3. Post to Server in background thread (sync to cloud & notify family)
            final String finalBp = bp;
            final String finalSugar = sugar;
            final String finalSpo2 = spo2;
            final String finalPulse = pulse;
            final String finalTemp = temp;
            final String finalWeight = weight;
            final String elderId = prefs.getString("elder_id", "");

            new Thread(() -> {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://eldersaath.vercel.app/api/health");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setRequestProperty("x-app-alarm-secret", "ElderSaath-Hardware-Alarm-v1");

                    try {
                        String cookie = CookieManager.getInstance().getCookie("https://eldersaath.vercel.app");
                        if (cookie != null && !cookie.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookie);
                        }
                    } catch (Exception ignored) {}

                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);
                    conn.setDoOutput(true);

                    JSONObject payload = new JSONObject();
                    payload.put("elderId", elderId);
                    payload.put("source", "WIDGET");
                    if (!finalBp.isEmpty()) payload.put("bp", finalBp);
                    if (!finalSugar.isEmpty()) payload.put("sugar", finalSugar);
                    if (!finalSpo2.isEmpty()) payload.put("spo2", finalSpo2);
                    if (!finalPulse.isEmpty()) payload.put("pulse", finalPulse);
                    if (!finalTemp.isEmpty()) payload.put("temperature", finalTemp);
                    if (!finalWeight.isEmpty()) payload.put("weight", finalWeight);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Health vitals posted to server from widget! HTTP Response: " + code);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to post vitals to server (stored locally offline): " + e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }).start();

            // 4. Feedback & instant return to home screen
            Toast.makeText(this, "✓ Health vitals saved! Family notified.", Toast.LENGTH_LONG).show();
            finish();
        });
    }
}
