"use client"

import { useState } from "react"
import { Eye, Trash2, Calendar, Building2, FileCheck2, Loader2 } from "lucide-react"
import { LabReportItem, LabReportCategory } from "@/lib/labReportTypes"

function getCategoryBadge(category: LabReportCategory) {
  switch (category) {
    case "Blood Test":
      return { bg: "bg-red-50 text-red-700 border-red-200", icon: "🩸" }
    case "ECG / Heart":
      return { bg: "bg-rose-50 text-rose-700 border-rose-200", icon: "🫀" }
    case "X-Ray / Scan":
      return { bg: "bg-sky-50 text-sky-700 border-sky-200", icon: "🩻" }
    case "Urine & Pathology":
      return { bg: "bg-amber-50 text-amber-700 border-amber-200", icon: "🔬" }
    default:
      return { bg: "bg-slate-100 text-slate-700 border-slate-200", icon: "📋" }
  }
}

export function LabReportCard({
  report,
  onView,
  onDeleted
}: {
  report: LabReportItem
  onView: (report: LabReportItem) => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const badge = getCategoryBadge(report.category)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete "${report.testName}" from ${report.testDate}?`)) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/lab-reports?id=${report.id}`, { method: "DELETE" })
      if (res.ok) {
        onDeleted()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.message || "Failed to delete report")
        setDeleting(false)
      }
    } catch (err) {
      console.error(err)
      alert("Error deleting report")
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={() => onView(report)}
      className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border border-slate-200/80 transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between group"
    >
      <div>
        {/* Top Meta Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.bg}`}>
            <span>{badge.icon}</span>
            <span>{report.category}</span>
          </span>
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {report.testDate || "Recent"}
          </span>
        </div>

        {/* Test Name */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition line-clamp-2 mb-2">
          {report.testName}
        </h3>

        {/* Lab / Clinic Name */}
        {report.labName && (
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-2.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{report.labName}</span>
          </p>
        )}

        {/* Result / Doctor Remark */}
        {report.resultSummary && (
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 mb-3">
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Result / Finding:</span>
            </p>
            <p className="text-xs font-semibold text-emerald-950 mt-0.5 pl-4 line-clamp-2">
              {report.resultSummary}
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onView(report)
          }}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 py-1.5 px-3 rounded-lg hover:bg-emerald-50 transition"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Report</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-bold text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          title="Delete report"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin text-red-600" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
