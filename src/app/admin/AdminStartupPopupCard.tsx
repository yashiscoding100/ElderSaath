"use client"

import { useState } from "react"
import Link from "next/link"
import { Film, Image as ImageIcon, FileText, Settings, ExternalLink } from "lucide-react"
import { StartupPopupConfig } from "@/lib/startupPopup"

export function AdminStartupPopupCard({ initialConfig }: { initialConfig: StartupPopupConfig }) {
  const [config, setConfig] = useState<StartupPopupConfig>(initialConfig)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleToggle = async () => {
    const nextState = !config.enabled
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/startup-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState })
      })

      if (res.ok) {
        const data = await res.json()
        setConfig(prev => ({ ...prev, enabled: nextState }))
        setMessage(
          nextState
            ? "🟢 Startup popup is now ENABLED! Users will see it when opening the app or website."
            : "⚪ Startup popup has been DISABLED. App and website will open normally without popups."
        )
        setTimeout(() => setMessage(null), 5000)
      } else {
        const err = await res.json()
        alert("Failed to toggle: " + (err.message || "Unknown error"))
      }
    } catch (e: any) {
      alert("Network error: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = () => {
    switch (config.type) {
      case "VIDEO":
        return <Film className="w-4 h-4 text-rose-500" />
      case "IMAGE":
        return <ImageIcon className="w-4 h-4 text-blue-500" />
      default:
        return <FileText className="w-4 h-4 text-indigo-500" />
    }
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">📢</span>
            <h3 className="text-xl font-bold text-slate-900">App Startup Announcement / Media</h3>
            <span
              className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                config.enabled
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${config.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {config.enabled ? "ACTIVE (Appearing on App Start)" : "DISABLED (Turned OFF)"}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Controls whether the startup announcement, photo, or video plays whenever a user launches the Android app, iOS app, or website.
          </p>
        </div>

        {/* Master Power Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 min-w-[150px] disabled:opacity-50 ${
              config.enabled
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
            }`}
          >
            {loading ? (
              "Updating..."
            ) : config.enabled ? (
              <>
                <span>🚫</span> Disable Popup
              </>
            ) : (
              <>
                <span>✅</span> Enable Popup
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          config.enabled 
            ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}>
          {message}
        </div>
      )}

      {/* Current Configuration Summary */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {getTypeIcon()}
            <span>Type: {config.type}</span>
          </div>
          <p className="text-sm font-bold text-slate-800">
            {config.title || "No title set"}
          </p>
          {config.message && (
            <p className="text-xs text-slate-500 line-clamp-1">
              {config.message}
            </p>
          )}
        </div>

        <Link
          href="/admin/notices"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition self-start sm:self-auto shrink-0 shadow-sm"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          Edit Media & Notice Content
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Link>
      </div>
    </div>
  )
}
