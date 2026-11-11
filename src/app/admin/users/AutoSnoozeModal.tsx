"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type AutoSnoozeModalProps = {
  user: {
    id: string
    name: string | null
    email: string | null
    role: string
    autoSnoozeEnabled?: boolean
    autoSnoozeAfterSeconds?: number
    alarmSnoozeDuration?: number | null
  }
}

function formatCompactDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`
  }
  return `${seconds}s`
}

export function AutoSnoozeModal({ user }: AutoSnoozeModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const initialEnabled = Boolean(user.autoSnoozeEnabled)
  const initialTotalSeconds = user.autoSnoozeAfterSeconds && user.autoSnoozeAfterSeconds >= 5
    ? user.autoSnoozeAfterSeconds
    : 60

  const [enabled, setEnabled] = useState(initialEnabled)
  const [unit, setUnit] = useState<"SECONDS" | "MINUTES">(
    initialTotalSeconds >= 60 && initialTotalSeconds % 60 === 0 ? "MINUTES" : "SECONDS"
  )
  const [valueInput, setValueInput] = useState<number>(
    initialTotalSeconds >= 60 && initialTotalSeconds % 60 === 0
      ? initialTotalSeconds / 60
      : initialTotalSeconds
  )

  useEffect(() => {
    if (isOpen) {
      const en = Boolean(user.autoSnoozeEnabled)
      const sec = user.autoSnoozeAfterSeconds && user.autoSnoozeAfterSeconds >= 5
        ? user.autoSnoozeAfterSeconds
        : 60
      setEnabled(en)
      if (sec >= 60 && sec % 60 === 0) {
        setUnit("MINUTES")
        setValueInput(sec / 60)
      } else {
        setUnit("SECONDS")
        setValueInput(sec)
      }
    }
  }, [isOpen, user.autoSnoozeEnabled, user.autoSnoozeAfterSeconds])

  const computedTotalSeconds = unit === "MINUTES"
    ? Math.round(Number(valueInput || 0) * 60)
    : Math.round(Number(valueInput || 0))

  const applyPreset = (seconds: number) => {
    if (seconds >= 60 && seconds % 60 === 0) {
      setUnit("MINUTES")
      setValueInput(seconds / 60)
    } else {
      setUnit("SECONDS")
      setValueInput(seconds)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (enabled && (computedTotalSeconds < 5 || computedTotalSeconds > 3600)) {
      alert("Please set auto-snooze trigger time between 5 seconds and 60 minutes (3600 seconds).")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          autoSnoozeEnabled: enabled,
          autoSnoozeAfterSeconds: enabled ? computedTotalSeconds : initialTotalSeconds
        })
      })

      if (res.ok) {
        setIsOpen(false)
        router.refresh()
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(`Failed to save auto-snooze settings: ${errData.message || res.statusText}`)
      }
    } catch (err) {
      alert("Error saving settings: " + String(err))
    } finally {
      setLoading(false)
    }
  }

  const badgeLabel = user.autoSnoozeEnabled
    ? `⏱️ Auto-Snooze: ${formatCompactDuration(user.autoSnoozeAfterSeconds || 60)}`
    : "⏱️ Auto-Snooze: OFF"

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`font-bold text-xs sm:text-sm px-3 py-1 rounded-md transition border ${
          user.autoSnoozeEnabled
            ? "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
        }`}
        title="Configure per-account automatic alarm snoozing"
      >
        {badgeLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>⏱️</span> Auto-Snooze Control
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Account: {user.name || user.email} ({user.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Master Enable/Disable Switch */}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  enabled
                    ? "bg-violet-50 border-violet-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="pr-3">
                  <p className="text-sm font-bold text-slate-900">
                    {enabled ? "Auto-Snooze Enabled" : "Auto-Snooze Disabled (Default)"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    When enabled, unanswered alarms will automatically snooze after the countdown below.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {/* Trigger Time Controls */}
              {enabled && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Quick Presets (Auto-Snooze After)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "15 sec", sec: 15 },
                        { label: "30 sec", sec: 30 },
                        { label: "45 sec", sec: 45 },
                        { label: "1 min", sec: 60 },
                        { label: "2 min", sec: 120 },
                        { label: "3 min", sec: 180 },
                        { label: "5 min", sec: 300 }
                      ].map((preset) => (
                        <button
                          key={preset.sec}
                          type="button"
                          onClick={() => applyPreset(preset.sec)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            computedTotalSeconds === preset.sec
                              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Auto-Snooze If Unanswered After
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={unit === "SECONDS" ? 5 : 1}
                        max={unit === "SECONDS" ? 3600 : 60}
                        required
                        value={valueInput}
                        onChange={(e) => setValueInput(Math.max(1, Number(e.target.value)))}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                      <select
                        value={unit}
                        onChange={(e) => {
                          const newUnit = e.target.value as "SECONDS" | "MINUTES"
                          if (newUnit === "MINUTES" && unit === "SECONDS") {
                            setValueInput(Math.max(1, Math.round(valueInput / 60)))
                          } else if (newUnit === "SECONDS" && unit === "MINUTES") {
                            setValueInput(valueInput * 60)
                          }
                          setUnit(newUnit)
                        }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-violet-500 outline-none"
                      >
                        <option value="SECONDS">Seconds</option>
                        <option value="MINUTES">Minutes</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      After ringing for <strong className="text-slate-800">{computedTotalSeconds} seconds</strong> with no response, the alarm will automatically snooze and ring again in{" "}
                      <strong className="text-violet-700">{user.alarmSnoozeDuration || 10} minutes</strong> (configured by caregiver). Stored directly on device memory.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition shadow-md shadow-violet-600/20"
                >
                  {loading ? "Saving..." : "Save Auto-Snooze"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
