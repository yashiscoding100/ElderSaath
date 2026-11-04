"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  X, 
  Download, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Loader2, 
  ExternalLink,
  Check
} from "lucide-react"

export interface MedicalDocItem {
  id: string
  title: string
  fileUrl: string
  fileType?: string
  date?: string
  subtitle?: string
  category?: string
  badgeText?: string
  badgeColor?: string
  extraRemark?: string
  icon?: string
}

export function detectDocumentFormat(fileUrl: string, declaredType?: string): {
  isPdf: boolean
  isImage: boolean
  mimeType: string
  normalizedUrl: string
  extension: string
} {
  if (!fileUrl) {
    return { isPdf: false, isImage: false, mimeType: "application/octet-stream", normalizedUrl: "", extension: "bin" }
  }

  // 1. Check HTTP URL extensions
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    const cleanUrl = fileUrl.split("?")[0].toLowerCase()
    if (cleanUrl.endsWith(".pdf")) {
      return { isPdf: true, isImage: false, mimeType: "application/pdf", normalizedUrl: fileUrl, extension: "pdf" }
    }
    if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) {
      return { isPdf: false, isImage: true, mimeType: "image/jpeg", normalizedUrl: fileUrl, extension: "jpg" }
    }
    if (cleanUrl.endsWith(".png")) {
      return { isPdf: false, isImage: true, mimeType: "image/png", normalizedUrl: fileUrl, extension: "png" }
    }
    if (cleanUrl.endsWith(".webp")) {
      return { isPdf: false, isImage: true, mimeType: "image/webp", normalizedUrl: fileUrl, extension: "webp" }
    }
  }

  // 2. Check Data URLs & Magic Base64 Bytes
  let base64Part = fileUrl
  let headerMime = declaredType || ""

  if (fileUrl.startsWith("data:")) {
    const commaIndex = fileUrl.indexOf(",")
    if (commaIndex !== -1) {
      headerMime = fileUrl.substring(5, commaIndex).split(";")[0]
      base64Part = fileUrl.substring(commaIndex + 1)
    }
  }

  // Clean and check magic bytes in base64:
  const cleanBase64 = base64Part.trim().substring(0, 30)

  // Explicit PDF check: magic bytes '%PDF' ('JVBER') OR declared as pdf without image data
  if (cleanBase64.startsWith("JVBER") || (headerMime.includes("pdf") && !cleanBase64.startsWith("/9j/") && !cleanBase64.startsWith("iVBOR") && !cleanBase64.startsWith("UklGR"))) {
    const normalized = fileUrl.startsWith("data:application/pdf") ? fileUrl : `data:application/pdf;base64,${base64Part}`
    return { isPdf: true, isImage: false, mimeType: "application/pdf", normalizedUrl: normalized, extension: "pdf" }
  }

  // Image detection
  let imgMime = "image/jpeg"
  let ext = "jpg"

  if (cleanBase64.startsWith("iVBOR") || headerMime.includes("png")) {
    imgMime = "image/png"
    ext = "png"
  } else if (cleanBase64.startsWith("UklGR") || headerMime.includes("webp")) {
    imgMime = "image/webp"
    ext = "webp"
  } else if (cleanBase64.startsWith("/9j/") || headerMime.includes("jpeg") || headerMime.includes("jpg")) {
    imgMime = "image/jpeg"
    ext = "jpg"
  }

  // If fileUrl doesn't have data: prefix, construct it
  const normalized = fileUrl.startsWith("data:") && !fileUrl.startsWith("data:application/pdf")
    ? fileUrl 
    : `data:${imgMime};base64,${base64Part}`

  return { isPdf: false, isImage: true, mimeType: imgMime, normalizedUrl: normalized, extension: ext }
}

export function MedicalDocumentViewerModal({
  doc,
  onClose,
  onDelete
}: {
  doc: MedicalDocItem | null
  onClose: () => void
  onDelete?: (id: string) => Promise<void> | void
}) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Two-Finger Pinch-to-Zoom & Double-Tap state refs
  const initialPinchDistRef = useRef<number>(0)
  const initialZoomRef = useRef<number>(1)
  const lastTapTimeRef = useRef<number>(0)

  // PDF.js State
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<any>(null)

  useEffect(() => {
    // Reset viewport on document change
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
    setCurrentPage(1)
    setPdfError(null)
    setPdfLoading(false)
    initialPinchDistRef.current = 0
  }, [doc?.id])

  if (!doc) return null

  const format = detectDocumentFormat(doc.fileUrl, doc.fileType)

  // Load and render PDF using PDF.js onto canvas
  useEffect(() => {
    if (!doc || !format.isPdf) return

    let isMounted = true
    setPdfLoading(true)
    setPdfError(null)

    async function renderPdf() {
      try {
        let pdfjs = (window as any).pdfjsLib
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
            script.onload = () => {
              pdfjs = (window as any).pdfjsLib
              if (pdfjs) {
                pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
                resolve()
              } else {
                reject(new Error("PDF engine failed to initialize"))
              }
            }
            script.onerror = () => reject(new Error("Unable to load PDF viewer library"))
            document.head.appendChild(script)
          })
        }

        if (!isMounted) return

        let loadingTask: any
        if (doc!.fileUrl.startsWith("http")) {
          loadingTask = pdfjs.getDocument({ url: doc!.fileUrl, withCredentials: false })
        } else {
          let base64 = doc!.fileUrl
          const commaIndex = base64.indexOf(",")
          if (commaIndex !== -1) {
            base64 = base64.substring(commaIndex + 1)
          }
          const cleanBase64 = base64.replace(/\s/g, "")
          const binaryString = atob(cleanBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          loadingTask = pdfjs.getDocument({ data: bytes })
        }

        const loadedPdf = await loadingTask.promise
        if (!isMounted) return
        pdfDocRef.current = loadedPdf
        setNumPages(loadedPdf.numPages)
        setPdfLoading(false)

        renderPage(loadedPdf, currentPage, zoom, rotation)
      } catch (err: any) {
        console.error("PDF render error:", err)
        if (isMounted) {
          setPdfError(err.message || "Failed to render PDF")
          setPdfLoading(false)
        }
      }
    }

    renderPdf()

    return () => {
      isMounted = false
    }
  }, [doc?.id, doc?.fileUrl, format.isPdf])

  useEffect(() => {
    if (format.isPdf && pdfDocRef.current && !pdfLoading) {
      renderPage(pdfDocRef.current, currentPage, zoom, rotation)
    }
  }, [currentPage, zoom, rotation, format.isPdf, pdfLoading])

  async function renderPage(pdf: any, pageNum: number, currentZoom: number, currentRotation: number) {
    if (!canvasRef.current || !pdf) return
    try {
      const page = await pdf.getPage(pageNum)
      const scale = Math.max(0.7, currentZoom * 1.5)
      const viewport = page.getViewport({ scale, rotation: currentRotation })

      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      await page.render(renderContext).promise
    } catch (e) {
      console.error("Error rendering PDF page canvas:", e)
    }
  }

  // Button Zoom Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(4, Number((prev + 0.25).toFixed(2))))
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))
  const handleResetZoom = () => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Mouse wheel zoom (Ctrl + Wheel or standard Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoom(z => Math.min(4, Number((z + 0.15).toFixed(2))))
    } else {
      setZoom(z => Math.max(0.5, Number((z - 0.15).toFixed(2))))
    }
  }

  // --------------------------------------------------------------------------
  // Mobile Touch Gestures: Two-Finger Pinch-to-Zoom & Double-Tap
  // --------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers: initialize pinch-to-zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      initialPinchDistRef.current = dist
      initialZoomRef.current = zoom
      setIsDragging(false)
    } else if (e.touches.length === 1) {
      // Single finger: check double tap
      const now = Date.now()
      if (now - lastTapTimeRef.current < 320) {
        // Double tap toggles zoom
        if (zoom > 1.2) {
          setZoom(1)
          setPan({ x: 0, y: 0 })
        } else {
          setZoom(2.2)
        }
        lastTapTimeRef.current = 0
      } else {
        lastTapTimeRef.current = now
      }

      // Single finger pan when zoomed in
      if (zoom > 1) {
        setIsDragging(true)
        setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y })
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current > 0) {
      // Pinching with two fingers!
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = currentDist / initialPinchDistRef.current
      const nextZoom = Math.min(4, Math.max(0.6, Number((initialZoomRef.current * factor).toFixed(2))))
      setZoom(nextZoom)
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Panning with single finger
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = 0
    }
    if (e.touches.length === 0) {
      setIsDragging(false)
    }
  }

  // Download handler
  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    setDownloadSuccess(false)

    const safeTitle = (doc.title || "Medical_Document")
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
    const fileName = `${safeTitle}.${format.extension}`

    try {
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem")
        const { Share } = await import("@capacitor/share")

        let base64Data = doc.fileUrl
        if (doc.fileUrl.startsWith("data:")) {
          const commaIdx = doc.fileUrl.indexOf(",")
          if (commaIdx !== -1) {
            base64Data = doc.fileUrl.substring(commaIdx + 1)
          }
        } else if (doc.fileUrl.startsWith("http")) {
          const resp = await fetch(doc.fileUrl)
          const blob = await resp.blob()
          base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const res = reader.result as string
              resolve(res.substring(res.indexOf(",") + 1))
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        })

        await Share.share({
          title: fileName,
          text: `Medical document: ${doc.title}`,
          url: savedFile.uri,
          dialogTitle: "Save or Open Medical Document"
        })

        setDownloading(false)
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 3000)
        return
      }
    } catch (err) {
      console.warn("Capacitor download fallback to web download:", err)
    }

    try {
      if (doc.fileUrl.startsWith("http")) {
        const resp = await fetch(doc.fileUrl)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
      } else {
        let blob: Blob
        if (doc.fileUrl.startsWith("data:")) {
          const commaIdx = doc.fileUrl.indexOf(",")
          const rawBase64 = commaIdx !== -1 ? doc.fileUrl.substring(commaIdx + 1) : doc.fileUrl
          const clean = rawBase64.replace(/\s/g, "")
          const binary = atob(clean)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          blob = new Blob([bytes], { type: format.mimeType })
        } else {
          blob = new Blob([doc.fileUrl], { type: format.mimeType })
        }

        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
      }

      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 3000)
    } catch (e: any) {
      console.error("Web download failed:", e)
      window.open(doc.fileUrl, "_blank")
    } finally {
      setDownloading(false)
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!doc || !onDelete) return
    const confirmed = confirm(
      `Are you sure you want to delete "${doc.title}"?\n\nThis will permanently remove it from your records and free up storage.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await onDelete(doc.id)
      onClose()
    } catch (err: any) {
      alert("Failed to delete document: " + (err.message || ""))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-5 animate-fade-in select-none">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="text-2xl shrink-0">{doc.icon || (format.isPdf ? "📄" : "💊")}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base truncate max-w-[180px] sm:max-w-md text-white">
                  {doc.title}
                </h3>
                {doc.badgeText && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    {doc.badgeText}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {doc.date ? `Date: ${doc.date}` : ""} {doc.subtitle ? `• ${doc.subtitle}` : ""} • {format.extension.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset Zoom to 100%"
                className="px-2 py-1 font-bold text-[11px] text-slate-300 hover:text-white"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                title="Zoom In"
                className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotate}
                title="Rotate 90° Clockwise"
                className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-300 hover:text-white border-l border-slate-700"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-sm ${
                downloadSuccess 
                  ? "bg-emerald-600 text-white" 
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
              title={`Download ${format.extension.toUpperCase()}`}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : downloadSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {downloading ? "Saving..." : downloadSuccess ? "Saved!" : "Download"}
              </span>
            </button>

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1 transition"
                title="Delete this document"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Main Viewport with Two-Finger Pinch-to-Zoom & Drag-Pan */}
        <div 
          className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-default select-none"
          style={{ touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {format.isPdf ? (
            <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden p-3">
              {pdfLoading && (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                  <p className="font-bold text-sm">Rendering PDF document...</p>
                </div>
              )}

              {pdfError && (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md text-center space-y-4">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-base text-white">PDF Preview Unavailable Inline</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      You can download or open this PDF directly in your device's PDF viewer.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs flex items-center gap-1.5 text-white"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </button>
                    <a
                      href={format.normalizedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 text-slate-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Externally</span>
                    </a>
                  </div>
                </div>
              )}

              <div 
                className={`transition-transform duration-75 flex items-center justify-center ${pdfLoading || pdfError ? 'hidden' : 'block'}`}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default"
                }}
              >
                <canvas 
                  ref={canvasRef} 
                  className="rounded-lg shadow-2xl bg-white max-w-full max-h-[78vh] object-contain border border-slate-700 pointer-events-none"
                />
              </div>

              {/* PDF Page Navigation Bar */}
              {numPages > 1 && !pdfLoading && !pdfError && (
                <div className="absolute bottom-4 bg-slate-900/90 border border-slate-700 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-300 shadow-xl z-10">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 hover:text-white disabled:opacity-30 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {currentPage} of {numPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                    className="p-1 hover:text-white disabled:opacity-30 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center overflow-hidden p-2"
              style={{
                cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default"
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={format.normalizedUrl}
                alt={doc.title}
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? "none" : "transform 100ms ease-out"
                }}
                className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
              />
            </div>
          )}
        </div>

        {/* Footer info bar with Touch Instructions */}
        <div className="p-3 px-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 truncate">
            {doc.extraRemark ? (
              <span className="truncate font-medium">
                💡 <span className="font-bold text-white">Result:</span> {doc.extraRemark}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                ✌️ <span className="text-slate-300 font-medium">Two-finger pinch to zoom</span> • Double-tap to quick zoom • Drag to pan
              </span>
            )}
          </div>
          {doc.category && (
            <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 font-bold shrink-0 text-[11px]">
              {doc.category}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
