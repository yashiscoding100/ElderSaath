"use client"

import { useState, useEffect } from "react"
import { 
  PhoneCall, 
  BellRing, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  Ambulance, 
  MapPin, 
  Battery, 
  Zap, 
  Clock, 
  FileHeart, 
  UserCheck 
} from "lucide-react"
import { SosConfig, DEFAULT_SOS_CONFIG } from "@/lib/sosConfigTypes"

export function SosSettingsCard({ elderId, isChild }: { elderId?: string, isChild?: boolean }) {
  const [config, setConfig] = useState<SosConfig>(DEFAULT_SOS_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true)
      try {
        const url = elderId ? `/api/sos/settings?elderId=${elderId}` : "/api/sos/settings"
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (data?.config) {
            setConfig(data.config)

            // Sync with Android Native Widget SharedPreferences if running on Android
            const AlarmSyncPlugin = (window as any).Capacitor?.Plugins?.AlarmSyncPlugin
            if (AlarmSyncPlugin?.syncSosSettings) {
              AlarmSyncPlugin.syncSosSettings({
                ambulanceNumber: data.config.ambulanceNumber,
                sosCallAmbulance: data.config.sosCallAmbulance,
                sosCallTarget: data.config.sosCallTarget,
                sosCustomPhone: data.config.sosCustomPhone,
                sosAlertFamily: data.config.sosAlertFamily,
                sosLocalSiren: data.config.sosLocalSiren,
                sosSirenMode: data.config.sosSirenMode,
                sosStrobeFlashlight: data.config.sosStrobeFlashlight,
                sosCountdownSeconds: data.config.sosCountdownSeconds,
                elderId: data.elderId || elderId || ""
              }).catch(() => {})
            }
          }
        }
      } catch (e) {
        console.error("Failed to load SOS settings:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [elderId])

  const handleSave = async () => {
    setSaving(true)
    setSavedSuccess(false)
    try {
      const res = await fetch("/api/sos/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId,
          ...config
        })
      })

      if (res.ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)

        // Sync with Android Widget
        const AlarmSyncPlugin = (window as any).Capacitor?.Plugins?.AlarmSyncPlugin
        if (AlarmSyncPlugin?.syncSosSettings) {
          await AlarmSyncPlugin.syncSosSettings({
            ambulanceNumber: config.ambulanceNumber,
            sosCallAmbulance: config.sosCallAmbulance,
            sosCallTarget: config.sosCallTarget,
            sosCustomPhone: config.sosCustomPhone,
            sosAlertFamily: config.sosAlertFamily,
            sosLocalSiren: config.sosLocalSiren,
            sosSirenMode: config.sosSirenMode,
            sosStrobeFlashlight: config.sosStrobeFlashlight,
            sosCountdownSeconds: config.sosCountdownSeconds,
            elderId: elderId || ""
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error("Failed to save SOS settings:", e)
    } finally {
      setSaving(false)
    }
  }

  const PRESET_NUMBERS = [
    { label: "108 (National Ambulance)", value: "108" },
    { label: "102 (Free Govt Ambulance)", value: "102" },
    { label: "112 (All Emergencies / Police)", value: "112" },
  ]

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-red-100 shadow-sm overflow-hidden p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-2xl text-red-600">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Advanced Emergency SOS &amp; Widget
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Pro Safety
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Controls the Android 1-Tap Home Screen SOS Widget, the in-app SOS button, and family siren dispatch.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Settings synced across cloud, Android home-screen widget, and offline hardware engine!
        </div>
      )}

      {/* Section 1: Emergency Calling & Native Direct Dialer */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <PhoneCall className="w-4 h-4 text-red-600" />
          <span>1. Emergency Phone Calling (Native Dialer)</span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-bold text-slate-900 text-sm">Direct Phone Call on Trigger</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically places an outgoing phone call directly through the Android native dialer (0 extra taps).
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosCallAmbulance}
              onChange={(e) => setConfig({ ...config, sosCallAmbulance: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>

          {config.sosCallAmbulance && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Call Target:
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sosCallTarget: "AMBULANCE" })}
                  className={`p-3 rounded-xl border text-left font-bold text-xs transition flex flex-col justify-between ${
                    config.sosCallTarget === "AMBULANCE" 
                      ? "bg-red-50 border-red-500 text-red-900 shadow-sm" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Ambulance className="w-4 h-4 text-red-600" /> Ambulance</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-1">Preset: {config.ambulanceNumber}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sosCallTarget: "CUSTOM" })}
                  className={`p-3 rounded-xl border text-left font-bold text-xs transition flex flex-col justify-between ${
                    config.sosCallTarget === "CUSTOM" 
                      ? "bg-red-50 border-red-500 text-red-900 shadow-sm" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-red-600" /> Custom / Guardian</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-1">{config.sosCustomPhone || "Not set yet"}</span>
                </button>
              </div>

              {config.sosCallTarget === "AMBULANCE" && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-600">Ambulance Number Presets:</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_NUMBERS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setConfig({ ...config, ambulanceNumber: p.value })}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                          config.ambulanceNumber === p.value 
                            ? "bg-red-600 text-white border-red-600 shadow-sm" 
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.sosCallTarget === "CUSTOM" && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter Guardian or Custom Phone Number:
                  </label>
                  <input
                    type="tel"
                    value={config.sosCustomPhone}
                    onChange={(e) => setConfig({ ...config, sosCustomPhone: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Audio & Visual Distress Beacon */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Volume2 className="w-4 h-4 text-red-600" />
          <span>2. Audio Siren &amp; Visual Distress Beacon</span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-bold text-slate-900 text-sm">Local Siren on Elder's Phone</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Sounds an emergency alert on the phone where SOS is triggered.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosLocalSiren}
              onChange={(e) => setConfig({ ...config, sosLocalSiren: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>

          {config.sosLocalSiren && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  config.sosSirenMode === "LOUD" 
                    ? "bg-red-50 border-red-400 text-red-900" 
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <div>
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-red-600" />
                    🔊 Loud Piercing Siren
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Max volume horn to alert nearby people</p>
                </div>
                <input
                  type="radio"
                  name="sirenMode"
                  checked={config.sosSirenMode === "LOUD"}
                  onChange={() => setConfig({ ...config, sosSirenMode: "LOUD" })}
                  className="accent-red-600"
                />
              </label>

              <label 
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  config.sosSirenMode === "SILENT" 
                    ? "bg-red-50 border-red-400 text-red-900" 
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <div>
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <VolumeX className="w-4 h-4 text-slate-600" />
                    🤫 Discreet / Silent SOS
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Alerts family silently with no noise on elder's phone</p>
                </div>
                <input
                  type="radio"
                  name="sirenMode"
                  checked={config.sosSirenMode === "SILENT"}
                  onChange={() => setConfig({ ...config, sosSirenMode: "SILENT" })}
                  className="accent-red-600"
                />
              </label>
            </div>
          )}

          {/* Strobe Flashlight Toggle */}
          <div className="pt-3 border-t border-slate-200">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" /> Camera LED Strobe Beacon
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rapidly strobes the phone's camera flashlight for 15s to signal first responders and passersby in the dark.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.sosStrobeFlashlight}
                onChange={(e) => setConfig({ ...config, sosStrobeFlashlight: e.target.checked })}
                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Section 3: Telemetry, Location & Health Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <MapPin className="w-4 h-4 text-red-600" />
          <span>3. Live Location, Battery &amp; Medical ID Telemetry</span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" /> Live GPS Coordinates
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Captures high-precision GPS coordinates and sends an instant 1-tap Google Maps directions link to family.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosShareLocation}
              onChange={(e) => setConfig({ ...config, sosShareLocation: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer pt-3 border-t border-slate-200">
            <div>
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-emerald-600" /> Phone Battery Level Reporting
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Sends remaining battery percentage so caregivers know if the elder's device is about to run out of charge.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosShareBattery}
              onChange={(e) => setConfig({ ...config, sosShareBattery: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer pt-3 border-t border-slate-200">
            <div>
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileHeart className="w-4 h-4 text-red-600" /> Include Emergency Medical ID &amp; Meds
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically attaches blood group, chronic conditions, allergies, and active medications to the emergency alert.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosIncludeMedicalId}
              onChange={(e) => setConfig({ ...config, sosIncludeMedicalId: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Section 4: Safety & Accidental Press Protection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Clock className="w-4 h-4 text-red-600" />
          <span>4. False Alarm Prevention &amp; Safety Countdown</span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
          <p className="font-bold text-slate-900 text-sm">Cancellation Window Before Dispatch</p>
          <p className="text-xs text-slate-500">
            Prevents accidental pocket touches by sounding warning beeps with an instant CANCEL button before firing alerts.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {[
              { label: "Instant (0s)", value: 0, sub: "Immediate panic" },
              { label: "3 Seconds", value: 3, sub: "Quick cancel" },
              { label: "5 Seconds", value: 5, sub: "Industry standard" },
              { label: "10 Seconds", value: 10, sub: "Maximum safety" },
            ].map((cd) => (
              <button
                key={cd.value}
                type="button"
                onClick={() => setConfig({ ...config, sosCountdownSeconds: cd.value })}
                className={`p-3 rounded-xl border text-left transition ${
                  config.sosCountdownSeconds === cd.value
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className="block font-bold text-xs">{cd.label}</span>
                <span className={`block text-[10px] mt-0.5 ${config.sosCountdownSeconds === cd.value ? "text-red-100" : "text-slate-400"}`}>
                  {cd.sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 5: Family Alert Network */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <BellRing className="w-4 h-4 text-red-600" />
          <span>5. Family Siren Alarm Broadcast</span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-bold text-slate-900 text-sm">Sound Full-Screen Alarm on All Family Phones</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Instantly rings high-urgency siren alarms across all connected children and caregivers' phones with live GPS directions.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sosAlertFamily}
              onChange={(e) => setConfig({ ...config, sosAlertFamily: e.target.checked })}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Save Button Footer */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-base"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>{saving ? "Saving All Settings..." : "Save Emergency Preferences"}</span>
        </button>
      </div>
    </div>
  )
}
