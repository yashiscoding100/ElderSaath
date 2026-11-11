"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react"

export type ManagedUserItem = {
  id: string
  name: string | null
  email: string | null
  role: string
  isBlocked: boolean
  blockMessage: string
  notifyVitals: boolean
  notifySnooze: boolean
  sosEnabled: boolean
  canManageMeds: boolean
  alarmSnoozeText: string
  alarmSnoozeDuration: number
  autoSnoozeEnabled: boolean
  autoSnoozeAfterSeconds: number
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
  const [timerValue, setTimerValue] = useState<number>(
    initialUnit === "MINUTES" ? user.autoSnoozeAfterSeconds / 60 : user.autoSnoozeAfterSeconds
  )

  const computedAutoSeconds =
    timerUnit === "MINUTES"
      ? Math.round(Number(timerValue || 0) * 60)
      : Math.round(Number(timerValue || 0))

  const resetDraftFromUser = () => {
    setDraft(user)
    const u: "SECONDS" | "MINUTES" =
      user.autoSnoozeAfterSeconds >= 60 && user.autoSnoozeAfterSeconds % 60 === 0 ? "MINUTES" : "SECONDS"
    setTimerUnit(u)
    setTimerValue(u === "MINUTES" ? user.autoSnoozeAfterSeconds / 60 : user.autoSnoozeAfterSeconds)
    setStatusBanner(null)
  }

  const applyPresetSeconds = (seconds: number) => {
    if (seconds >= 60 && seconds % 60 === 0) {
      setTimerUnit("MINUTES")
      setTimerValue(seconds / 60)
    } else {
      setTimerUnit("SECONDS")
      setTimerValue(seconds)
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
    if (draft.autoSnoozeEnabled && (computedAutoSeconds < 5 || computedAutoSeconds > 3600)) {
      setStatusBanner({
        type: "error",
        text: "Auto-Snooze countdown must be between 5 seconds and 60 minutes (3600 seconds)."
      })
      return
    }
    if (draft.alarmSnoozeDuration < 1 || draft.alarmSnoozeDuration > 180) {
      setStatusBanner({
        type: "error",
        text: "Snooze repeat interval must be between 1 and 180 minutes."
      })
      return
    }

    setSaving(true)
    setStatusBanner(null)
    const nextSeconds = draft.autoSnoozeEnabled ? computedAutoSeconds : user.autoSnoozeAfterSeconds

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          autoSnoozeEnabled: draft.autoSnoozeEnabled,
          autoSnoozeAfterSeconds: nextSeconds,
          alarmSnoozeDuration: draft.alarmSnoozeDuration,
          alarmSnoozeText: draft.alarmSnoozeText,
          stickyAlarmNotification: draft.stickyAlarmNotification,
          sosEnabled: draft.sosEnabled,
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
        autoSnoozeAfterSeconds: nextSeconds,
        blockMessage: draft.isBlocked ? draft.blockMessage : ""
      }
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
              {isElder && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    user.sosEnabled
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}
                >
                  🚨 SOS: {user.sosEnabled ? "ON" : "OFF"}
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
                          value={timerValue}
                          onChange={(e) => setTimerValue(Math.max(1, Number(e.target.value)))}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                        />
                        <select
                          value={timerUnit}
                          onChange={(e) => {
                            const next = e.target.value as "SECONDS" | "MINUTES"
                            if (next === "MINUTES" && timerUnit === "SECONDS") {
                              setTimerValue(Math.max(1, Math.round(timerValue / 60)))
                            } else if (next === "SECONDS" && timerUnit === "MINUTES") {
                              setTimerValue(timerValue * 60)
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
                  <span>🔔</span> Alarm & Snooze Preferences
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
                      value={draft.alarmSnoozeDuration}
                      onChange={(e) =>
                        setDraft({ ...draft, alarmSnoozeDuration: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDraft({ ...draft, alarmSnoozeDuration: m })}
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
                  <>
                    <ToggleRow
                      label="Emergency SOS Access"
                      description="Allow Emergency SOS trigger & escalation workflow for this elder account."
                      checked={draft.sosEnabled}
                      onChange={(next) => setDraft({ ...draft, sosEnabled: next })}
                      accentClass="peer-checked:bg-rose-600"
                    />

                    <ToggleRow
                      label="Can Manage Medications"
                      description="Allow this elder account to add or edit their own medication reminders."
                      checked={draft.canManageMeds}
                      onChange={(next) => setDraft({ ...draft, canManageMeds: next })}
                      accentClass="peer-checked:bg-emerald-600"
                    />
                  </>
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
            </div>
          </div>

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

export function UserManagementClient({ initialUsers }: { initialUsers: ManagedUserItem[] }) {
  const [users, setUsers] = useState<ManagedUserItem[]>(initialUsers)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ELDER" | "CHILD">("ALL")
  const [autoSnoozeFilter, setAutoSnoozeFilter] = useState<"ALL" | "ON" | "OFF">("ALL")

  const stats = useMemo(() => {
    const elders = users.filter((u) => u.role === "ELDER").length
    const autoOn = users.filter((u) => u.autoSnoozeEnabled).length
    const sosOn = users.filter((u) => u.sosEnabled).length
    const blocked = users.filter((u) => u.isBlocked).length
    return { total: users.length, elders, autoOn, sosOn, blocked }
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
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">SOS Enabled</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{stats.sosOn}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Blocked Accounts</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.blocked}</p>
        </div>
      </div>

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
