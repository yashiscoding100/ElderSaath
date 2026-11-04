"use client"

import { useState, useRef, useEffect } from "react"
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  CheckCircle2,
  Music,
  Loader2,
  Bell,
  Sparkles,
  Smartphone,
  Info
} from "lucide-react"
import { AlarmToneConfig, PRESET_ALARM_TONES } from "@/lib/alarmToneConfig"

export function AdminAlarmToneCard({ initialConfig }: { initialConfig: AlarmToneConfig }) {
  const [config, setConfig] = useState<AlarmToneConfig>(initialConfig)
  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Audio Preview State
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // Stop audio if tone URL changes or unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [config.toneUrl])

  const toggleAudioPreview = (urlToPlay?: string) => {
    let targetUrl = urlToPlay || config.toneUrl
    if (!targetUrl) {
      alert("No audio URL available to preview.")
      return
    }

    if (targetUrl.startsWith("/") && typeof window !== "undefined") {
      targetUrl = window.location.origin + targetUrl
    }

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsPlaying(false)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audio = new Audio(targetUrl)
      audioRef.current = audio
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => {
        setIsPlaying(false)
        alert("Failed to play audio preview. Please check the audio URL format.")
      }
      audio.play().then(() => setIsPlaying(true)).catch((e) => {
        setIsPlaying(false)
        alert("Audio play error: " + e.message)
      })
    }
  }

  // Quick Power Toggle
  const handleTogglePower = async () => {
    const nextState = !config.enabled
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/alarm-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          enabled: nextState
        })
      })

      const data = await res.json()
      if (res.ok) {
        setConfig(prev => ({ ...prev, enabled: nextState }))
        setMessage({
          type: "success",
          text: nextState
            ? `🟢 Custom alarm tone enabled for all users (${config.toneTitle || "Selected Tone"}).`
            : "⚪ Custom alarm tone disabled. All devices will ring with their phone's native system default tone."
        })
      } else {
        setMessage({ type: "error", text: data.message || "Failed to toggle status." })
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "Network error: " + e.message })
    } finally {
      setLoading(false)
    }
  }

  // Handle Audio File Upload
  const handleFileUpload = async (file: File) => {
    if (!file) return

    setUploadLoading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/admin/alarm-tone/upload", {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      if (res.ok && data.url) {
        setConfig(prev => ({
          ...prev,
          toneUrl: data.url,
          toneTitle: file.name.replace(/\.[^/.]+$/, ""),
          tonePreset: "CUSTOM_UPLOAD"
        }))
        setMessage({
          type: "success",
          text: `✓ Uploaded "${file.name}" successfully! Click 'Save Alarm Tone' to apply it to all devices.`
        })
      } else {
        setMessage({ type: "error", text: data.message || "File upload failed." })
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "Upload error: " + e.message })
    } finally {
      setUploadLoading(false)
    }
  }

  // Save Settings
  const handleSave = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/alarm-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({
          type: "success",
          text: config.enabled
            ? `✓ Settings saved! "${config.toneTitle}" is now active and synced to all devices.`
            : "✓ Settings saved! Using phone system default alarm tone for all users."
        })
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save settings." })
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "Save error: " + e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${config.enabled ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
              <Music className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Global Alarm Tone Controls</h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  All Users
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Choose whether all user devices hear a custom uploaded melody or their phone&apos;s native system default alarm tone.
              </p>
            </div>
          </div>

          {/* Quick Power Switch */}
          <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900">Custom Tone</p>
              <p className="text-[11px] text-slate-500 font-medium">
                {config.enabled ? "Active" : "Disabled (Using System)"}
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleTogglePower}
              className={`w-14 h-7 rounded-full relative transition-colors p-1 ${
                config.enabled ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-md ${
                  config.enabled ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mt-4 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 animate-fade-in ${
            message.type === "success" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}>
            <Info className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Status Callout */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          config.enabled ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            {config.enabled ? (
              <Volume2 className="w-5 h-5 text-indigo-600 shrink-0" />
            ) : (
              <Smartphone className="w-5 h-5 text-slate-500 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {config.enabled ? (
                  <>Current Active Tone: <span className="text-indigo-700 underline font-black">{config.toneTitle || "Custom Tone"}</span></>
                ) : (
                  <>Active Mode: <span className="font-bold text-slate-900">Phone System Default Alarm Tone</span></>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {config.enabled
                  ? "When an alarm starts, the app plays this custom tone. If unavailable or offline without cache, it seamlessly falls back to the phone system tone."
                  : "Each user's phone will ring with its standard factory default alarm tone (e.g. Samsung Homecoming, Android Morning Flower)."}
              </p>
            </div>
          </div>

          {/* Audio Preview Button (if custom tone has a URL) */}
          {config.toneUrl && (
            <button
              type="button"
              onClick={() => toggleAudioPreview()}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 shadow-sm flex items-center gap-2 transition shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-indigo-600 fill-current" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-indigo-600 fill-current" />
                  <span>Play Tone</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Tone Configuration Controls */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Select Tone Source
          </label>

          {/* Presets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {PRESET_ALARM_TONES.map(preset => {
              const isSelected = config.tonePreset === preset.id
              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    setConfig(prev => ({
                      ...prev,
                      tonePreset: preset.id,
                      toneTitle: preset.name,
                      toneUrl: preset.url
                    }))
                    if (isPlaying) {
                      toggleAudioPreview(preset.url)
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {preset.category}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="font-bold text-sm text-slate-900 mt-2">{preset.name}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleAudioPreview(preset.url)
                    }}
                    className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 fill-current text-slate-600" />
                    <span>Listen</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Custom File Upload Option */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Or Upload Custom Tone from Device (MP3, WAV, OGG, M4A)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-sm group-hover:scale-110 transition flex items-center justify-center">
                {uploadLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="font-bold text-sm text-slate-800">
                  {uploadLoading
                    ? "Uploading audio file..."
                    : "Click to browse & upload a custom audio ring tone from your phone or PC"}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supports MP3, WAV, M4A, OGG, AAC (Max 4.5 MB)
                </p>
              </div>
            </div>

            {/* Custom Upload Badge */}
            {config.tonePreset === "CUSTOM_UPLOAD" && config.toneUrl && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-semibold">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Active Custom File: {config.toneTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAudioPreview(config.toneUrl)}
                  className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-emerald-700 transition"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Preview</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual URL Input */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Custom Audio Web Link (Optional)
            </label>
            <input
              type="text"
              value={config.toneUrl}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                toneUrl: e.target.value,
                tonePreset: "CUSTOM_UPLOAD"
              }))}
              placeholder="e.g. https://domain.com/my-tone.mp3 or data:audio/..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Changes take effect across all devices (all users) upon the next synchronization.
          </p>

          <button
            type="button"
            disabled={loading || uploadLoading}
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Tone Settings...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Alarm Tone Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
