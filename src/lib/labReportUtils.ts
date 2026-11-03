import { LabReportCategory, LabReportMeta, LabReportItem } from "./labReportTypes"

const PREFIX = "[LAB_REPORT]"

export function encodeLabReportTitle(meta: LabReportMeta): string {
  const json = JSON.stringify({
    testName: meta.testName.trim(),
    category: meta.category,
    testDate: meta.testDate || new Date().toISOString().split("T")[0],
    labName: meta.labName?.trim() || "",
    resultSummary: meta.resultSummary?.trim() || ""
  })
  return `${PREFIX} ${json}`
}

export function isLabReport(title: string): boolean {
  return typeof title === "string" && title.startsWith(PREFIX)
}

export function parseLabReport(doc: {
  id: string
  elderId: string
  uploaderId: string
  title: string
  fileUrl: string
  fileType: string
  uploadedAt: Date | string
}): LabReportItem | null {
  if (!isLabReport(doc.title)) return null

  try {
    const rawJson = doc.title.slice(PREFIX.length).trim()
    const parsed = JSON.parse(rawJson)

    return {
      id: doc.id,
      elderId: doc.elderId,
      uploaderId: doc.uploaderId,
      testName: parsed.testName || "Medical Test Report",
      category: (parsed.category as LabReportCategory) || "General Lab Test",
      testDate: parsed.testDate || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split("T")[0] : ""),
      labName: parsed.labName || "",
      resultSummary: parsed.resultSummary || "",
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      uploadedAt: new Date(doc.uploadedAt).toISOString()
    }
  } catch (err) {
    console.error("Failed to parse lab report title:", doc.title, err)
    return {
      id: doc.id,
      elderId: doc.elderId,
      uploaderId: doc.uploaderId,
      testName: "Medical Test Report",
      category: "General Lab Test",
      testDate: new Date(doc.uploadedAt).toISOString().split("T")[0],
      labName: "",
      resultSummary: "",
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      uploadedAt: new Date(doc.uploadedAt).toISOString()
    }
  }
}
