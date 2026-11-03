"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Upload, FileText, CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { LabReportCategory } from "@/lib/labReportTypes"

const QUICK_TEST_PRESETS: { name: string; category: LabReportCategory; icon: string }[] = [
  { name: "Complete Blood Count (CBC)", category: "Blood Test", icon: "🩸" },
  { name: "HbA1c Blood Sugar", category: "Blood Test", icon: "🍬" },
  { name: "Lipid Profile / Cholesterol", category: "Blood Test", icon: "🧈" },
  { name: "Kidney Function (KFT)", category: "Blood Test", icon: "🩺" },
  { name: "Liver Function (LFT)", category: "Blood Test", icon: "🩺" },
  { name: "Thyroid Profile (TSH)", category: "Blood Test", icon: "🧬" },
  { name: "ECG / Electrocardiogram", category: "ECG / Heart", icon: "🫀" },
  { name: "Chest X-Ray / Scan", category: "X-Ray / Scan", icon: "🩻" },
  { name: "Urine Routine & Micro", category: "Urine & Pathology", icon: "🔬" }
]

const CATEGORIES: { label: LabReportCategory; icon: string }[] = [
  { label: "Blood Test", icon: "🩸" },
  { label: "ECG / Heart", icon: "🫀" },
  { label: "X-Ray / Scan", icon: "🩻" },
  { label: "Urine & Pathology", icon: "🔬" },
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [testName, setTestName] = useState("")
  const [category, setCategory] = useState<LabReportCategory>("Blood Test")
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split("T")[0])
  const [labName, setLabName] = useState("")
  const [resultSummary, setResultSummary] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const handleApplyPreset = (preset: typeof QUICK_TEST_PRESETS[0]) => {
    setTestName(preset.name)
    setCategory(preset.category)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testName.trim()) {
      setErrorMsg("Please enter the test name")
      return
    }
    if (!file) {
      setErrorMsg("Please attach the report photo or PDF")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const fileData = reader.result as string

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
            fileType: file.type || "application/pdf",
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
        setFile(null)
        setTestDate(new Date().toISOString().split("T")[0])

        if (onReportAdded) onReportAdded()
        router.refresh()
      }

      reader.readAsDataURL(file)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Failed to upload test report")
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
          ? "w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-base sm:text-lg cursor-pointer"
          : "bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow transition flex items-center gap-2 text-sm cursor-pointer"
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
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center">
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

          {/* File Upload */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">
              Report File or Camera Photo <span className="text-red-500">*</span>
            </label>
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition cursor-pointer group">
              <input
                required
                type="file"
                accept=".pdf,image/*"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3 text-emerald-700">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-bold text-sm text-slate-900 truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready to save</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 mt-1">Tap to select PDF or snap report photo</p>
                  <p className="text-xs text-slate-400">PDF, JPG, PNG supported (up to 10MB)</p>
                </div>
              )}
            </div>
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
              disabled={loading || !testName || !file}
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
