"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { 
  X, 
  Upload, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  FlaskConical, 
  Sparkles, 
  Camera, 
  FileText 
} from "lucide-react"
import { LabReportCategory } from "@/lib/labReportTypes"

const QUICK_TEST_PRESETS = [
  { name: "Complete Blood Count (CBC)", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Blood Glucose / HbA1c", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Lipid Profile / Cholesterol", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Kidney Function (KFT / Creatinine)", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Liver Function Test (LFT)", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Thyroid Profile (T3, T4, TSH)", category: "Blood Test" as LabReportCategory, icon: "🩸" },
  { name: "Electrocardiogram (ECG)", category: "ECG / Heart" as LabReportCategory, icon: "🫀" },
  { name: "Echocardiogram (2D Echo)", category: "ECG / Heart" as LabReportCategory, icon: "🫀" },
  { name: "Chest X-Ray", category: "X-Ray / Scan" as LabReportCategory, icon: "🩻" },
  { name: "Ultrasound / Sonography", category: "X-Ray / Scan" as LabReportCategory, icon: "🩻" },
  { name: "Urine Routine & Microscopic", category: "Urine & Pathology" as LabReportCategory, icon: "🔬" },
]

const CATEGORIES: { label: LabReportCategory; icon: string }[] = [
  { label: "Blood Test", icon: "🩸" },
  { label: "ECG / Heart", icon: "🫀" },
  { label: "X-Ray / Scan", icon: "🩻" },
  { label: "Urine & Pathology", icon: "🔬" },
  { label: "X-Ray / Scan", icon: "🩻" },
  { label: "General Lab Test", icon: "📋" }
]

export function AddLabReportModal({
  elderId,
  isElderView = false,
  onReportAdded
}: { 
  elderId: string
  isElderView?: boolean
  onReportAdded?: () => void
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [testName, setTestName] = useState("")
  const [category, setCategory] = useState<LabReportCategory>("Blood Test")
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split("T")[0])
  const [labName, setLabName] = useState("")
  const [resultSummary, setResultSummary] = useState("")
  
  const [fileData, setFileData] = useState<string | null>(null)
  const [fileMime, setFileMime] = useState<string>("image/jpeg")
  const [fileName, setFileName] = useState<string>("")
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleApplyPreset = (preset: typeof QUICK_TEST_PRESETS[0]) => {
    setTestName(preset.name)
    setCategory(preset.category)
  }

  // Client-side downscaling and compression for images
  const processSelectedFile = async (selectedFile: File) => {
    setErrorMsg(null)
    setCompressing(true)
    setFileName(selectedFile.name)

    try {
      const isPdf = selectedFile.type.includes("pdf") || selectedFile.name.toLowerCase().endsWith(".pdf")

      if (isPdf) {
        if (selectedFile.size > 5 * 1024 * 1024) {
          setErrorMsg("PDF file is larger than 5 MB. Please select a smaller PDF or capture a photo.")
          setCompressing(false)
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          setFileData(reader.result as string)
          setFileMime("application/pdf")
          setFileSizeKb(Math.round(selectedFile.size / 1024))
          setCompressing(false)
        }
        reader.onerror = () => {
          setErrorMsg("Failed to read PDF file.")
          setCompressing(false)
        }
        reader.readAsDataURL(selectedFile)
        return
      }

      // For images (photos or gallery uploads): compress down to ~250 KB
      const reader = new FileReader()
      reader.onload = (e) => {
        const rawBase64 = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          const MAX_DIM = 1600
          let { width, height } = img
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width)
              width = MAX_DIM
            } else {
              width = Math.round((width * MAX_DIM) / height)
              height = MAX_DIM
            }
          }

          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            setFileData(rawBase64)
            setFileMime("image/jpeg")
            setFileSizeKb(Math.round(rawBase64.length / 1024))
            setCompressing(false)
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82)
          setFileData(compressedDataUrl)
          setFileMime("image/jpeg")
          setFileSizeKb(Math.round(compressedDataUrl.length / 1024))
          setCompressing(false)
        }
        img.onerror = () => {
          setFileData(rawBase64)
          setFileMime("image/jpeg")
          setCompressing(false)
        }
        img.src = rawBase64
      }
      reader.onerror = () => {
        setErrorMsg("Failed to read image file.")
        setCompressing(false)
      }
      reader.readAsDataURL(selectedFile)
    } catch (err: any) {
      console.error(err)
      setErrorMsg("Error processing file: " + (err.message || ""))
      setCompressing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testName.trim()) {
      setErrorMsg("Please enter the test name")
      return
    }
    if (!fileData) {
      setErrorMsg("Please attach the report photo or PDF")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/lab-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId,
          testName,
          category,
          testDate,
          labName,
          resultSummary,
          fileType: fileMime,
          fileData
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || "Failed to save test report")
      }

      setIsOpen(false)
      setTestName("")
      setCategory("Blood Test")
      setLabName("")
      setResultSummary("")
      setFileData(null)
      setFileName("")
      setTestDate(new Date().toISOString().split("T")[0])

      if (onReportAdded) onReportAdded()
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Failed to upload test report")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true)
          setErrorMsg(null)
        }}
        className={isElderView
          ? "w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg cursor-pointer"
          : "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm hover:shadow transition flex items-center gap-2 text-sm cursor-pointer"
        }
      >
        <Plus className="w-5 h-5" />
        <span>+ Add Test Report</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full my-8 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧪</span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">Add Medical Test Report</h2>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
              Save blood tests, scans, ECGs, and lab results for safe keeping
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Quick Preset Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Quick Select Common Tests
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEST_PRESETS.map(preset => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 ${
                    testName === preset.name
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Test Name */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Test / Investigation Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Complete Blood Count (CBC) or HbA1c"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-semibold text-slate-900 transition"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">
              Category / Test Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  type="button"
                  key={cat.label}
                  onClick={() => setCategory(cat.label)}
                  className={`p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                    category === cat.label
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Lab Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Test Date
              </label>
              <input
                type="date"
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-slate-900 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Lab / Hospital Name
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Lal PathLabs / Apollo"
                value={labName}
                onChange={e => setLabName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-slate-900 transition"
              />
            </div>
          </div>

          {/* Key Findings / Result Summary */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Key Result / Remarks <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. HbA1c: 6.8% (Normal) or Doctor advised low salt"
              value={resultSummary}
              onChange={e => setResultSummary(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-slate-900 transition"
            />
          </div>

          {/* File Upload / Camera Options */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              Attach Report Document / Photo <span className="text-red-500">*</span>
            </label>

            {/* Hidden native inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) processSelectedFile(f)
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) processSelectedFile(f)
              }}
            />

            {/* Upload Buttons: Camera vs File */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border-2 border-emerald-300 rounded-2xl flex items-center justify-center gap-2.5 transition text-emerald-800 font-bold text-sm shadow-sm"
              >
                <Camera className="w-5 h-5 text-emerald-600" />
                <span>Take Photo with Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl flex items-center justify-center gap-2.5 transition text-slate-700 font-bold text-sm shadow-sm"
              >
                <FileText className="w-5 h-5 text-slate-500" />
                <span>Upload PDF or Gallery</span>
              </button>
            </div>

            {/* Attached file status banner */}
            {compressing ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 text-sm font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Optimizing & compressing document...</span>
              </div>
            ) : fileData ? (
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3 text-emerald-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm truncate">{fileName || "Report Document"}</p>
                    <p className="text-[11px] text-emerald-700">
                      {fileSizeKb ? `${fileSizeKb} KB` : "Ready"} • {fileMime.includes("pdf") ? "PDF Document" : "Compressed JPEG Photo"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFileData(null)
                    setFileName("")
                    setFileSizeKb(null)
                  }}
                  className="text-xs text-red-600 hover:underline font-bold shrink-0"
                >
                  Change
                </button>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || compressing || !testName || !fileData}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center gap-2 cursor-pointer text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving Report...</span>
                </>
              ) : (
                <>
                  <span>Save Test Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
