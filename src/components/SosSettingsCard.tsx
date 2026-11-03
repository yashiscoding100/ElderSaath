"use client"

import { useState, useEffect } from "react"
import { PhoneCall, BellRing, Volume2, ShieldAlert, CheckCircle2, Loader2, Ambulance } from "lucide-react"

interface SosConfig {
  ambulanceNumber: string
  sosCallAmbulance: boolean
  sosAlertFamily: boolean
  sosLocalSiren: boolean
  sosCustomPhone: string
}

export function SosSettingsCard({ elderId, isChild }: { elderId?: string, isChild?: boolean }) {
  const [config, setConfig] = useState<SosConfig>({
    ambulanceNumber: "108",
    sosCallAmbulance: true,
    sosAlertFamily: true,
    sosLocalSiren: true,
    sosCustomPhone: ""
  })
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

            // Sync with Android Native Widget SharedPreferences if on Android
            const AlarmSyncPlugin = (window as any).Capacitor?.Plugins?.AlarmSyncPlugin
            if (AlarmSyncPlugin?.syncSosSettings) {
              AlarmSyncPlugin.syncSosSettings({
                ambulanceNumber: data.config.ambulanceNumber,
                sosCallAmbulance: data.config.sosCallAmbulance,
                sosAlertFamily: data.config.sosAlertFamily,
                sosLocalSiren: data.config.sosLocalSiren,
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
            sosAlertFamily: config.sosAlertFamily,
            sosLocalSiren: config.sosLocalSiren,
            elderId: elderId || ""
          })
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
    { label: "102 (Free Ambulance)", value: "102" },
    { label: "112 (All Emergencies)", value: "112" },
  ]

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-red-100 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-2xl text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              SOS Widget &amp; Emergency Configuration
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Control what happens when the 1-Tap SOS button or Home Screen Widget is clicked.
            </p>
          </div>
        </div>
      </div>

      {/* Ambulance Number Configuration */}
      <div className="space-y-3 bg-red-50/50 p-5 rounded-2xl border border-red-100">
        <label className="text-xs font-bold uppercase tracking-wider text-red-900 flex items-center gap-2">
          <Ambulance className="w-4 h-4 text-red-600" />
          Ambulance / Emergency Service Phone Number
        </label>
        
        {/* Preset Pills */}
        <div className="flex flex-wrap gap-2">
          {PRESET_NUMBERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setConfig({ ...config, ambulanceNumber: p.value })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                config.ambulanceNumber === p.value
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={config.ambulanceNumber}
            onChange={(e) => setConfig({ ...config, ambulanceNumber: e.target.value })}
            placeholder="e.g. 108 or custom hospital phone"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>
        <p className="text-[11px] text-slate-500">
          When the SOS widget is pressed, this number will be automatically sent to the phone's native dialer.
        </p>
      </div>

      {/* Functionality Toggles */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Widget Actions (Select which functions execute on click)
        </label>

        {/* Toggle 1: Family Siren */}
        <div
          onClick={() => setConfig({ ...config, sosAlertFamily: !config.sosAlertFamily })}
          className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-4 ${
            config.sosAlertFamily ? "bg-red-50/40 border-red-500" : "bg-slate-50 border-slate-200 opacity-70"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${config.sosAlertFamily ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500"}`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Sound Alarm on All Family Devices</p>
              <p className="text-xs text-slate-500">
                Immediately rings a continuous loud emergency siren on all children and caregiver phones.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.sosAlertFamily}
            onChange={() => {}}
            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
          />
        </div>

        {/* Toggle 2: Auto-Dial Ambulance */}
        <div
          onClick={() => setConfig({ ...config, sosCallAmbulance: !config.sosCallAmbulance })}
          className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-4 ${
            config.sosCallAmbulance ? "bg-red-50/40 border-red-500" : "bg-slate-50 border-slate-200 opacity-70"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${config.sosCallAmbulance ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500"}`}>
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Auto-Open Phone Dialer to Ambulance</p>
              <p className="text-xs text-slate-500">
                Instantly launches the phone's native dialer with <strong>{config.ambulanceNumber || "108"}</strong> ready to call.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.sosCallAmbulance}
            onChange={() => {}}
            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
          />
        </div>

        {/* Toggle 3: Local Siren on this Device */}
        <div
          onClick={() => setConfig({ ...config, sosLocalSiren: !config.sosLocalSiren })}
          className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-4 ${
            config.sosLocalSiren ? "bg-red-50/40 border-red-500" : "bg-slate-50 border-slate-200 opacity-70"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${config.sosLocalSiren ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500"}`}>
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Sound Siren on Elder Phone</p>
              <p className="text-xs text-slate-500">
                Plays loud audio and vibration on the elder's phone so bystanders know help is needed.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.sosLocalSiren}
            onChange={() => {}}
            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2 flex items-center justify-between">
        {savedSuccess ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings synced to Android Home Screen Widget!</span>
          </div>
        ) : (
          <span />
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>Save SOS Widget Rules</span>
        </button>
      </div>
    </div>
  )
}
