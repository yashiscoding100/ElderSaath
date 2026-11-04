"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
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
  Check,
  Maximize2
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
  // Smooth Transform States
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState(false)
  
  // Interaction Tracking Refs
  const initialPinchDistRef = useRef<number>(0)
  const initialZoomRef = useRef<number>(1)
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTapTimeRef = useRef<number>(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  // Download & Delete States
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // PDF.js State & Task Refs
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  // Reset viewport when opening a different document
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
    setCurrentPage(1)
    setPdfError(null)
    setPdfLoading(false)
    initialPinchDistRef.current = 0
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null
    }
  }, [doc?.id])

  if (!doc) return null

  const format = detectDocumentFormat(doc.fileUrl, doc.fileType)

  // ---------------------------------------------------------------------------
  // PDF Rendering Engine (High-Resolution Canvas Rendered ONCE per page)
  // ---------------------------------------------------------------------------
  const renderCurrentPage = useCallback(async (pdf: any, pageNum: number) => {
    if (!canvasRef.current || !pdf) return

    // Cancel any ongoing render task to prevent canvas matrix collision / upside-down flipping
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {}
      renderTaskRef.current = null
    }

    try {
      const page = await pdf.getPage(pageNum)
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return

      // Render at fixed, crisp 2x resolution so text is crystal clear without laggy re-renders
      const dpr = typeof window !== "undefined" ? Math.min(2.5, Math.max(1.8, window.devicePixelRatio || 2)) : 2
      const viewport = page.getViewport({ scale: dpr })

      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      const task = page.render(renderContext)
      renderTaskRef.current = task
      await task.promise
      renderTaskRef.current = null
    } catch (e: any) {
      if (e?.name !== "RenderingCancelledException") {
        console.error("Error rendering PDF page canvas:", e)
      }
    }
  }, [])

  // Load PDF Document
  useEffect(() => {
    if (!doc || !format.isPdf) return

    let isMounted = true
    setPdfLoading(true)
    setPdfError(null)

    async function initPdf() {
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

        await renderCurrentPage(loadedPdf, currentPage)
      } catch (err: any) {
        console.error("PDF load error:", err)
        if (isMounted) {
          setPdfError(err.message || "Failed to render PDF")
          setPdfLoading(false)
        }
      }
    }

    initPdf()

    return () => {
      isMounted = false
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
        renderTaskRef.current = null
      }
    }
  }, [doc?.id, doc?.fileUrl, format.isPdf, renderCurrentPage])

  // Re-render canvas when changing pages
  useEffect(() => {
    if (format.isPdf && pdfDocRef.current && !pdfLoading) {
      renderCurrentPage(pdfDocRef.current, currentPage)
    }
  }, [currentPage, format.isPdf, pdfLoading, renderCurrentPage])

  // ---------------------------------------------------------------------------
  // Smooth Zoom, Pan & Clamping Handlers (Prevents drifting off to corners)
  // ---------------------------------------------------------------------------

  const clampPan = (newX: number, newY: number, currentZoom: number) => {
    if (currentZoom <= 1.0) {
      return { x: 0, y: 0 }
    }
    const vp = viewportRef.current
    const w = vp?.clientWidth || 400
    const h = vp?.clientHeight || 600
    // Dynamic boundary based on zoom level: Document can never be lost outside viewport
    const maxX = ((w * (currentZoom - 1)) / 2) + 60
    const maxY = ((h * (currentZoom - 1)) / 2) + 80
    return {
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    }
  }

  // Button Zoom In (clamped to max 4x)
  const handleZoomIn = () => {
    setZoom(prev => {
      const next = Math.min(4.0, Number((prev + 0.35).toFixed(2)))
      return next
    })
  }

  // Button Zoom Out (never drops below 1.0 to prevent document shrinking & hiding in corners)
  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(1.0, Number((prev - 0.35).toFixed(2)))
      if (next <= 1.0) {
        setPan({ x: 0, y: 0 })
      } else {
        setPan(p => ({
          x: p.x * ((next - 1) / (prev - 1 || 1)),
          y: p.y * ((next - 1) / (prev - 1 || 1))
        }))
      }
      return next
    })
  }

  // Reset Zoom & Pan to exactly centered 100%
  const handleResetZoom = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  // Rotate 90 degrees clockwise (normalized, keeps centered)
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
    setPan({ x: 0, y: 0 })
  }

  // ---------------------------------------------------------------------------
  // Touch Gestures: Pinch-to-Zoom & Pan (Silky Smooth 60fps GPU Transforms)
  // ---------------------------------------------------------------------------

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Initialize two-finger pinch gesture
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      if (dist > 10) {
        initialPinchDistRef.current = dist
        initialZoomRef.current = zoom
        initialPanRef.current = { ...pan }
        setIsInteracting(true)
      }
    } else if (e.touches.length === 1) {
      const now = Date.now()
      // Check double tap (within 300ms)
      if (now - lastTapTimeRef.current < 300) {
        if (zoom > 1.15) {
          // Double-tap when zoomed in -> smoothly reset to centered 100%
          setZoom(1.0)
          setPan({ x: 0, y: 0 })
        } else {
          // Double-tap when 100% -> smoothly zoom into 2.2x
          setZoom(2.2)
        }
        lastTapTimeRef.current = 0
        return
      }
      lastTapTimeRef.current = now

      // Single finger drag/pan when zoomed in
      if (zoom > 1.0) {
        setIsInteracting(true)
        dragStartRef.current = {
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y
        }
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current > 10) {
      // Active Pinch-to-zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const scaleRatio = currentDist / initialPinchDistRef.current
      
      // Calculate target zoom (clamped between 0.9 elastic bottom and 4.0 top)
      const targetZoom = Math.min(4.0, Math.max(0.9, initialZoomRef.current * scaleRatio))
      
      // When unzooming towards 1.0, automatically pull pan back to center so file never flies into a corner!
      if (targetZoom <= 1.05) {
        const decay = Math.max(0, (targetZoom - 0.9) / 0.15)
        setPan({
          x: initialPanRef.current.x * decay,
          y: initialPanRef.current.y * decay
        })
      } else {
        const clamped = clampPan(initialPanRef.current.x, initialPanRef.current.y, targetZoom)
        setPan(clamped)
      }

      setZoom(Number(targetZoom.toFixed(3)))
    } else if (e.touches.length === 1 && isInteracting && zoom > 1.0) {
      // Single finger panning
      const newX = e.touches[0].clientX - dragStartRef.current.x
      const newY = e.touches[0].clientY - dragStartRef.current.y
      setPan(clampPan(newX, newY, zoom))
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = 0
    }
    if (e.touches.length === 0) {
      setIsInteracting(false)
      // Rubber-band snap back: If unzoomed below 1.05x, cleanly snap back to 100% centered
      if (zoom <= 1.05) {
        setZoom(1.0)
        setPan({ x: 0, y: 0 })
      }
    }
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom(z => Math.min(4.0, Number((z + 0.2).toFixed(2))))
    } else {
      setZoom(z => {
        const next = Math.max(1.0, Number((z - 0.2).toFixed(2)))
        if (next <= 1.0) setPan({ x: 0, y: 0 })
        return next
      })
    }
  }

  // Mouse drag handlers (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1.0) return
    setIsInteracting(true)
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting || zoom <= 1.0) return
    const newX = e.clientX - dragStartRef.current.x
    const newY = e.clientY - dragStartRef.current.y
    setPan(clampPan(newX, newY, zoom))
  }

  const handleMouseUp = () => setIsInteracting(false)

  // ---------------------------------------------------------------------------
  // Download Engine (Capacitor Native Share + Clean Web Download)
  // ---------------------------------------------------------------------------
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

  // Unified 60fps GPU transform style for both PDF and Images
  const transformStyle: React.CSSProperties = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: "center center",
    transition: isInteracting ? "none" : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform",
    cursor: zoom > 1.0 ? (isInteracting ? "grabbing" : "grab") : "default"
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
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs shadow-inner">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 1.0}
                title="Zoom Out (Min 100%)"
                className="p-1.5 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40 rounded-lg transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset to 100% Centered"
                className="px-2.5 py-1 font-bold text-[11px] text-slate-200 hover:text-white transition flex items-center gap-1"
              >
                <span>{Math.round(zoom * 100)}%</span>
                {zoom > 1.0 && <Maximize2 className="w-2.5 h-2.5 text-blue-400 opacity-70" />}
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 4.0}
                title="Zoom In (Max 400%)"
                className="p-1.5 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40 rounded-lg transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90° Clockwise"
                className="p-1.5 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition text-slate-300 hover:text-white border-l border-slate-700"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-sm ${
                downloadSuccess 
                  ? "bg-emerald-600 text-white" 
                  : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white"
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
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1 transition"
                title="Delete this document"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Main Viewport with Silky Smooth Pinch-to-Zoom & Drag-Pan */}
        <div 
          ref={viewportRef}
          className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center select-none"
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
            <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden p-2">
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
                      type="button"
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
                className={`flex items-center justify-center ${pdfLoading || pdfError ? 'hidden' : 'block'}`}
                style={transformStyle}
              >
                <canvas 
                  ref={canvasRef} 
                  className="rounded-lg shadow-2xl bg-white max-w-full max-h-[78vh] object-contain border border-slate-700 pointer-events-none select-none"
                />
              </div>

              {/* PDF Page Navigation Bar */}
              {numPages > 1 && !pdfLoading && !pdfError && (
                <div className="absolute bottom-4 bg-slate-900/90 border border-slate-700 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-300 shadow-xl z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1))
                      setZoom(1.0)
                      setPan({ x: 0, y: 0 })
                    }}
                    disabled={currentPage <= 1}
                    className="p-1 hover:text-white disabled:opacity-30 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {currentPage} of {numPages}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(p => Math.min(numPages, p + 1))
                      setZoom(1.0)
                      setPan({ x: 0, y: 0 })
                    }}
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
            >
              <div style={transformStyle}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={format.normalizedUrl}
                  alt={doc.title}
                  draggable={false}
                  className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar with Touch Instructions */}
        <div className="p-3 px-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 truncate">
            {doc.extraRemark ? (
              <span className="truncate font-medium">
                📋 <span className="font-bold text-white">Result:</span> {doc.extraRemark}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                🔍 <span className="text-slate-300 font-medium">Pinch to zoom</span> • Double-tap to quick zoom • Drag to pan
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {zoom > 1.0 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
              >
                Reset to Center
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-mono">
              ElderSaath Doc Viewer
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
