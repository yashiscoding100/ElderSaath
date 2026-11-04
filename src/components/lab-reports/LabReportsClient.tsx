"use client"

import { useState } from "react"
import { Search, FlaskConical, FileText, Trash2, Loader2 } from "lucide-react"
import { LabReportItem, LabReportCategory } from "@/lib/labReportTypes"
import { LabReportCard } from "./LabReportCard"
import { LabReportViewerModal } from "./LabReportViewerModal"
import { AddLabReportModal } from "./AddLabReportModal"

export function LabReportsClient({
  initialReports,
  elderId,
  isElderView = false
}: {
  initialReports: LabReportItem[]
  elderId: string
  isElderView?: boolean
}) {
  const [reports, setReports] = useState<LabReportItem[]>(initialReports)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewingReport, setViewingReport] = useState<LabReportItem | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/lab-reports?elderId=${elderId}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (e) {
      console.error("Failed to refresh reports:", e)
    }
  }

  const handleClearAllReports = async () => {
    if (reports.length === 0) return
    const confirmed = confirm(
      `Are you sure you want to delete all ${reports.length} test reports for this account?\n\nThis cannot be undone and will permanently free up storage space.`
    )
    if (!confirmed) return

    setClearingAll(true)
    try {
      const res = await fetch(`/api/lab-reports?elderId=${elderId}&clearAll=true`, { method: "DELETE" })
      if (res.ok) {
        setViewingReport(null)
        await handleRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.message || "Failed to clear test reports")
      }
    } catch (e: any) {
      alert("Error clearing test reports: " + (e?.message || ""))
    } finally {
      setClearingAll(false)
    }
  }

  // Filter logic
  const filtered = reports.filter(r => {
    const matchesCategory = selectedCategory === "All" || r.category === selectedCategory
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch = !query || 
      r.testName.toLowerCase().includes(query) ||
      (r.labName && r.labName.toLowerCase().includes(query)) ||
      (r.resultSummary && r.resultSummary.toLowerCase().includes(query))

    return matchesCategory && matchesSearch
  })

  // Category counts
  const categoryCounts: Record<string, number> = {
    All: reports.length,
    "Blood Test": reports.filter(r => r.category === "Blood Test").length,
    "ECG / Heart": reports.filter(r => r.category === "ECG / Heart").length,
    "X-Ray / Scan": reports.filter(r => r.category === "X-Ray / Scan").length,
    "Urine & Pathology": reports.filter(r => r.category === "Urine & Pathology").length,
    "General Lab Test": reports.filter(r => r.category === "General Lab Test").length
  }

  const categoryPills: { label: string; icon: string }[] = [
    { label: "All", icon: "📑" },
    { label: "Blood Test", icon: "🩸" },
    { label: "ECG / Heart", icon: "🫀" },
    { label: "X-Ray / Scan", icon: "🩻" },
    { label: "Urine & Pathology", icon: "🔬" },
    { label: "General Lab Test", icon: "📋" }
  ]

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by test name, lab, or result..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-slate-900 transition"
            />
          </div>

          {/* Action buttons on mobile / desktop */}
          <div className="flex items-center gap-2 shrink-0">
            {reports.length > 0 && (
              <button
                onClick={handleClearAllReports}
                disabled={clearingAll}
                className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                title="Delete all old test reports to free up storage"
              >
                {clearingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Clear Old Reports</span>
              </button>
            )}

            <AddLabReportModal 
              elderId={elderId} 
              isElderView={isElderView} 
              onReportAdded={handleRefresh} 
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categoryPills.map(cat => {
            const count = categoryCounts[cat.label] || 0
            const active = selectedCategory === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                  active
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reports Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-4 border border-emerald-100">
            🧪
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {reports.length === 0 ? "No Lab & Test Reports Yet" : "No matching reports found"}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mb-6">
            {reports.length === 0 
              ? "Upload photos or PDFs of blood tests, ECGs, urine tests, or scans to keep a complete diagnostic record."
              : "Try adjusting your search query or switching categories above."
            }
          </p>
          {reports.length === 0 && (
            <AddLabReportModal 
              elderId={elderId} 
              isElderView={isElderView} 
              onReportAdded={handleRefresh} 
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(report => (
            <LabReportCard
              key={report.id}
              report={report}
              onView={r => setViewingReport(r)}
              onDeleted={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Document Viewer Modal with Zoom, Download, and Delete */}
      <LabReportViewerModal
        report={viewingReport}
        onClose={() => setViewingReport(null)}
        onDeleted={() => {
          setViewingReport(null)
          handleRefresh()
        }}
      />
    </div>
  )
}
