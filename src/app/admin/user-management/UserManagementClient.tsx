"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowUpDown,
  RotateCcw,
  Video,
  Volume2,
  FileText,
  Upload,
  Send,
  Loader2,
  Sparkles
} from "lucide-react"

const DEFAULT_TAKE_BTN_COLOR = "#10B981"
const DEFAULT_SNOOZE_BTN_COLOR = "#334155"

const TAKE_COLOR_PRESETS = [
  { label: "Emerald (Default)", hex: "#10B981" },
  { label: "Royal Blue", hex: "#2563EB" },
  { label: "Crimson Red", hex: "#DC2626" },
  { label: "Amber Gold", hex: "#D97706" },
  { label: "Violet", hex: "#7C3AED" },
  { label: "Cyan Teal", hex: "#0891B2" }
]

const SNOOZE_COLOR_PRESETS = [
  { label: "Slate (Default)", hex: "#334155" },
  { label: "Cool Gray", hex: "#475569" },
  { label: "Warm Amber", hex: "#D97706" },
  { label: "Rose", hex: "#E11D48" },
  { label: "Indigo", hex: "#4F46E5" },
  { label: "Teal", hex: "#0D9488" }
]

function getContrastTextColor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#FFFFFF"
  const clean = hex.slice(1)
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#0F172A" : "#FFFFFF"
}

export type ManagedUserItem = {
  id: string
  name: string | null
  email: string | null
  role: string
  isBlocked: boolean
  blockMessage: string
  notifyVitals: boolean
  notifySnooze: boolean
  canManageMeds: boolean
  alarmSnoozeText: string
  alarmSnoozeDuration: number
  autoSnoozeEnabled: boolean
  autoSnoozeAfterSeconds: number
  alarmButtonOrder: "TAKE_FIRST" | "SNOOZE_FIRST"
  alarmTakeBtnColor: string
  alarmSnoozeBtnColor: string
  stickyAlarmNotification: boolean
  linkedNames: string[]
  createdAt: string
}

function formatDurationLabel(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    const mins = seconds / 60
    return `${mins} min${mins === 1 ? "" : "s"}`
  }
  return `${seconds} sec`
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  accentClass = "peer-checked:bg-violet-600"
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
  accentClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${accentClass}`}
        />
      </label>
    </div>
  )
}

function ManagedUserCard({
  user,
  onUserUpdated
}: {
  user: ManagedUserItem
  onUserUpdated: (updated: ManagedUserItem) => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quickToggling, setQuickToggling] = useState(false)
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const initialUnit: "SECONDS" | "MINUTES" =
    user.autoSnoozeAfterSeconds >= 60 && user.autoSnoozeAfterSeconds % 60 === 0 ? "MINUTES" : "SECONDS"

  const [draft, setDraft] = useState<ManagedUserItem>(user)
  const [timerUnit, setTimerUnit] = useState<"SECONDS" | "MINUTES">(initialUnit)
  const [timerInput, setTimerInput] = useState<string>(
    String(initialUnit === "MINUTES" ? user.autoSnoozeAfterSeconds / 60 : user.autoSnoozeAfterSeconds)
  )
  const [snoozeDurationInput, setSnoozeDurationInput] = useState<string>(
    String(user.alarmSnoozeDuration)
  )

  const parsedTimerNumber = Number(timerInput)
  const isTimerValid = timerInput.trim() !== "" && Number.isFinite(parsedTimerNumber)
  const computedAutoSeconds = isTimerValid
    ? Math.round(timerUnit === "MINUTES" ? parsedTimerNumber * 60 : parsedTimerNumber)
    : 0

  const parsedSnoozeDuration = Number(snoozeDurationInput)
  const isSnoozeDurationValid = snoozeDurationInput.trim() !== "" && Number.isFinite(parsedSnoozeDuration)

  const resetDraftFromUser = () => {
    setDraft(user)
    const u: "SECONDS" | "MINUTES" =
      user.autoSnoozeAfterSeconds >= 60 && user.autoSnoozeAfterSeconds % 60 === 0 ? "MINUTES" : "SECONDS"
    setTimerUnit(u)
    setTimerInput(String(u === "MINUTES" ? user.autoSnoozeAfterSeconds / 60 : user.autoSnoozeAfterSeconds))
    setSnoozeDurationInput(String(user.alarmSnoozeDuration))
    setStatusBanner(null)
  }

  const applyPresetSeconds = (seconds: number) => {
    if (seconds >= 60 && seconds % 60 === 0) {
      setTimerUnit("MINUTES")
      setTimerInput(String(seconds / 60))
    } else {
      setTimerUnit("SECONDS")
      setTimerInput(String(seconds))
    }
  }

  const handleQuickAutoSnoozeToggle = async (nextEnabled: boolean) => {
    setQuickToggling(true)
    setStatusBanner(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          autoSnoozeEnabled: nextEnabled,
          autoSnoozeAfterSeconds: user.autoSnoozeAfterSeconds
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to update Auto-Snooze")
      }
      const nextUser: ManagedUserItem = {
        ...user,
        autoSnoozeEnabled: nextEnabled
      }
      setDraft((prev) => ({ ...prev, autoSnoozeEnabled: nextEnabled }))
      onUserUpdated(nextUser)
      setStatusBanner({
        type: "success",
        text: nextEnabled
          ? `Auto-Snooze ON (${formatDurationLabel(user.autoSnoozeAfterSeconds)}) synced to phone memory.`
          : "Auto-Snooze turned OFF and synced to phone memory."
      })
      router.refresh()
    } catch (err: unknown) {
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to toggle Auto-Snooze"
      })
    } finally {
      setQuickToggling(false)
    }
  }

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.autoSnoozeEnabled && (!isTimerValid || computedAutoSeconds < 5 || computedAutoSeconds > 3600)) {
      setStatusBanner({
        type: "error",
        text: "Auto-Snooze countdown must be between 5 seconds and 60 minutes (3600 seconds)."
      })
      return
    }
    if (!isSnoozeDurationValid || parsedSnoozeDuration < 1 || parsedSnoozeDuration > 180) {
      setStatusBanner({
        type: "error",
        text: "Snooze repeat interval must be between 1 and 180 minutes."
      })
      return
    }

    const safeSnoozeMinutes = Math.round(parsedSnoozeDuration)
    setSaving(true)
    setStatusBanner(null)
    const nextSeconds = draft.autoSnoozeEnabled ? computedAutoSeconds : user.autoSnoozeAfterSeconds
    const safeTakeColor = /^#[0-9A-Fa-f]{6}$/.test(draft.alarmTakeBtnColor)
      ? draft.alarmTakeBtnColor.toUpperCase()
      : DEFAULT_TAKE_BTN_COLOR
    const safeSnoozeColor = /^#[0-9A-Fa-f]{6}$/.test(draft.alarmSnoozeBtnColor)
      ? draft.alarmSnoozeBtnColor.toUpperCase()
      : DEFAULT_SNOOZE_BTN_COLOR

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          autoSnoozeEnabled: draft.autoSnoozeEnabled,
          autoSnoozeAfterSeconds: nextSeconds,
          alarmSnoozeDuration: safeSnoozeMinutes,
          alarmSnoozeText: draft.alarmSnoozeText,
          alarmButtonOrder: draft.alarmButtonOrder,
          alarmTakeBtnColor: safeTakeColor,
          alarmSnoozeBtnColor: safeSnoozeColor,
          stickyAlarmNotification: draft.stickyAlarmNotification,
          canManageMeds: draft.canManageMeds,
          notifyVitals: draft.notifyVitals,
          notifySnooze: draft.notifySnooze,
          isBlocked: draft.isBlocked,
          blockMessage: draft.isBlocked ? draft.blockMessage : null
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Failed to save settings")
      }
      const nextUser: ManagedUserItem = {
        ...draft,
        alarmSnoozeDuration: safeSnoozeMinutes,
        alarmTakeBtnColor: safeTakeColor,
        alarmSnoozeBtnColor: safeSnoozeColor,
        autoSnoozeAfterSeconds: nextSeconds,
        blockMessage: draft.isBlocked ? draft.blockMessage : ""
      }
      setDraft(nextUser)
      setSnoozeDurationInput(String(safeSnoozeMinutes))
      onUserUpdated(nextUser)
      setStatusBanner({
        type: "success",
        text: "All settings saved and synced directly to phone memory."
      })
      router.refresh()
    } catch (err: unknown) {
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings"
      })
    } finally {
      setSaving(false)
    }
  }

  const isElder = user.role === "ELDER"
  const initialLetter = (user.name || user.email || "?").charAt(0).toUpperCase()

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${
        user.isBlocked
          ? "border-rose-200 bg-rose-50/20"
          : user.autoSnoozeEnabled
            ? "border-violet-200"
            : "border-slate-200"
      }`}
    >
      {/* Card Header */}
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 ${
              isElder ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {initialLetter}
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-base font-black text-slate-900 truncate">
                {user.name || "Unnamed User"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                  isElder ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {user.role}
              </span>
              {user.isBlocked && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-rose-600 text-white">
                  Blocked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  user.autoSnoozeEnabled
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                ⏱️ Auto-Snooze: {user.autoSnoozeEnabled ? `ON (${formatDurationLabel(user.autoSnoozeAfterSeconds)})` : "OFF"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                🔔 Snooze: {user.alarmSnoozeDuration}m
              </span>
              {(user.alarmButtonOrder === "SNOOZE_FIRST" ||
                user.alarmTakeBtnColor !== DEFAULT_TAKE_BTN_COLOR ||
                user.alarmSnoozeBtnColor !== DEFAULT_SNOOZE_BTN_COLOR) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  🎨 UI: {user.alarmButtonOrder === "SNOOZE_FIRST" ? "Snooze Top" : "Take Top"}
                </span>
              )}
              {user.linkedNames.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-500">
                  🔗 {isElder ? "Caregiver:" : "Elder:"} {user.linkedNames.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Direct Auto-Snooze Quick Switch + Configure Button */}
        <div className="flex items-center flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Auto-Snooze</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={quickToggling}
                checked={user.autoSnoozeEnabled}
                onChange={(e) => handleQuickAutoSnoozeToggle(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600 peer-disabled:opacity-50" />
            </label>
            <span
              className={`text-xs font-extrabold ${
                user.autoSnoozeEnabled ? "text-violet-700" : "text-slate-500"
              }`}
            >
              {quickToggling ? "..." : user.autoSnoozeEnabled ? "ON" : "OFF"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!expanded) resetDraftFromUser()
              setExpanded((prev) => !prev)
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition ${
              expanded
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{expanded ? "Hide Settings" : "Manage & Set"}</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Inline Feedback when collapsed */}
      {!expanded && statusBanner && (
        <div
          className={`mx-5 mb-4 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
            statusBanner.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {statusBanner.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Expanded Per-User Management Controls */}
      {expanded && (
        <form onSubmit={handleSaveAll} className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Auto-Snooze & Alarm Behavior */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-violet-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>⏱️</span> Auto-Snooze Control
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Automatically snooze unanswered alarms after countdown.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={draft.autoSnoozeEnabled}
                      onChange={(e) => setDraft({ ...draft, autoSnoozeEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                  </label>
                </div>

                {draft.autoSnoozeEnabled && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Quick Countdown Presets
                      </label>
                      <div className="flex flex-wrap gap-1.5">
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
                            onClick={() => applyPresetSeconds(preset.sec)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                              computedAutoSeconds === preset.sec
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Auto-Snooze If Unanswered After
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={timerUnit === "SECONDS" ? 5 : 1}
                          max={timerUnit === "SECONDS" ? 3600 : 60}
                          required={draft.autoSnoozeEnabled}
                          value={timerInput}
                          onChange={(e) => setTimerInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                        />
                        <select
                          value={timerUnit}
                          onChange={(e) => {
                            const next = e.target.value as "SECONDS" | "MINUTES"
                            const baseNum = isTimerValid ? parsedTimerNumber : 0
                            if (next === "MINUTES" && timerUnit === "SECONDS") {
                              setTimerInput(String(Math.max(1, Math.round(baseNum / 60))))
                            } else if (next === "SECONDS" && timerUnit === "MINUTES") {
                              setTimerInput(String(Math.max(5, Math.round(baseNum * 60))))
                            }
                            setTimerUnit(next)
                          }}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                        >
                          <option value="SECONDS">Seconds</option>
                          <option value="MINUTES">Minutes</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 bg-violet-50/70 p-2.5 rounded-lg border border-violet-100 leading-relaxed">
                      Rings for <strong>{computedAutoSeconds} seconds</strong>, then auto-snoozes and rings again after{" "}
                      <strong className="text-violet-700">{draft.alarmSnoozeDuration} minutes</strong>. Stored directly in Android phone memory.
                    </p>
                  </div>
                )}
              </div>

              {/* Manual Snooze & Alarm Preferences */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>🔔</span> Alarm &amp; Snooze Preferences
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Snooze Repeat Duration (Minutes)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={snoozeDurationInput}
                      onChange={(e) => {
                        const raw = e.target.value
                        setSnoozeDurationInput(raw)
                        const parsed = Number(raw)
                        if (raw.trim() !== "" && Number.isFinite(parsed)) {
                          setDraft({ ...draft, alarmSnoozeDuration: Math.round(parsed) })
                        }
                      }}
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setSnoozeDurationInput(String(m))
                            setDraft({ ...draft, alarmSnoozeDuration: m })
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                            draft.alarmSnoozeDuration === m
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Snooze Button Label
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Take later"
                    value={draft.alarmSnoozeText}
                    onChange={(e) => setDraft({ ...draft, alarmSnoozeText: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {isElder && (
                  <ToggleRow
                    label="Sticky Lockscreen Alarm Notification"
                    description="Keep high-priority alarm notification visible on lock screen until handled."
                    checked={draft.stickyAlarmNotification}
                    onChange={(next) => setDraft({ ...draft, stickyAlarmNotification: next })}
                    accentClass="peer-checked:bg-blue-600"
                  />
                )}
              </div>
            </div>

            {/* Column 2: Feature Permissions, Notifications & Access Control */}
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 mb-1">
                  <span>🛡️</span> Feature Permissions & Notifications
                </h4>

                {isElder ? (
                  <ToggleRow
                    label="Can Manage Medications"
                    description="Allow this elder account to add or edit their own medication reminders."
                    checked={draft.canManageMeds}
                    onChange={(next) => setDraft({ ...draft, canManageMeds: next })}
                    accentClass="peer-checked:bg-emerald-600"
                  />
                ) : (
                  <>
                    <ToggleRow
                      label="Receive Vitals Alerts"
                      description="Send push alerts to this caregiver when vitals are logged or abnormal."
                      checked={draft.notifyVitals}
                      onChange={(next) => setDraft({ ...draft, notifyVitals: next })}
                      accentClass="peer-checked:bg-blue-600"
                    />

                    <ToggleRow
                      label="Receive Snooze Notifications"
                      description="Notify this caregiver when an elder's alarm is manually or auto-snoozed."
                      checked={draft.notifySnooze}
                      onChange={(next) => setDraft({ ...draft, notifySnooze: next })}
                      accentClass="peer-checked:bg-amber-600"
                    />
                  </>
                )}
              </div>

              {/* Account Block / Access Toggle */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Account Access Restriction</span>
                </h4>

                <ToggleRow
                  label="Block Account Login"
                  description="Temporarily restrict account access with a custom message."
                  checked={draft.isBlocked}
                  onChange={(next) => setDraft({ ...draft, isBlocked: next })}
                  accentClass="peer-checked:bg-rose-600"
                />

                {draft.isBlocked && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Block Message Shown To User
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Account temporarily suspended. Contact admin."
                      value={draft.blockMessage}
                      onChange={(e) => setDraft({ ...draft, blockMessage: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Alarm Screen UI & Button Layout */}
              <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>🎨</span> Alarm Screen UI &amp; Button Layout
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set top/bottom button positions and button colors on the ringing screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        alarmButtonOrder: "TAKE_FIRST",
                        alarmTakeBtnColor: DEFAULT_TAKE_BTN_COLOR,
                        alarmSnoozeBtnColor: DEFAULT_SNOOZE_BTN_COLOR
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset UI
                  </button>
                </div>

                {/* Button Order Controls */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Button Position (Top vs Bottom)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          alarmButtonOrder: draft.alarmButtonOrder === "TAKE_FIRST" ? "SNOOZE_FIRST" : "TAKE_FIRST"
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      Swap Order
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, alarmButtonOrder: "TAKE_FIRST" })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        draft.alarmButtonOrder === "TAKE_FIRST"
                          ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-black text-slate-900">Take Medicine Top</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">1. Take Medicine • 2. Snooze</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, alarmButtonOrder: "SNOOZE_FIRST" })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        draft.alarmButtonOrder === "SNOOZE_FIRST"
                          ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-black text-slate-900">Snooze on Top</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">1. Snooze • 2. Take Medicine</p>
                    </button>
                  </div>
                </div>

                {/* Button Colors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Take Medicine / Stop Color */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Take Medicine Color</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {draft.alarmTakeBtnColor}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {TAKE_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          title={preset.label}
                          onClick={() => setDraft({ ...draft, alarmTakeBtnColor: preset.hex })}
                          style={{ backgroundColor: preset.hex }}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            draft.alarmTakeBtnColor.toUpperCase() === preset.hex
                              ? "border-slate-900 scale-110 ring-2 ring-indigo-300"
                              : "border-white shadow-xs hover:scale-105"
                          }`}
                        />
                      ))}
                      <label
                        title="Custom color picker"
                        className="w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center overflow-hidden cursor-pointer shadow-xs"
                      >
                        <input
                          type="color"
                          value={draft.alarmTakeBtnColor}
                          onChange={(e) =>
                            setDraft({ ...draft, alarmTakeBtnColor: e.target.value.toUpperCase() })
                          }
                          className="w-8 h-8 -m-1 cursor-pointer border-0 bg-transparent p-0"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Snooze Button Color */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Snooze Button Color</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {draft.alarmSnoozeBtnColor}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {SNOOZE_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          title={preset.label}
                          onClick={() => setDraft({ ...draft, alarmSnoozeBtnColor: preset.hex })}
                          style={{ backgroundColor: preset.hex }}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            draft.alarmSnoozeBtnColor.toUpperCase() === preset.hex
                              ? "border-slate-900 scale-110 ring-2 ring-indigo-300"
                              : "border-white shadow-xs hover:scale-105"
                          }`}
                        />
                      ))}
                      <label
                        title="Custom color picker"
                        className="w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center overflow-hidden cursor-pointer shadow-xs"
                      >
                        <input
                          type="color"
                          value={draft.alarmSnoozeBtnColor}
                          onChange={(e) =>
                            setDraft({ ...draft, alarmSnoozeBtnColor: e.target.value.toUpperCase() })
                          }
                          className="w-8 h-8 -m-1 cursor-pointer border-0 bg-transparent p-0"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Live Phone Alarm Screen Preview */}
                <div className="rounded-2xl bg-gradient-to-b from-[#0F172A] to-[#1E293B] p-4 border border-slate-700 text-center space-y-2.5">
                  <p className="text-[10px] font-extrabold tracking-widest text-sky-400">
                    ⏰ LIVE PHONE ALARM PREVIEW
                  </p>
                  <p className="text-sm font-black text-white">Time for Medicine</p>
                  <div className="flex flex-col gap-2 pt-1">
                    {(() => {
                      const takePreview = (
                        <div
                          key="take"
                          style={{
                            backgroundColor: draft.alarmTakeBtnColor,
                            color: getContrastTextColor(draft.alarmTakeBtnColor)
                          }}
                          className="w-full py-2.5 px-3 rounded-full text-xs font-black tracking-wide shadow"
                        >
                          TAKE MEDICINE / STOP ALARM
                        </div>
                      )
                      const snoozePreview = (
                        <div
                          key="snooze"
                          style={{
                            backgroundColor: draft.alarmSnoozeBtnColor,
                            color: getContrastTextColor(draft.alarmSnoozeBtnColor)
                          }}
                          className="w-full py-2 px-3 rounded-full text-[11px] font-bold border border-white/25 shadow-xs"
                        >
                          {(draft.alarmSnoozeText || "Take later").trim()} ({draft.alarmSnoozeDuration} mins)
                        </div>
                      )
                      return draft.alarmButtonOrder === "SNOOZE_FIRST"
                        ? [snoozePreview, takePreview]
                        : [takePreview, snoozePreview]
                    })()}
                  </div>
                  {draft.autoSnoozeEnabled && (
                    <p className="text-[10px] font-bold text-slate-300 pt-0.5">
                      ⏱️ Auto-snoozing in {computedAutoSeconds}s if no response...
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Emergency SOS alarms keep their fixed red emergency layout for safety.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {user.role === "ELDER" && (
            <ElderSpecialNoticeSection elderId={user.id} elderName={user.name || user.email || "Elder"} />
          )}

          {statusBanner && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                statusBanner.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {statusBanner.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{statusBanner.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={resetDraftFromUser}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md shadow-violet-600/20 disabled:opacity-50 transition"
            >
              {saving ? "Saving & Syncing..." : "Save & Sync to Phone Memory"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function ElderSpecialNoticeSection({ elderId, elderName }: { elderId: string; elderName: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [type, setType] = useState<"TEXT" | "VOICE" | "VIDEO">("TEXT")
  const [text, setText] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [maxCount, setMaxCount] = useState(5)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setBanner(null)
    try {
      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|3gp)$/i.test(file.name)
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string
          const res = await fetch("/api/medications/notice-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || (isVideo ? "video/mp4" : "audio/mpeg"),
              dataUrl
            })
          })
          const data = (await res.json()) as { url?: string; message?: string }
          if (!res.ok || !data.url) throw new Error(data.message || "Upload failed")
          setMediaUrl(data.url)
          setType(isVideo ? "VIDEO" : "VOICE")
          setBanner({ type: "success", text: `✓ ${isVideo ? "Video" : "Audio"} uploaded!` })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed"
          setBanner({ type: "error", text: msg })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "File read failed"
      setBanner({ type: "error", text: msg })
      setUploading(false)
    }
  }

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      const res = await fetch("/api/admin/post-alarm-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId,
          specialNoticeEnabled: enabled,
          specialNoticeType: type,
          specialNoticeText: text,
          specialNoticeAudioUrl: mediaUrl,
          specialNoticeMaxCount: maxCount,
          applyToAllAlarms: true
        })
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message || "Failed to save notice")
      setBanner({
        type: "success",
        text: `✓ Post-alarm notice saved for ${elderName} & synced to device memory!`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save notice"
      setBanner({ type: "error", text: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📢</span>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Post-Alarm Notice (Text, Voice, or Video)</h4>
            <p className="text-xs text-slate-500">Configure text, voice, or video message played after taking medicine on this device.</p>
          </div>
        </div>
        <button type="button" className="p-1 rounded-lg text-slate-500 hover:bg-amber-100/60">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <form onSubmit={handleSaveNotice} className="pt-3 border-t border-amber-200/80 space-y-4">
          <ToggleRow
            label="Enable Post-Alarm Special Notice"
            description="When enabled, the elder will see this notice right after tapping Take Medicine."
            checked={enabled}
            onChange={setEnabled}
            accentClass="peer-checked:bg-amber-600"
          />

          {enabled && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notice Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("TEXT")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      type === "TEXT"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Text Notice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("VOICE")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      type === "VOICE"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Voice Message</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("VIDEO")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      type === "VIDEO"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video Notice</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {type === "VIDEO" ? "Video Caption / Explanation" : "Notice Message"}
                </label>
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    type === "VIDEO"
                      ? "e.g. Please watch this demonstration on using your new medication."
                      : "e.g. Remember to take the smaller blue tablet after your meal."
                  }
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {(type === "VOICE" || type === "VIDEO") && (
                <div className="space-y-2 p-3 bg-white rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {type === "VIDEO" ? "Video File or URL" : "Voice Audio File or URL"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={type === "VIDEO" ? "video/*,.mp4,.webm,.mov,.3gp" : "audio/*,.mp3,.wav,.ogg,.m4a"}
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      <span>{uploading ? "Uploading..." : `Upload ${type === "VIDEO" ? "Video" : "Audio"}`}</span>
                    </button>
                  </div>

                  <input
                    type="url"
                    value={mediaUrl.startsWith("data:") ? "" : mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://.../media-file.mp4"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />

                  {mediaUrl && (
                    <div className="pt-2">
                      {type === "VIDEO" ? (
                        <video controls src={mediaUrl} className="w-full max-h-40 rounded-lg bg-black object-contain" />
                      ) : (
                        <audio controls src={mediaUrl} className="w-full h-8" />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Repeat Limit</label>
                  <p className="text-[11px] text-slate-500">Number of times this notice is shown before auto-stopping.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxCount}
                    onChange={(e) => setMaxCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-center"
                  />
                  <span className="text-xs font-bold text-slate-500">times</span>
                </div>
              </div>
            </div>
          )}

          {banner && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                banner.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {banner.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{banner.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{saving ? "Saving Notice..." : "Save Post-Alarm Notice for this Elder"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function AwarenessPopupBroadcaster({ elders }: { elders: ManagedUserItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [targetId, setTargetId] = useState<string>("ALL")
  const [noticeType, setNoticeType] = useState<"TEXT" | "VOICE" | "VIDEO">("VIDEO")
  const [title, setTitle] = useState("💧 Daily Hydration & Health Reminder")
  const [message, setMessage] = useState("Please drink a fresh glass of water now to stay healthy and hydrated.")
  const [mediaUrl, setMediaUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const PRESETS = [
    {
      label: "💧 Hydration",
      type: "TEXT" as const,
      title: "💧 Daily Hydration & Health Reminder",
      message: "Please drink a full glass of fresh water now to stay hydrated and energetic.",
      mediaUrl: ""
    },
    {
      label: "🚶 Fall Prevention",
      type: "TEXT" as const,
      title: "🚶 Fall Prevention & Balance Alert",
      message: "Take your time when standing up. Turn on bright lights before walking, and hold railings firmly.",
      mediaUrl: ""
    },
    {
      label: "💊 Medicine Safety",
      type: "TEXT" as const,
      title: "💊 Medication Caution & Reminder",
      message: "Always take your prescribed medicines with clean drinking water and check dosage labels carefully.",
      mediaUrl: ""
    },
    {
      label: "🎥 Health Video",
      type: "VIDEO" as const,
      title: "🎥 General Wellness & Exercise Video",
      message: "Watch this guided mobility and stretching video recommended by your healthcare team.",
      mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    }
  ]

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setTitle(p.title)
    setMessage(p.message)
    setNoticeType(p.type)
    setMediaUrl(p.mediaUrl)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setBanner(null)
    try {
      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|3gp)$/i.test(file.name)
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string
          const res = await fetch("/api/medications/notice-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || (isVideo ? "video/mp4" : "audio/mpeg"),
              dataUrl
            })
          })
          const data = (await res.json()) as { url?: string; message?: string }
          if (!res.ok || !data.url) throw new Error(data.message || "Upload failed")
          setMediaUrl(data.url)
          setNoticeType(isVideo ? "VIDEO" : "VOICE")
          setBanner({ type: "success", text: `✓ ${isVideo ? "Video" : "Audio"} uploaded!` })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed"
          setBanner({ type: "error", text: msg })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "File read failed"
      setBanner({ type: "error", text: msg })
      setUploading(false)
    }
  }

  const handleDispatchPopup = async () => {
    if (!title.trim() || !message.trim()) {
      setBanner({ type: "error", text: "Please provide a title and message." })
      return
    }
    setSending(true)
    setBanner(null)
    try {
      const res = await fetch("/api/admin/awareness-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId: targetId,
          title,
          message,
          noticeType,
          mediaUrl
        })
      })
      const data = (await res.json()) as { recipientsCount?: number; message?: string }
      if (!res.ok) throw new Error(data.message || "Failed to dispatch popup")
      setBanner({
        type: "success",
        text: `🚀 Success! Fullscreen popup dispatched to ${data.recipientsCount ?? 1} elder phone(s) immediately over the lock screen!`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch popup"
      setBanner({ type: "error", text: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-violet-700/50 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/30 border border-violet-400/40 flex items-center justify-center text-2xl shrink-0">
            📢
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Direct Phone Screen Popup Tool</span>
            </div>
            <h3 className="text-lg font-black text-white">General Awareness Screen & Video Popup</h3>
            <p className="text-xs text-violet-200">
              Wakes up the elder&apos;s phone screen immediately over the lock screen (just like an alarm popup) to display text, voice, or video awareness notices.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition flex items-center gap-1.5"
        >
          <span>{isExpanded ? "Hide Broadcaster" : "Open Broadcaster"}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-4 border-t border-violet-700/60 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Configuration controls */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-violet-200 mb-1">Target Phone(s)</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full p-2.5 bg-slate-800/80 border border-violet-500/40 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="ALL">🌐 All Elder Accounts ({elders.length} devices)</option>
                  {elders.map((el) => (
                    <option key={el.id} value={el.id}>
                      👤 {el.name || el.email || "Elder"} ({el.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-violet-200">Notice Type</label>
                  <div className="flex gap-1">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="px-2 py-0.5 rounded-md bg-violet-800/70 hover:bg-violet-700 text-[10px] font-bold text-violet-200 border border-violet-500/40 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeType("TEXT")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      noticeType === "TEXT"
                        ? "bg-violet-600 text-white border-violet-400 shadow-md"
                        : "bg-slate-800/60 text-slate-300 border-violet-700/50 hover:bg-slate-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Text Notice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeType("VOICE")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      noticeType === "VOICE"
                        ? "bg-violet-600 text-white border-violet-400 shadow-md"
                        : "bg-slate-800/60 text-slate-300 border-violet-700/50 hover:bg-slate-800"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Voice Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeType("VIDEO")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      noticeType === "VIDEO"
                        ? "bg-violet-600 text-white border-violet-400 shadow-md"
                        : "bg-slate-800/60 text-slate-300 border-violet-700/50 hover:bg-slate-800"
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video Popup</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-violet-200 mb-1">Popup Screen Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Daily Hydration Reminder"
                  className="w-full p-2.5 bg-slate-800/80 border border-violet-500/40 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-violet-200 mb-1">
                  {noticeType === "VIDEO" ? "Video Caption / Text" : "Notice Message Body"}
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message displayed prominently on the phone screen..."
                  className="w-full p-2.5 bg-slate-800/80 border border-violet-500/40 rounded-xl text-xs font-medium text-white outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {(noticeType === "VOICE" || noticeType === "VIDEO") && (
                <div className="space-y-2 p-3 bg-slate-800/60 rounded-xl border border-violet-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-200">
                      {noticeType === "VIDEO" ? "Video File or URL" : "Audio File or URL"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={noticeType === "VIDEO" ? "video/*,.mp4,.webm,.mov,.3gp" : "audio/*,.mp3,.wav,.ogg,.m4a"}
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-violet-700/60 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      <span>{uploading ? "Uploading..." : `Upload ${noticeType === "VIDEO" ? "Video" : "Audio"}`}</span>
                    </button>
                  </div>

                  <input
                    type="url"
                    value={mediaUrl.startsWith("data:") ? "" : mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://.../video.mp4"
                    className="w-full p-2 bg-slate-900 border border-violet-600/40 rounded-lg text-xs font-medium text-white outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              )}
            </div>

            {/* Right: Live Preview of how the popup appears on the Elder's Phone */}
            <div className="rounded-2xl bg-black p-4 border border-violet-500/40 text-center flex flex-col justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black tracking-widest text-amber-400 uppercase">
                  📢 LIVE PHONE POPUP SCREEN PREVIEW
                </p>
                <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/40 rounded-full text-[10px] font-extrabold">
                  📢 GENERAL AWARENESS NOTICE
                </div>
                <h4 className="text-sm font-black text-white">{title || "Notice Title"}</h4>

                {noticeType === "VIDEO" && (
                  <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700 aspect-video flex items-center justify-center">
                    {mediaUrl ? (
                      <video controls src={mediaUrl} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center p-3 text-slate-400 space-y-1">
                        <Video className="w-8 h-8 mx-auto text-violet-400 opacity-60" />
                        <p className="text-[10px]">Video will play here over lock screen</p>
                      </div>
                    )}
                  </div>
                )}

                {noticeType === "VOICE" && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-xs text-sky-300 font-bold mb-1">🔊 Playing voice notice...</p>
                    {mediaUrl ? (
                      <audio controls src={mediaUrl} className="w-full h-8" />
                    ) : (
                      <Volume2 className="w-6 h-6 mx-auto text-violet-400 opacity-60" />
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-xl border border-slate-700 text-left">
                  {message || "Message body..."}
                </p>
              </div>

              <div className="pt-3">
                <div className="w-full py-2.5 rounded-full bg-slate-800 text-white font-black text-xs border border-white/20">
                  ✓ OK, I HAVE SEEN THIS — CLOSE
                </div>
              </div>
            </div>
          </div>

          {banner && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                banner.type === "success"
                  ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/50"
                  : "bg-rose-950/80 text-rose-200 border border-rose-500/50"
              }`}
            >
              {banner.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span>{banner.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={sending || uploading}
              onClick={handleDispatchPopup}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white font-black text-sm shadow-lg shadow-fuchsia-600/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{sending ? "Waking Phone Screens..." : "🚀 POPUP ON PHONE SCREEN NOW"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function UserManagementClient({ initialUsers }: { initialUsers: ManagedUserItem[] }) {
  const [users, setUsers] = useState<ManagedUserItem[]>(initialUsers)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ELDER" | "CHILD">("ALL")
  const [autoSnoozeFilter, setAutoSnoozeFilter] = useState<"ALL" | "ON" | "OFF">("ALL")

  const stats = useMemo(() => {
    const elders = users.filter((u) => u.role === "ELDER").length
    const autoOn = users.filter((u) => u.autoSnoozeEnabled).length
    const blocked = users.filter((u) => u.isBlocked).length
    return { total: users.length, elders, autoOn, blocked }
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false
      if (autoSnoozeFilter === "ON" && !u.autoSnoozeEnabled) return false
      if (autoSnoozeFilter === "OFF" && u.autoSnoozeEnabled) return false
      if (!q) return true
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        u.linkedNames.some((n) => n.toLowerCase().includes(q))
      )
    })
  }, [users, search, roleFilter, autoSnoozeFilter])

  const handleUserUpdated = (updated: ManagedUserItem) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  return (
    <div className="space-y-6">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed Accounts</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-violet-200 shadow-xs">
          <p className="text-xs font-bold text-violet-600 uppercase tracking-wider">Auto-Snooze Active</p>
          <p className="text-3xl font-black text-violet-700 mt-1">{stats.autoOn}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Elder Accounts</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{stats.elders}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Blocked Accounts</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.blocked}</p>
        </div>
      </div>

      {/* Awareness Screen & Video Popup Tool */}
      <AwarenessPopupBroadcaster elders={users.filter((u) => u.role === "ELDER")} />

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search user name, email, or linked family..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            {(["ALL", "ELDER", "CHILD"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  roleFilter === r
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r === "ALL" ? "All Roles" : r === "ELDER" ? "Elders" : "Family"}
              </button>
            ))}
          </div>

          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            {(["ALL", "ON", "OFF"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAutoSnoozeFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  autoSnoozeFilter === s
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s === "ALL" ? "Auto-Snooze: All" : s === "ON" ? "ON Only" : "OFF Only"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Management Cards List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-500 font-bold">No matching accounts found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <ManagedUserCard key={user.id} user={user} onUserUpdated={handleUserUpdated} />
          ))}
        </div>
      )}
    </div>
  )
}
