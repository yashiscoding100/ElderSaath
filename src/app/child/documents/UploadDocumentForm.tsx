"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload, FileText, X, Loader2, CheckCircle2, Sparkles, Image as ImageIcon } from "lucide-react"

export function UploadDocumentForm({ 
  elderId,
  isElderView = false
}: { 
  elderId: string
  isElderView?: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [title, setTitle] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileData, setFileData] = useState<string | null>(null)
  const [fileMime, setFileMime] = useState<string>("image/jpeg")
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Client-side canvas compression for instant uploads
  const processAndCompressFile = async (selectedFile: File) => {
    setErrorMsg(null)
    setCompressing(true)

    const defaultTitle = `Prescription - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`
    if (!title) {
      setTitle(defaultTitle)
    }

    try {
      if (selectedFile.type.includes("pdf")) {
        // PDF: check file size (warn if > 4.5MB)
        if (selectedFile.size > 4.5 * 1024 * 1024) {
          setErrorMsg("PDF exceeds 4.5 MB. Please upload a smaller file or take a camera photo.")
          setCompressing(false)
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          setFileData(reader.result as string)
          setPreviewUrl(null)
          setFileMime("application/pdf")
          setFileSizeKb(Math.round(selectedFile.size / 1024))
          setCompressing(false)
          setIsOpen(true)
        }
        reader.onerror = () => {
          setErrorMsg("Could not read file.")
          setCompressing(false)
        }
        reader.readAsDataURL(selectedFile)
        return
      }

      // Images (from Camera or Gallery): Downscale & compress to high quality JPEG
      const reader = new FileReader()
      reader.onload = (e) => {
        const rawBase64 = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const MAX_DIM = 1600
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width)
              width = MAX_DIM
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height)
              height = MAX_DIM
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            setFileData(rawBase64)
            setPreviewUrl(rawBase64)
            setFileMime(selectedFile.type || "image/jpeg")
            setFileSizeKb(Math.round(selectedFile.size / 1024))
            setCompressing(false)
            setIsOpen(true)
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.82)
          const approxKb = Math.round((optimizedBase64.length * 3) / 4 / 1024)

          setFileData(optimizedBase64)
          setPreviewUrl(optimizedBase64)
          setFileMime("image/jpeg")
          setFileSizeKb(approxKb)
          setCompressing(false)
          setIsOpen(true)
        }
        img.onerror = () => {
          setFileData(rawBase64)
          setPreviewUrl(rawBase64)
          setFileMime(selectedFile.type || "image/jpeg")
          setFileSizeKb(Math.round(selectedFile.size / 1024))
          setCompressing(false)
          setIsOpen(true)
        }
        img.src = rawBase64
      }
      reader.onerror = () => {
        setErrorMsg("Failed to read camera photo.")
        setCompressing(false)
      }
      reader.readAsDataURL(selectedFile)
    } catch (err: any) {
      console.error(err)
      setErrorMsg("Error processing image: " + err.message)
      setCompressing(false)
    }
  }

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processAndCompressFile(file)
    e.target.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processAndCompressFile(file)
    e.target.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileData) {
      setErrorMsg("Please take a photo or select a file first.")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const fallbackTitle = `Prescription - ${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })}`

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elderId,
          title: title.trim() || fallbackTitle,
          fileType: fileMime,
          fileData
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.message || `Upload failed (Status ${res.status})`)
      }

      // Success
      setIsOpen(false)
      setTitle("")
      setFileData(null)
      setPreviewUrl(null)
      setFileSizeKb(null)
      router.refresh()
    } catch (error: any) {
      console.error("Upload prescription error:", error)
      setErrorMsg(error.message || "Failed to upload prescription. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Hidden Native File & Camera Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action Buttons: 📸 Snap Photo & 📁 Upload File */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={compressing}
          onClick={() => cameraInputRef.current?.click()}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          title="Take a photo of prescription with camera"
        >
          {compressing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          <span>📸 Snap Photo</span>
        </button>

        <button
          type="button"
          disabled={compressing}
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl transition flex items-center gap-2 active:scale-95 border border-slate-200 disabled:opacity-50"
          title="Choose an existing PDF or gallery image"
        >
          <Upload className="w-4 h-4 text-slate-600" />
          <span>📁 Browse Files / PDF</span>
        </button>
      </div>

      {/* Upload & Preview Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in text-left">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 max-w-lg w-full relative border border-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl">
                  💊
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Save Prescription</h3>
                  <p className="text-xs text-slate-500">Review document details before saving to vault.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setFileData(null)
                  setPreviewUrl(null)
                  setErrorMsg(null)
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Document Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Prescription Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sharma - Blood Pressure Prescription"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                />
              </div>

              {/* Photo / Document Live Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Captured Document
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 bg-slate-50/70 flex flex-col items-center justify-center text-center">
                  {previewUrl ? (
                    <div className="relative group max-h-64 overflow-hidden rounded-xl border border-slate-200 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Prescription Preview"
                        className="max-h-64 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center">
                      <FileText className="w-12 h-12 text-purple-600 mb-2" />
                      <p className="text-sm font-bold text-slate-800">PDF Document Ready</p>
                      <p className="text-xs text-slate-500 mt-0.5">Ready for upload to your medical vault.</p>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between w-full px-2 text-[11px] text-slate-500 font-semibold">
                    <span className="flex items-center gap-1 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {previewUrl ? "Optimized & Compressed" : "PDF Document"}
                    </span>
                    {fileSizeKb && <span>~{fileSizeKb} KB</span>}
                  </div>
                </div>
              </div>

              {/* Re-snap / Change options */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || !fileData}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Vault...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Save Prescription</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
