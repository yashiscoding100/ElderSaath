"use client"

import { useState, useEffect } from "react"
import { X, Download, ExternalLink, FileText } from "lucide-react"
import { LabReportItem } from "@/lib/labReportTypes"

export function LabReportViewerModal({
  report,
  onClose
}: {
  report: LabReportItem | null
  onClose: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!report) {
      setBlobUrl(null)
      return
    }

    if (report.fileUrl.startsWith("http")) {
      setBlobUrl(report.fileUrl)
      return
    }

    // Convert base64 data URL to an in-memory blob URL for reliable iframe/image display
    try {
      const parts = report.fileUrl.split(",")
      const mime = parts[0]?.match(/:(.*?);/)?.[1] || report.fileType || "application/pdf"
      const byteChars = atob(parts[1])
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mime })
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)

      return () => {
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to construct blob from base64:", err)
      setBlobUrl(report.fileUrl)
    }
  }, [report])

  if (!report) return null

  const isImage = report.fileType?.startsWith("image/") || (!report.fileUrl.includes("application/pdf") && report.fileUrl.startsWith("data:image"))

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 truncate pr-2">
            <span className="text-2xl">🧪</span>
            <div className="truncate">
              <h3 className="font-bold text-base sm:text-lg truncate">{report.testName}</h3>
              <p className="text-xs text-slate-300">
                {report.testDate} {report.labName ? `• ${report.labName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                download={`${report.testName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Report`}
                className="p-2 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content */}
        <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-auto flex items-center justify-center">
          {blobUrl ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blobUrl}
                alt={report.testName}
                className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-slate-200"
              />
            ) : (
              <iframe
                src={blobUrl}
                title={report.testName}
                className="w-full h-full rounded-xl bg-white shadow-md border border-slate-200"
              />
            )
          ) : (
            <div className="text-center p-8 text-slate-400 flex flex-col items-center">
              <FileText className="w-12 h-12 mb-2 animate-pulse" />
              <p className="font-bold">Loading report document...</p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {report.resultSummary && (
          <div className="p-3 sm:p-4 bg-emerald-50 border-t border-emerald-100 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between">
            <span>Result / Doctor Remark: {report.resultSummary}</span>
            <span className="text-emerald-700 font-bold">{report.category}</span>
          </div>
        )}
      </div>
    </div>
  )
}
