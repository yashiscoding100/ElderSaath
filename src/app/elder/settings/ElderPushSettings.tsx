"use client"

import { useState } from "react"
import { Bell, AlertTriangle } from "lucide-react"

export function ElderPushSettings() {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <div className="p-6 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-900">Push Notifications & Alarms</h4>
          <p className="text-sm text-slate-500 mt-1">Manage alarms and phone wake-up permissions.</p>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-700 text-sm hover:bg-slate-100 transition shrink-0"
        >
          View Guide
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Alarm & Notification Setup Guide
        </h4>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
        >
          Close
        </button>
      </div>

      <div className="space-y-4 max-w-xl">
        {/* Xiaomi / Redmi / POCO Specific Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-slate-800">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Critical for Xiaomi / Redmi / POCO Users</span>
          </div>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            By default, MIUI / HyperOS blocks apps from opening screens automatically in the background. To make sure the alarm pops up automatically:
          </p>
          <div className="space-y-2 text-xs bg-white p-3 rounded-lg border border-amber-200 font-medium">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-sm">🔴 ➔ 🟢</span>
              <div>
                <strong>&quot;Display pop-up windows while running in the background&quot;</strong> ➔ Set to <strong className="text-emerald-700">&quot;Always allow&quot;</strong> (This is the exact reason it wasn&apos;t popping up!).
              </div>
            </div>
            <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
              <span className="shrink-0 text-sm">🔴 ➔ 🟢</span>
              <div>
                <strong>&quot;Show on Lock screen&quot;</strong> ➔ Set to <strong className="text-emerald-700">&quot;Always allow&quot;</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* General Android Instructions */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-sm">
          <h5 className="font-bold text-slate-800 mb-2">How to find these settings:</h5>
          <ol className="list-decimal pl-5 text-slate-700 space-y-1.5 text-xs font-medium">
            <li>Go to <strong>Settings</strong> ➔ <strong>Apps</strong> ➔ <strong>Manage apps</strong></li>
            <li>Select <strong>Elder Saath</strong></li>
            <li>Tap <strong>Other permissions</strong> to enable the two options above</li>
            <li>Tap <strong>Battery saver</strong> and set to <strong>No restrictions</strong></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
