"use client"

import { useState } from "react"
import { BellRing, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

export function ElderAlarmSettings({ 
  elderId, 
  elderName,
  initialSnoozeText,
  initialSnoozeDuration,
  initialCanManageMeds, 
  initialStickyAlarmNotification,
  initialUiStyle = "MODERN"
}: { 
  elderId: string, 
  elderName: string,
  initialSnoozeText: string,
  initialSnoozeDuration: number,
  initialCanManageMeds: boolean,
  initialStickyAlarmNotification?: boolean,
  initialUiStyle?: "MODERN" | "CLASSIC"
}) {
  const router = useRouter()
  const [snoozeText, setSnoozeText] = useState(initialSnoozeText)
  const [snoozeDuration, setSnoozeDuration] = useState(initialSnoozeDuration)
  const [canManageMeds, setCanManageMeds] = useState(initialCanManageMeds)
  const [stickyAlarmNotification, setStickyAlarmNotification] = useState(initialStickyAlarmNotification ?? true)
  const [uiStyle, setUiStyle] = useState<"MODERN" | "CLASSIC">(initialUiStyle)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch("/api/child/elder-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          elderId, 
          alarmSnoozeText: snoozeText, 
          alarmSnoozeDuration: snoozeDuration, 
          canManageMeds, 
          stickyAlarmNotification,
          uiStyle
        })
      })
      alert("Elder Settings saved!")
      router.refresh()
    } catch (e) {
      alert("Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <BellRing className="w-5 h-5 text-blue-600" />
            Display & Alarm Controls
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure layout style, alarms, and permissions for {elderName}.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm shadow-sm"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Elder Screen Display Style Switcher */}
      <div className="mb-6 pb-6 border-b border-slate-100">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Elder Screen Display Mode
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Select which home screen experience {elderName} sees on their phone.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUiStyle("MODERN")}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              uiStyle === "MODERN"
                ? "border-blue-600 bg-blue-50/80 shadow-xs"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <span>✨</span> Modern Friendly
              </span>
              {uiStyle === "MODERN" && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              )}
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Next-dose hero card, vitals overview, clean action hub. (Recommended default)
            </p>
          </button>

          <button
            type="button"
            onClick={() => setUiStyle("CLASSIC")}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              uiStyle === "CLASSIC"
                ? "border-blue-600 bg-blue-50/80 shadow-xs"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <span>🧸</span> Classic Simple
              </span>
              {uiStyle === "CLASSIC" && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              )}
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Extra-large touch cards, high-contrast simple layout with minimal text.
            </p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snooze Button Text</label>
          <input 
            type="text" 
            className="w-full border border-slate-200 p-2 rounded-lg font-medium focus:border-blue-500 outline-none" 
            value={snoozeText} 
            onChange={e => setSnoozeText(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snooze Duration (Minutes)</label>
          <input 
            type="number" 
            min="1"
            className="w-full border border-slate-200 p-2 rounded-lg font-medium focus:border-blue-500 outline-none" 
            value={snoozeDuration} 
            onChange={e => setSnoozeDuration(Number(e.target.value))} 
          />
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="pr-4">
          <h4 className="font-bold text-slate-900 text-sm">Allow Elder to Manage Meds</h4>
          <p className="text-sm text-slate-500 mt-1">Allows the elder to add or delete their own medicines.</p>
        </div>
        <button
          type="button"
          onClick={() => setCanManageMeds(!canManageMeds)}
          className={`w-12 h-6 rounded-full relative transition-colors ${canManageMeds ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${canManageMeds ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
      
      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-700 text-sm">Sticky Alarm Notification</p>
          <p className="text-xs text-slate-500">Show a persistent tray notification during full-screen alarms.</p>
        </div>
        <button 
          type="button"
          onClick={() => setStickyAlarmNotification(!stickyAlarmNotification)}
          className={`w-12 h-6 rounded-full relative transition-colors ${stickyAlarmNotification ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${stickyAlarmNotification ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  )
}
