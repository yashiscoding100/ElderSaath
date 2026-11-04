"use client"

import { LabReportItem } from "@/lib/labReportTypes"
import { MedicalDocumentViewerModal, MedicalDocItem } from "@/components/MedicalDocumentViewerModal"

export function LabReportViewerModal({
  report,
  onClose,
  onDeleted
}: {
  report: LabReportItem | null
  onClose: () => void
  onDeleted?: () => void
}) {
  if (!report) return null

  const docItem: MedicalDocItem = {
    id: report.id,
    title: report.testName,
    fileUrl: report.fileUrl,
    fileType: report.fileType,
    date: report.testDate,
    subtitle: report.labName,
    category: report.category,
    badgeText: report.category,
    extraRemark: report.resultSummary,
    icon: "🧪"
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/lab-reports?id=${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || "Failed to delete test report")
    }
    if (onDeleted) onDeleted()
  }

  return (
    <MedicalDocumentViewerModal
      doc={docItem}
      onClose={onClose}
      onDelete={handleDelete}
    />
  )
}
