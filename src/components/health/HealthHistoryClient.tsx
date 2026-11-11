"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Trash2,
  Loader2,
  AlertTriangle,
  Calendar,
  Activity,
  ClipboardList,
  CheckCircle2,
  X,
} from "lucide-react"

export interface HealthMeasurementItem {
  id: string
  elderId: string
  type: string
  value: string
  unit: string | null
  source: string
  timestamp: string
  notes: string | null
}

interface HealthHistoryClientProps {
  initialMeasurements: HealthMeasurementItem[]
  elderId: string
  variant: "elder" | "child"
  requiredVitals?: string
}

type FilterTab = "ALL" | "VITALS" | "QUESTIONNAIRE"
type CleanupCategory = "ALL" | "VITALS" | "QUESTIONNAIRE"

const QUESTIONNAIRE_TYPES = new Set([
  "FEELING",
  "SLEEP",
  "MORNING_MEDS",
  "SYMPTOMS",
])

interface MeasurementMeta {
  label: string
  displayUnit: string
  category: "VITALS" | "QUESTIONNAIRE"
  emoji: string
  badgeText: string
  badgeClasses: string
}

function getMeasurementMeta(type: string, rawUnit: string | null): MeasurementMeta {
  switch (type) {
    case "BP":
      return {
        label: "Blood Pressure",
        displayUnit: rawUnit || "mmHg",
        category: "VITALS",
        emoji: "❤️",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "SUGAR":
      return {
        label: "Blood Sugar",
        displayUnit: rawUnit || "mg/dL",
        category: "VITALS",
        emoji: "🩸",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "SPO2":
      return {
        label: "SpO2",
        displayUnit: rawUnit || "%",
        category: "VITALS",
        emoji: "🫁",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "PULSE":
      return {
        label: "Pulse",
        displayUnit: rawUnit || "BPM",
        category: "VITALS",
        emoji: "💓",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "TEMP":
      return {
        label: "Temperature",
        displayUnit: rawUnit || "°F",
        category: "VITALS",
        emoji: "🌡️",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "WEIGHT":
      return {
        label: "Weight",
        displayUnit: rawUnit || "kg",
        category: "VITALS",
        emoji: "⚖️",
        badgeText: "Vital",
        badgeClasses: "bg-blue-50 text-blue-700 border-blue-200",
      }
    case "FEELING":
      return {
        label: "Daily Mood",
        displayUnit: "",
        category: "QUESTIONNAIRE",
        emoji: "😊",
        badgeText: "Check-in",
        badgeClasses: "bg-purple-50 text-purple-700 border-purple-200",
      }
    case "SLEEP":
      return {
        label: "Sleep Quality",
        displayUnit: "",
        category: "QUESTIONNAIRE",
        emoji: "😴",
        badgeText: "Check-in",
        badgeClasses: "bg-purple-50 text-purple-700 border-purple-200",
      }
    case "MORNING_MEDS":
      return {
        label: "Morning Medicine",
        displayUnit: "",
        category: "QUESTIONNAIRE",
        emoji: "💊",
        badgeText: "Check-in",
        badgeClasses: "bg-purple-50 text-purple-700 border-purple-200",
      }
    case "SYMPTOMS":
      return {
        label: "Reported Symptoms",
        displayUnit: "",
        category: "QUESTIONNAIRE",
        emoji: "🩺",
        badgeText: "Symptoms",
        badgeClasses: "bg-amber-50 text-amber-800 border-amber-200",
      }
    default: {
      const cleanUnit =
        rawUnit && rawUnit !== "string" && rawUnit !== "list" ? rawUnit : ""
      return {
        label: type.replace(/_/g, " "),
        displayUnit: cleanUnit,
        category: QUESTIONNAIRE_TYPES.has(type) ? "QUESTIONNAIRE" : "VITALS",
        emoji: "📊",
        badgeText: QUESTIONNAIRE_TYPES.has(type) ? "Check-in" : "Vital",
        badgeClasses: QUESTIONNAIRE_TYPES.has(type)
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-blue-50 text-blue-700 border-blue-200",
      }
    }
  }
}

function getSourceLabel(source: string): string | null {
  if (!source) return null
  switch (source.toUpperCase()) {
    case "CAREGIVER":
      return "Caregiver"
    case "WIDGET":
      return "Home Widget"
    case "DEVICE":
      return "Device"
    case "OCR":
      return "Scanned"
    default:
      return null
  }
}

interface CapacitorWindowLike {
  Capacitor?: {
    Plugins?: {
      AlarmSyncPlugin?: {
        getHealthWidgetData?: () => Promise<{ requiredVitals?: string }>
        syncHealthPreferences?: (opts: {
          requiredVitals?: string
          healthCheckDone: boolean
        }) => Promise<void>
      }
    }
  }
}

const emptySubscribe = () => () => {}

export function HealthHistoryClient({
  initialMeasurements,
  elderId,
  variant,
  requiredVitals,
}: HealthHistoryClientProps) {
  const router = useRouter()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set())
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isProcessingDelete, setIsProcessingDelete] = useState(false)
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Modal states
  const [confirmSingle, setConfirmSingle] =
    useState<HealthMeasurementItem | null>(null)
  const [confirmDay, setConfirmDay] = useState<{
    dateLabel: string
    records: HealthMeasurementItem[]
    scopeLabel: string
  } | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkCategory, setBulkCategory] =
    useState<CleanupCategory>("QUESTIONNAIRE")
  const [bulkOlderThanDays, setBulkOlderThanDays] = useState<number>(30)
  const [snapshotNowMs, setSnapshotNowMs] = useState<number>(0)

  const measurements = useMemo(
    () => initialMeasurements.filter((m) => !deletedIds.has(m.id)),
    [initialMeasurements, deletedIds]
  )

  const isElder = variant === "elder"

  const vitalsCount = useMemo(
    () => measurements.filter((m) => !QUESTIONNAIRE_TYPES.has(m.type)).length,
    [measurements]
  )
  const questionnaireCount = useMemo(
    () => measurements.filter((m) => QUESTIONNAIRE_TYPES.has(m.type)).length,
    [measurements]
  )

  const filteredMeasurements = useMemo(() => {
    if (activeTab === "VITALS") {
      return measurements.filter((m) => !QUESTIONNAIRE_TYPES.has(m.type))
    }
    if (activeTab === "QUESTIONNAIRE") {
      return measurements.filter((m) => QUESTIONNAIRE_TYPES.has(m.type))
    }
    return measurements
  }, [measurements, activeTab])

  const groupedByDate = useMemo(() => {
    const groups: {
      dateKey: string
      dateLabel: string
      records: HealthMeasurementItem[]
    }[] = []
    const byKey = new Map<string, (typeof groups)[number]>()

    for (const item of filteredMeasurements) {
      let dateKey: string
      let dateLabel: string

      if (mounted) {
        const d = new Date(item.timestamp)
        dateKey = format(d, "yyyy-MM-dd")
        dateLabel = format(d, "EEEE, MMM d, yyyy")
      } else {
        dateKey = item.timestamp.slice(0, 10)
        dateLabel = item.timestamp.slice(0, 10)
      }

      let group = byKey.get(dateKey)
      if (!group) {
        group = { dateKey, dateLabel, records: [] }
        byKey.set(dateKey, group)
        groups.push(group)
      }
      group.records.push(item)
    }

    return groups
  }, [filteredMeasurements, mounted])

  const matchingBulkCount = useMemo(() => {
    if (!bulkModalOpen) return 0

    const cutoffMs =
      bulkOlderThanDays > 0
        ? snapshotNowMs - bulkOlderThanDays * 24 * 60 * 60 * 1000
        : null

    return measurements.filter((item) => {
      const isQuest = QUESTIONNAIRE_TYPES.has(item.type)
      if (bulkCategory === "VITALS" && isQuest) return false
      if (bulkCategory === "QUESTIONNAIRE" && !isQuest) return false

      if (cutoffMs !== null) {
        const itemMs = new Date(item.timestamp).getTime()
        if (itemMs >= cutoffMs) return false
      }
      return true
    }).length
  }, [
    bulkModalOpen,
    bulkCategory,
    bulkOlderThanDays,
    snapshotNowMs,
    measurements,
  ])

  const syncWidgetAfterElderDelete = async (
    previousList: HealthMeasurementItem[],
    nextList: HealthMeasurementItem[]
  ) => {
    if (variant !== "elder") return

    try {
      const todayKey = format(new Date(), "yyyy-MM-dd")
      const hadTodayBefore = previousList.some(
        (m) => format(new Date(m.timestamp), "yyyy-MM-dd") === todayKey
      )
      const hasTodayAfter = nextList.some(
        (m) => format(new Date(m.timestamp), "yyyy-MM-dd") === todayKey
      )

      if (hadTodayBefore && !hasTodayAfter) {
        const cap = (window as unknown as CapacitorWindowLike).Capacitor
        const plugin = cap?.Plugins?.AlarmSyncPlugin
        if (plugin?.syncHealthPreferences) {
          let reqVitals = requiredVitals
          if (!reqVitals && plugin.getHealthWidgetData) {
            const widgetData = await plugin.getHealthWidgetData()
            reqVitals = widgetData?.requiredVitals
          }
          await plugin.syncHealthPreferences({
            ...(reqVitals ? { requiredVitals: reqVitals } : {}),
            healthCheckDone: false,
          })
        }
      }
    } catch (err) {
      console.warn("Failed to sync native health widget state:", err)
    }
  }

  const applyDeletedIdsAndRefresh = async (
    newlyDeletedIds: string[],
    previousList: HealthMeasurementItem[]
  ) => {
    const removedSet = new Set(newlyDeletedIds)
    const nextList = previousList.filter((m) => !removedSet.has(m.id))

    setDeletedIds((prev) => {
      const next = new Set(prev)
      for (const id of newlyDeletedIds) {
        next.add(id)
      }
      return next
    })

    await syncWidgetAfterElderDelete(previousList, nextList)
    router.refresh()
  }

  const handleConfirmSingleDelete = async () => {
    if (!confirmSingle || isProcessingDelete) return
    const target = confirmSingle
    const previousList = measurements

    setIsProcessingDelete(true)
    setDeletingId(target.id)
    setStatusBanner(null)

    try {
      const res = await fetch(
        `/api/health?id=${encodeURIComponent(target.id)}&elderId=${encodeURIComponent(elderId)}`,
        { method: "DELETE" }
      )
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string
        deletedIds?: string[]
      }

      if (!res.ok) {
        setStatusBanner({
          type: "error",
          text: payload.message || "Failed to delete record.",
        })
        return
      }

      const removed =
        Array.isArray(payload.deletedIds) && payload.deletedIds.length > 0
          ? payload.deletedIds
          : [target.id]
      await applyDeletedIdsAndRefresh(removed, previousList)
      const meta = getMeasurementMeta(target.type, target.unit)
      setConfirmSingle(null)
      setStatusBanner({
        type: "success",
        text: `Deleted ${meta.label} record.`,
      })
    } catch {
      setStatusBanner({
        type: "error",
        text: "Network error while deleting record.",
      })
    } finally {
      setDeletingId(null)
      setIsProcessingDelete(false)
    }
  }

  const handleConfirmDayDelete = async () => {
    if (!confirmDay || isProcessingDelete) return
    const targetDay = confirmDay
    const previousList = measurements
    const idsToDelete = targetDay.records.map((r) => r.id)

    setIsProcessingDelete(true)
    setStatusBanner(null)

    try {
      const res = await fetch("/api/health", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderId, ids: idsToDelete }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string
        deletedCount?: number
        deletedIds?: string[]
      }

      if (!res.ok) {
        setStatusBanner({
          type: "error",
          text: payload.message || "Failed to delete records for that date.",
        })
        return
      }

      const removed = Array.isArray(payload.deletedIds)
        ? payload.deletedIds
        : idsToDelete
      await applyDeletedIdsAndRefresh(removed, previousList)
      setConfirmDay(null)
      setStatusBanner({
        type: "success",
        text: `Deleted ${payload.deletedCount ?? removed.length} record(s) from ${targetDay.dateLabel}.`,
      })
    } catch {
      setStatusBanner({
        type: "error",
        text: "Network error while deleting day records.",
      })
    } finally {
      setIsProcessingDelete(false)
    }
  }

  const openBulkCleanupModal = () => {
    setSnapshotNowMs(Date.now())
    if (activeTab === "VITALS") {
      setBulkCategory("VITALS")
    } else if (activeTab === "QUESTIONNAIRE") {
      setBulkCategory("QUESTIONNAIRE")
    } else {
      setBulkCategory("QUESTIONNAIRE")
    }
    setBulkModalOpen(true)
  }

  const handleConfirmBulkDelete = async () => {
    if (isProcessingDelete || matchingBulkCount === 0) return
    const previousList = measurements

    setIsProcessingDelete(true)
    setStatusBanner(null)

    try {
      const res = await fetch("/api/health", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId,
          category: bulkCategory,
          olderThanDays: bulkOlderThanDays,
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string
        deletedCount?: number
        deletedIds?: string[]
      }

      if (!res.ok) {
        setStatusBanner({
          type: "error",
          text: payload.message || "Failed to delete old health data.",
        })
        return
      }

      const cutoffMs =
        bulkOlderThanDays > 0
          ? snapshotNowMs - bulkOlderThanDays * 24 * 60 * 60 * 1000
          : null

      const fallbackIds = previousList
        .filter((item) => {
          const isQuest = QUESTIONNAIRE_TYPES.has(item.type)
          const matchesCat =
            bulkCategory === "ALL" ||
            (bulkCategory === "QUESTIONNAIRE" && isQuest) ||
            (bulkCategory === "VITALS" && !isQuest)
          if (!matchesCat) return false
          if (cutoffMs === null) return true
          return new Date(item.timestamp).getTime() < cutoffMs
        })
        .map((item) => item.id)

      const removed = Array.isArray(payload.deletedIds)
        ? payload.deletedIds
        : fallbackIds

      await applyDeletedIdsAndRefresh(removed, previousList)
      setBulkModalOpen(false)
      setStatusBanner({
        type: "success",
        text:
          payload.message ||
          `Deleted ${payload.deletedCount ?? removed.length} old record(s).`,
      })
    } catch {
      setStatusBanner({
        type: "error",
        text: "Network error while clearing old records.",
      })
    } finally {
      setIsProcessingDelete(false)
    }
  }

  const dayDeleteLabel = (count: number) => {
    if (activeTab === "VITALS") return `Delete Day's Vitals (${count})`
    if (activeTab === "QUESTIONNAIRE") return `Delete Day's Check-in (${count})`
    return `Delete Day (${count})`
  }

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      {statusBanner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${
            statusBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 transition"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Bulk Cleanup Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
              isElder ? "text-sm" : "text-xs sm:text-sm"
            } ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>All</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "ALL"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {measurements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("VITALS")}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
              isElder ? "text-sm" : "text-xs sm:text-sm"
            } ${
              activeTab === "VITALS"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Vitals</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "VITALS"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {vitalsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QUESTIONNAIRE")}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
              isElder ? "text-sm" : "text-xs sm:text-sm"
            } ${
              activeTab === "QUESTIONNAIRE"
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Questionnaire &amp; Symptoms</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "QUESTIONNAIRE"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {questionnaireCount}
            </span>
          </button>
        </div>

        {measurements.length > 0 && (
          <button
            type="button"
            onClick={openBulkCleanupModal}
            className={`px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition shrink-0 ${
              isElder ? "text-sm" : "text-xs sm:text-sm"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Old Data</span>
          </button>
        )}
      </div>

      {/* Empty State or Date-Grouped Timeline */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="text-2xl">📉</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {measurements.length === 0
              ? "No health records found"
              : "No records in this category"}
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            {measurements.length === 0
              ? "Add vitals or complete a daily health check-in to begin tracking."
              : "Try switching tabs above to view other records."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div
              key={group.dateKey}
              className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    {group.dateLabel}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDay({
                      dateLabel: group.dateLabel,
                      records: group.records,
                      scopeLabel:
                        activeTab === "VITALS"
                          ? "vital reading(s)"
                          : activeTab === "QUESTIONNAIRE"
                            ? "questionnaire/symptom entry(s)"
                            : "health record(s)",
                    })
                  }
                  className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{dayDeleteLabel(group.records.length)}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.records.map((record) => {
                  const meta = getMeasurementMeta(record.type, record.unit)
                  const sourceLabel = getSourceLabel(record.source)
                  const formattedTime = mounted
                    ? format(new Date(record.timestamp), "h:mm a")
                    : `${record.timestamp.slice(11, 16)} UTC`
                  const isItemDeleting = deletingId === record.id

                  return (
                    <div
                      key={record.id}
                      className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 flex flex-col justify-between gap-3 hover:bg-slate-100/80 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClasses}`}
                            >
                              {meta.emoji} {meta.badgeText}
                            </span>
                            {sourceLabel && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600">
                                {sourceLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {meta.label}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmSingle(record)}
                          disabled={isItemDeleting}
                          className={`rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition shrink-0 flex items-center justify-center disabled:opacity-50 ${
                            isElder ? "p-2.5" : "p-2"
                          }`}
                          title={`Delete ${meta.label}`}
                          aria-label={`Delete ${meta.label}`}
                        >
                          {isItemDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div>
                        <p
                          className={`font-black text-slate-900 tracking-tight break-words ${
                            meta.category === "QUESTIONNAIRE"
                              ? "text-lg sm:text-xl"
                              : "text-2xl"
                          }`}
                        >
                          {record.value}
                          {meta.displayUnit && (
                            <span className="text-sm font-semibold text-slate-500 ml-1">
                              {meta.displayUnit}
                            </span>
                          )}
                        </p>
                        {record.notes && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {record.notes}
                          </p>
                        )}
                        <p className="text-xs font-medium text-slate-400 mt-1.5">
                          {formattedTime}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Single Record Delete Confirmation Modal */}
      {confirmSingle && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isProcessingDelete && setConfirmSingle(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Delete Health Record?
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  This will permanently remove this entry from the timeline and
                  charts.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {getMeasurementMeta(confirmSingle.type, confirmSingle.unit).label}
              </p>
              <p className="text-xl font-black text-slate-900 mt-1">
                {confirmSingle.value}{" "}
                <span className="text-sm font-semibold text-slate-500">
                  {
                    getMeasurementMeta(confirmSingle.type, confirmSingle.unit)
                      .displayUnit
                  }
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Recorded on{" "}
                {mounted
                  ? format(
                      new Date(confirmSingle.timestamp),
                      "MMM d, yyyy 'at' h:mm a"
                    )
                  : confirmSingle.timestamp.slice(0, 10)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmSingle(null)}
                disabled={isProcessingDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isProcessingDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Day Confirmation Modal */}
      {confirmDay && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isProcessingDelete && setConfirmDay(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Delete {confirmDay.records.length} Record
                  {confirmDay.records.length === 1 ? "" : "s"}?
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  You are about to delete all {confirmDay.records.length} shown{" "}
                  {confirmDay.scopeLabel} from{" "}
                  <span className="font-bold text-slate-700">
                    {confirmDay.dateLabel}
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200 rounded-2xl p-3.5 mb-6 text-xs text-red-800 font-semibold">
              This action cannot be undone. Deleted entries will no longer appear
              in history or trend charts.
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDay(null)}
                disabled={isProcessingDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDayDelete}
                disabled={isProcessingDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete All ({confirmDay.records.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Clear Old Data Modal */}
      {bulkModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isProcessingDelete && setBulkModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Clear Old Vitals &amp; Check-in Data
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Choose which records and how far back you want to clean up.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessingDelete && setBulkModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Data Type Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                What to Delete
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    {
                      id: "QUESTIONNAIRE" as CleanupCategory,
                      title: "Questionnaire & Symptoms Data Only",
                      desc: "Mood, Sleep Check, Morning Medicine Check & Reported Symptoms",
                    },
                    {
                      id: "VITALS" as CleanupCategory,
                      title: "Vitals Only",
                      desc: "Blood Pressure, Blood Sugar, SpO2, Pulse, Temperature & Weight",
                    },
                    {
                      id: "ALL" as CleanupCategory,
                      title: "All Data (Vitals & Questionnaire)",
                      desc: "Every health measurement and daily check-in response",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBulkCategory(option.id)}
                    className={`text-left p-3.5 rounded-2xl border-2 transition ${
                      bulkCategory === option.id
                        ? "border-red-500 bg-red-50/60"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <p className="font-bold text-sm text-slate-900">
                      {option.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {option.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Age Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { days: 7, label: "Older than 7 days" },
                  { days: 30, label: "Older than 30 days" },
                  { days: 90, label: "Older than 90 days" },
                  { days: 0, label: "All dates" },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setBulkOlderThanDays(opt.days)}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border-2 transition ${
                      bulkOlderThanDays === opt.days
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Match Preview */}
            <div
              className={`p-3.5 rounded-2xl border text-sm font-semibold ${
                matchingBulkCount > 0
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              {matchingBulkCount > 0
                ? `${matchingBulkCount} matching record${matchingBulkCount === 1 ? "" : "s"} will be permanently deleted.`
                : "No records match the selected type and date range."}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                disabled={isProcessingDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isProcessingDelete || matchingBulkCount === 0}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>
                    Delete{" "}
                    {matchingBulkCount > 0 ? `(${matchingBulkCount})` : ""}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
