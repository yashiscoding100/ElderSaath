"use client"

import { useState } from "react"
import { DatabaseStorageStats, StorageCategory } from "@/lib/databaseStorage"
import { purgeAllMedicalDocuments, purgeDatabaseLogs } from "./actions"
import { 
  Database, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  TrendingUp, 
  Layers, 
  Sparkles,
  Camera,
  FileText,
  Info
} from "lucide-react"

export function AdminDatabaseStorageMeter({ 
  initialStats,
  documentCount,
  notificationCount 
}: { 
  initialStats: DatabaseStorageStats
  documentCount: number
  notificationCount: number
}) {
  const [stats, setStats] = useState<DatabaseStorageStats>(initialStats)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/storage-stats")
      if (res.ok) {
        const data = await res.json()
        if (data.stats) setStats(data.stats)
      }
    } catch (e) {
      console.warn("Storage refresh error:", e)
    } finally {
      setRefreshing(false)
    }
  }

  const handlePurgeDocuments = async () => {
    const confirmation = prompt(
      `⚠️ DANGER: You are about to permanently delete all ${documentCount} medical prescriptions and documents from the database.\n\nType "DELETE" below to confirm:`
    )
    if (confirmation !== "DELETE") {
      if (confirmation !== null) alert("Action canceled: You must type DELETE exactly.")
      return
    }

    setLoadingDocs(true)
    setStatusMessage(null)
    try {
      const res = await purgeAllMedicalDocuments()
      if (res.success) {
        setStatusMessage({ text: res.message, type: "success" })
        handleRefresh()
      } else {
        setStatusMessage({ text: res.message, type: "error" })
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || "An error occurred", type: "error" })
    } finally {
      setLoadingDocs(false)
    }
  }

  const handlePurgeLogs = async () => {
    if (!confirm(`Are you sure you want to clear historical in-app notifications and task logs to free up database rows?`)) {
      return
    }

    setLoadingLogs(true)
    setStatusMessage(null)
    try {
      const res = await purgeDatabaseLogs()
      if (res.success) {
        setStatusMessage({ text: res.message, type: "success" })
        handleRefresh()
      } else {
        setStatusMessage({ text: res.message, type: "error" })
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || "An error occurred", type: "error" })
    } finally {
      setLoadingLogs(false)
    }
  }

  // Calculate percentage of total 500MB quota for each category
  const getQuotaPercent = (bytes: number) => {
    return Math.max(0.5, Number(((bytes / stats.quotaBytes) * 100).toFixed(2)))
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Database Storage Analytics</h3>
                <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                  stats.status === "HEALTHY" 
                    ? "bg-emerald-100 text-emerald-800" 
                    : stats.status === "WARNING"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800 animate-pulse"
                }`}>
                  {stats.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time disk consumption and table breakdown for Supabase PostgreSQL (500 MB Free Quota).
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={handleRefresh}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition shrink-0 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {statusMessage && (
        <div className={`p-4 mx-6 md:mx-8 mt-6 rounded-2xl text-xs font-bold ${
          statusMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-rose-50 text-rose-800 border border-rose-200"
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Main Meters Grid */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Metric Cards Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Used Storage</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-slate-900">{stats.usedFormatted}</span>
              <span className="text-xs font-bold text-slate-400">({stats.usedPercentage}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">out of {stats.quotaFormatted} limit</p>
          </div>

          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/70">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Remaining Free Space</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-emerald-700">{stats.freeFormatted}</span>
              <span className="text-xs font-bold text-emerald-600">({stats.freePercentage}%)</span>
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">Free space available for files & logs</p>
          </div>

          <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-200/70">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Prescription Capacity</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-purple-800">~{stats.estimatedPhotosLeft.toLocaleString()}</span>
              <span className="text-xs font-bold text-purple-600">PDFs / Scans</span>
            </div>
            <p className="text-[11px] text-purple-600 mt-1">Can still be uploaded at ~300 KB each</p>
          </div>
        </div>

        {/* Visual Multi-Segment Storage Bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
            <span>Overall Storage Usage Bar</span>
            <span className="text-indigo-600">{stats.usedPercentage}% of 500 MB used</span>
          </div>

          {/* Progress Track */}
          <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex border border-slate-200 shadow-inner p-0.5 gap-0.5">
            {stats.categories.map((cat) => {
              const widthPct = getQuotaPercent(cat.bytes)
              return (
                <div
                  key={cat.id}
                  style={{ width: `${widthPct}%` }}
                  title={`${cat.name}: ${cat.formattedSize} (${cat.percentageOfUsed}% of used)`}
                  className={`${cat.color} h-full rounded-md transition-all hover:opacity-80 cursor-pointer`}
                />
              )
            })}
            {/* Free space segment */}
            <div
              style={{ width: `${stats.freePercentage}%` }}
              title={`Free Space: ${stats.freeFormatted} (${stats.freePercentage}%)`}
              className="bg-emerald-100/60 h-full rounded-md border border-dashed border-emerald-300"
            />
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[11px] font-semibold text-slate-600">
            {stats.categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                <span>{cat.name} ({cat.formattedSize})</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 border border-emerald-500" />
              <span>Available Free Space ({stats.freeFormatted})</span>
            </div>
          </div>
        </div>

        {/* Highlight Banner: "Which thing is taking the most space?" */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center font-black text-xl shrink-0">
              {stats.largestConsumer.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md">
                  Most Space Consumed
                </span>
                <span className="font-bold text-slate-900 text-sm">{stats.largestConsumer.name}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Takes up <strong className="text-slate-900">{stats.largestConsumer.formattedSize}</strong> ({stats.largestConsumer.percentageOfUsed}% of current database usage). Table: <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-amber-300">{stats.largestConsumer.table}</code>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-amber-900 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm inline-block">
              {stats.largestConsumer.count} records
            </span>
          </div>
        </div>

        {/* Detailed Table & Itemized Breakdown */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Storage Breakdown by Category & Table</span>
          </h4>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {stats.categories.map((cat) => (
              <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900">{cat.name}</p>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {cat.table}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pl-8 sm:pl-0">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">{cat.count} items</p>
                    <p className="text-xs text-slate-400">{cat.percentageOfUsed}% of used</p>
                  </div>
                  <div className="w-24 text-right">
                    <span className="font-black text-sm text-slate-900">{cat.formattedSize}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Cleanup & Maintenance Section */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Space Optimization & Database Purge Tools</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently delete obsolete files or notifications to instantly reclaim storage space.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={loadingDocs || documentCount === 0}
                onClick={handlePurgeDocuments}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition disabled:opacity-40"
              >
                {loadingDocs ? "Purging..." : `Purge All Prescriptions (${documentCount})`}
              </button>

              <button
                type="button"
                disabled={loadingLogs || notificationCount === 0}
                onClick={handlePurgeLogs}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition disabled:opacity-40"
              >
                {loadingLogs ? "Clearing..." : `Trim Historical Logs (${notificationCount})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
