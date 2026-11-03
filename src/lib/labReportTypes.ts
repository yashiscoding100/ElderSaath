export type LabReportCategory = 
  | "Blood Test" 
  | "ECG / Heart" 
  | "X-Ray / Scan" 
  | "Urine & Pathology" 
  | "General Lab Test"

export interface LabReportMeta {
  testName: string
  category: LabReportCategory
  testDate: string
  labName?: string
  resultSummary?: string
}

export interface LabReportItem extends LabReportMeta {
  id: string
  elderId: string
  uploaderId: string
  fileUrl: string
  fileType: string
  uploadedAt: string
}
