"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { ElderUiStyle } from "@/lib/elderUiPreferences"

export function ElderUiStyleSettings({ initialStyle }: { initialStyle: ElderUiStyle }) {
  const [style, setStyle] = useState<ElderUiStyle>(initialStyle)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSelect = async (newStyle: ElderUiStyle) => {
    setStyle(newStyle)
    localStorage.setItem("es_elder_ui_style", newStyle)
    setSaving(true)
    setSaved(false)

    try {
      await fetch("/api/elder/ui-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: newStyle })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.warn("Error updating UI style:", e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Home Screen Style
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose your preferred display layout.
          </p>
        </div>
        {saved && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md animate-fade-in">
            ✓ Preference Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSelect("MODERN")}
          disabled={saving}
          className={`p-4 rounded-2xl border-2 text-left transition-all ${
            style === "MODERN"
              ? "border-blue-600 bg-blue-50/80 shadow-xs"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <span>✨</span> Modern Friendly
            </span>
            {style === "MODERN" && (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Next-dose reminder card, today&apos;s vitals tiles, and elegant visual cards. (Recommended)
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSelect("CLASSIC")}
          disabled={saving}
          className={`p-4 rounded-2xl border-2 text-left transition-all ${
            style === "CLASSIC"
              ? "border-blue-600 bg-blue-50/80 shadow-xs"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <span>🧸</span> Classic Simple
            </span>
            {style === "CLASSIC" && (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Extra-large touch cards, high-contrast simple layout with minimal text.
          </p>
        </button>
      </div>
    </div>
  )
}
