"use client"

import { useState } from "react"
import { purgeAllMedicalDocuments, purgeDatabaseLogs } from "./actions"

type Props = {
  documentCount: number
  notificationCount: number
}

export function DatabaseCleanupCard({ documentCount, notificationCount }: Props) {
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

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
      } else {
        setStatusMessage({ text: res.message, type: "error" })
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || "An error occurred", type: "error" })
    } finally {
      setLoadingLogs(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💾</span>
            <h3 className="text-xl font-bold text-slate-900">Database Storage & Memory Management</h3>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Free up Neon PostgreSQL storage by wiping heavy base64 prescriptions or trimming historical logs.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
            {documentCount} Prescriptions / Docs
          </span>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
            {notificationCount} Logs
          </span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs uppercase tracking-wider font-bold opacity-60 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        <div className="p-5 bg-red-50/50 border border-red-100 rounded-xl space-y-3">
          <div>
            <h4 className="font-bold text-red-950 text-sm flex items-center gap-2">
              <span>📄</span> Purge Medical Prescriptions & Documents
            </h4>
            <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
              Medical prescriptions and lab PDFs are stored as raw base64 data, which takes up 99% of Neon DB storage quota. Wiping this immediately recovers database capacity.
            </p>
          </div>
          <button
            onClick={handlePurgeDocuments}
            disabled={loadingDocs || documentCount === 0}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition disabled:opacity-50 shadow-sm shadow-red-600/20"
          >
            {loadingDocs ? "Purging database..." : `Delete All Prescriptions (${documentCount})`}
          </button>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>🧹</span> Clean Notification & Task Logs
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Deletes historical in-app alert bells, medication logs, and task confirmations to clear database row counts without affecting user profiles.
            </p>
          </div>
          <button
            onClick={handlePurgeLogs}
            disabled={loadingLogs}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition disabled:opacity-50"
          >
            {loadingLogs ? "Cleaning logs..." : "Clear In-App Logs"}
          </button>
        </div>
      </div>
    </div>
  )
}
