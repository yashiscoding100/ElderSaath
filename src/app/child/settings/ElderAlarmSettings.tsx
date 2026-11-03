"use client"

import { useState } from "react"
import { BellRing } from "lucide-react"
import { useRouter } from "next/navigation"

export function ElderAlarmSettings({ 
  elderId, 
  elderName,
  initialSnoozeText,
  initialSnoozeDuration,
  initialCanManageMeds, 
  initialStickyAlarmNotification
}: { 
  elderId: string, 
  elderName: string,
  initialSnoozeText: string,
  initialSnoozeDuration: number,
  initialCanManageMeds: boolean,
  initialStickyAlarmNotification?: boolean
}) {
  const router = useRouter()
  const [snoozeText, setSnoozeText] = useState(initialSnoozeText)
  const [snoozeDuration, setSnoozeDuration] = useState(initialSnoozeDuration)
  const [canManageMeds, setCanManageMeds] = useState(initialCanManageMeds)
  const [stickyAlarmNotification, setStickyAlarmNotification] = useState(initialStickyAlarmNotification ?? true)
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
          stickyAlarmNotification 
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
            Alarm & Medication Controls
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure alarm behavior and permissions for {elderName}.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm shadow-sm"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
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
          onClick={() => setStickyAlarmNotification(!stickyAlarmNotification)}
          className={`w-12 h-6 rounded-full relative transition-colors ${stickyAlarmNotification ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${stickyAlarmNotification ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  )
}
