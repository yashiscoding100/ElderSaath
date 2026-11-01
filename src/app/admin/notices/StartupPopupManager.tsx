"use client"

import { useState, useRef } from "react"
import {
  Film,
  Image as ImageIcon,
  FileText,
  Eye,
  Check,
  Sparkles,
  PlayCircle,
  Power,
  Loader2,
  Clock,
  Lock,
  X,
  Timer,
  CheckCircle2,
  Sliders,
  Upload,
  Link as LinkIcon,
  HardDrive,
  Info,
  Trash2
} from "lucide-react"
import { StartupPopupConfig, StartupPopupType, DismissMode } from "@/lib/startupPopup"

export function StartupPopupManager({ initialConfig }: { initialConfig: StartupPopupConfig }) {
  const [config, setConfig] = useState<StartupPopupConfig>(initialConfig)
  const [loading, setLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toggleNotice, setToggleNotice] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Media Source Mode: Upload from Device or Paste Link
  const isExistingUploaded = config.mediaUrl?.startsWith("data:") || config.mediaUrl?.includes("blob.vercel-storage.com")
  const [mediaSourceTab, setMediaSourceTab] = useState<"UPLOAD" | "LINK">(
    isExistingUploaded ? "UPLOAD" : (config.mediaUrl ? "LINK" : "UPLOAD")
  )
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadedInfo, setUploadedInfo] = useState<{ filename: string; size: number; storage: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Instant 1-Click Power Toggle (persists directly to server)
  const handleTogglePower = async (forcedState?: boolean) => {
    const nextState = typeof forcedState === "boolean" ? forcedState : !config.enabled
    setToggleLoading(true)
    setToggleNotice(null)

    try {
      const res = await fetch("/api/admin/startup-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState })
      })

      if (res.ok) {
        const data = await res.json()
        setConfig(prev => ({ ...prev, enabled: nextState }))
        setToggleNotice(
          nextState
            ? "🟢 Startup Announcement is now ENABLED! It will display on app/website launch according to your dismissal rules."
            : "⚪ Startup Announcement is now DISABLED (OFF). App and website will open directly."
        )
        setTimeout(() => setToggleNotice(null), 5000)
      } else {
        const data = await res.json()
        alert("Failed to toggle status: " + (data.message || "Unknown error"))
      }
    } catch (err: any) {
      alert("Network error: " + err.message)
    } finally {
      setToggleLoading(false)
    }
  }

  // Handle Device File Upload
  const handleFileUpload = async (fileToUpload: File) => {
    if (!fileToUpload) return

    // 4.5 MB Vercel Serverless payload limit check
    if (fileToUpload.size > 4.5 * 1024 * 1024) {
      alert(
        `File is ${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB.\n\nDirect server uploads have a 4.5 MB limit. For high-resolution or longer videos, paste a YouTube link under the "Web Link / YouTube" tab for 100% free, unlimited HD streaming without using any database quota!`
      )
      return
    }

    setUploadLoading(true)
    const formData = new FormData()
    formData.append("file", fileToUpload)

    try {
      const res = await fetch("/api/admin/startup-popup/upload", {
        method: "POST",
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setConfig(prev => ({ ...prev, mediaUrl: data.url }))
        setUploadedInfo({
          filename: data.filename || fileToUpload.name,
          size: fileToUpload.size,
          storage: data.storage || "Vercel / Supabase"
        })
      } else {
        const err = await res.json()
        alert("Upload failed: " + (err.message || "Unknown error"))
      }
    } catch (e: any) {
      alert("Network error during file upload: " + e.message)
    } finally {
      setUploadLoading(false)
    }
  }

  // Save Content & Dismissal Rules
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSaveSuccess(false)

    try {
      const res = await fetch("/api/admin/startup-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
      } else {
        const data = await res.json()
        alert("Failed to save: " + (data.message || "Unknown error"))
      }
    } catch (err: any) {
      alert("Network error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (type: StartupPopupType) => {
    if (type === "VIDEO") {
      setConfig(prev => ({
        ...prev,
        type: "VIDEO",
        title: "How ElderSaath Keeps Loved Ones Safe",
        message: "Watch this short guide on how SOS alerts and smart medication reminders work.",
        mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        buttonText: "Got It, Continue",
        buttonLink: "",
        dismissMode: "FULL_VIDEO_REQUIRED",
        lockDurationSeconds: 20
      }))
      setMediaSourceTab("LINK")
    } else if (type === "IMAGE") {
      setConfig(prev => ({
        ...prev,
        type: "IMAGE",
        title: "Diwali Wishes from ElderSaath!",
        message: "Wishing all our elders and families good health, happiness, and safety this festive season.",
        mediaUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop",
        buttonText: "Open App",
        buttonLink: "",
        dismissMode: "TIMER_REQUIRED",
        lockDurationSeconds: 5
      }))
      setMediaSourceTab("LINK")
    } else {
      setConfig(prev => ({
        ...prev,
        type: "TEXT",
        title: "Important App Update",
        message: "Our servers have moved to Mumbai for ultra-fast performance. If you have any questions, our support team is available 24/7.",
        mediaUrl: "",
        buttonText: "Continue to Dashboard",
        buttonLink: "",
        dismissMode: "IMMEDIATE",
        lockDurationSeconds: 0
      }))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const formatDurationDisplay = (seconds: number) => {
    if (seconds <= 0) return "0 seconds"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0 && secs > 0) return `${mins} minute${mins > 1 ? "s" : ""} ${secs} second${secs > 1 ? "s" : ""}`
    if (mins > 0) return `${mins} minute${mins > 1 ? "s" : ""}`
    return `${secs} seconds`
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              Admin Control Center
            </span>
          </div>
          <h3 className="text-xl font-black tracking-tight text-white">Startup Announcement & Media Modal</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Upload videos or posters directly from your device, configure YouTube links, set dismissal countdown rules, and control the close button.
          </p>
        </div>

        {/* Master Quick Switch in Header */}
        <div className="flex items-center gap-3 bg-white/10 p-2.5 px-4 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Master Power</div>
            <div className={`text-xs font-black ${config.enabled ? "text-emerald-300" : "text-slate-400"}`}>
              {config.enabled ? "LIVE & ACTIVE" : "DISABLED (OFF)"}
            </div>
          </div>
          <button
            type="button"
            disabled={toggleLoading}
            onClick={() => handleTogglePower()}
            title={config.enabled ? "Click to Disable Startup Popup" : "Click to Enable Startup Popup"}
            className={`w-14 h-7 rounded-full relative transition-colors focus:outline-none disabled:opacity-50 ${
              config.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md flex items-center justify-center transition-transform ${
                config.enabled ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {toggleLoading ? (
                <Loader2 className="w-3 h-3 text-slate-700 animate-spin" />
              ) : (
                <Power className={`w-3 h-3 ${config.enabled ? "text-emerald-600" : "text-slate-400"}`} />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* High-Visibility Status Banner */}
      <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
        config.enabled
          ? "bg-emerald-50/70 border-emerald-200"
          : "bg-slate-100/70 border-slate-200"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
            config.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}>
            <Power className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                config.enabled ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              }`} />
              <h4 className={`text-sm font-black tracking-tight ${
                config.enabled ? "text-emerald-950" : "text-slate-900"
              }`}>
                {config.enabled
                  ? "POPUP STATUS: ENABLED & ACTIVE ON ALL DEVICES"
                  : "POPUP STATUS: CURRENTLY DISABLED (OFF)"}
              </h4>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {config.enabled
                ? "Every time any user launches the Android app, iOS app, or website, this popup will appear."
                : "App and website launch normally without any startup announcement or popup."}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={toggleLoading}
          onClick={() => handleTogglePower()}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 self-start md:self-auto shrink-0 disabled:opacity-50 ${
            config.enabled
              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
          }`}
        >
          {toggleLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating Status...</span>
            </>
          ) : config.enabled ? (
            <>
              <Power className="w-4 h-4" />
              <span>Turn OFF / Disable Popup</span>
            </>
          ) : (
            <>
              <Power className="w-4 h-4" />
              <span>Turn ON / Enable Popup</span>
            </>
          )}
        </button>
      </div>

      {toggleNotice && (
        <div className={`p-4 border-b text-xs font-bold ${
          config.enabled
            ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
            : "bg-slate-200/80 border-slate-300 text-slate-800"
        }`}>
          {toggleNotice}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="p-6 space-y-8">
        {/* SECTION 1: Content & Media Type */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">1. Media & Announcement Content</h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Startup Content Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: "TEXT" as StartupPopupType, label: "Text Notice", icon: FileText, desc: "Announcement card" },
                { type: "IMAGE" as StartupPopupType, label: "Photo / Poster", icon: ImageIcon, desc: "Banner, poster, greeting image" },
                { type: "VIDEO" as StartupPopupType, label: "Video", icon: Film, desc: "Upload video or YouTube link" }
              ].map(item => {
                const isSelected = config.type === item.type
                const Icon = item.icon
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      const newDismissMode = item.type !== "VIDEO" && config.dismissMode === "FULL_VIDEO_REQUIRED"
                        ? "TIMER_REQUIRED"
                        : config.dismissMode
                      setConfig(prev => ({ ...prev, type: item.type, dismissMode: newDismissMode }))
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-500"}`} />
                      <span className="font-bold text-sm">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{item.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title and Media Upload/Link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Announcement Title</label>
                <button
                  type="button"
                  onClick={() => loadExample(config.type)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Load Template
                </button>
              </div>
              <input
                type="text"
                required
                value={config.title}
                onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm"
                placeholder="e.g. Welcome to ElderSaath"
              />
            </div>

            {/* Media Upload / URL Section (When IMAGE or VIDEO is selected) */}
            {config.type !== "TEXT" && (
              <div className="md:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {config.type === "VIDEO" ? "Video Source" : "Photo / Poster Source"}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Choose whether to upload a file directly from this device or paste an external link / YouTube URL.
                    </p>
                  </div>

                  {/* Tabs: Upload vs Link */}
                  <div className="flex bg-slate-200 p-1 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setMediaSourceTab("UPLOAD")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        mediaSourceTab === "UPLOAD"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload from Device
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaSourceTab("LINK")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        mediaSourceTab === "LINK"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      {config.type === "VIDEO" ? "YouTube / Web Link" : "Web Image Link"}
                    </button>
                  </div>
                </div>

                {/* TAB A: Upload from Device */}
                {mediaSourceTab === "UPLOAD" && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={config.type === "VIDEO" ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" : "image/*"}
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadFile(file)
                          handleFileUpload(file)
                        }
                      }}
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 group-hover:scale-110 transition flex items-center justify-center">
                        {uploadLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-800">
                          {uploadLoading
                            ? "Uploading file to server..."
                            : config.type === "VIDEO"
                            ? "Click to browse & upload video from your device"
                            : "Click to browse & upload photo from your device"}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {config.type === "VIDEO"
                            ? "Supports MP4, WebM, MOV (Max 4.5 MB for direct serverless upload)"
                            : "Supports PNG, JPG, WebP, GIF"}
                        </p>
                      </div>
                    </div>

                    {/* Active Upload Success Badge */}
                    {config.mediaUrl && (config.mediaUrl.startsWith("data:") || config.mediaUrl.includes("blob.vercel-storage.com")) && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-emerald-900 font-semibold truncate">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            Device file active: {uploadedInfo?.filename || "Uploaded media file"}
                          </span>
                          {uploadedInfo?.size && (
                            <span className="text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded text-[10px]">
                              {formatFileSize(uploadedInfo.size)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig(prev => ({ ...prev, mediaUrl: "" }))
                            setUploadedInfo(null)
                            setUploadFile(null)
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB B: Paste Link / YouTube */}
                {mediaSourceTab === "LINK" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {config.type === "VIDEO" ? "Video URL (YouTube link or .mp4 link)" : "Photo / Image URL"}
                    </label>
                    <input
                      type="url"
                      value={config.mediaUrl.startsWith("data:") ? "" : config.mediaUrl}
                      onChange={e => setConfig(prev => ({ ...prev, mediaUrl: e.target.value }))}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm font-mono"
                      placeholder={
                        config.type === "VIDEO"
                          ? "https://www.youtube.com/watch?v=... or https://mysite.com/video.mp4"
                          : "https://images.unsplash.com/... or https://..."
                      }
                    />
                    <p className="text-[11px] text-slate-500">
                      {config.type === "VIDEO"
                        ? "Paste any standard YouTube watch or Shorts link. YouTube handles HD compression, fast mobile buffering, and consumes 0 MB of your Supabase storage quota."
                        : "Paste any publicly accessible image link (JPG, PNG, WebP)."}
                    </p>
                  </div>
                )}

                {/* Storage & Free Tier Quota Information Box */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3">
                  <HardDrive className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-slate-600">
                    <span className="font-bold text-slate-800 block">
                      Storage & Free Tier Quota Breakdown
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                      <li>
                        <strong>Supabase Free Database:</strong> 500 MB total disk storage. Notice text, title, and settings are saved here.
                      </li>
                      <li>
                        <strong>Device File Uploads:</strong> Files uploaded here are hosted on Vercel Blob CDN / Supabase (1 GB Free file quota). Direct serverless upload is limited to 4.5 MB.
                      </li>
                      <li>
                        <strong>YouTube Link Strategy:</strong> YouTube hosts videos for <strong>100% Free with Unlimited Storage and Bandwidth</strong>. For videos larger than a few megabytes, pasting a YouTube link is the recommended zero-cost choice!
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description / Message (Optional)</label>
              <textarea
                rows={3}
                value={config.message}
                onChange={e => setConfig(prev => ({ ...prev, message: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm resize-none"
                placeholder="Enter message details or description..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Action Button Text</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={e => setConfig(prev => ({ ...prev, buttonText: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm"
                placeholder="e.g. Continue to App"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Action Button Link (Optional)</label>
              <input
                type="text"
                value={config.buttonLink}
                onChange={e => setConfig(prev => ({ ...prev, buttonLink: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm"
                placeholder="e.g. /elder/medications or https://..."
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Dismissal, Timer & Close Button Rules */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">2. Dismissal & Close Button Power Controls</h4>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-6">
            {/* Control A: Show or Hide the Close (X) Cross Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">Show &apos;X&apos; Close Button in Top Corner</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {config.showCloseButton
                    ? "Cross button is enabled (will appear either immediately or after the required timer/video finishes)."
                    : "Cross button is completely disabled. Users must click the bottom action button to proceed."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, showCloseButton: !prev.showCloseButton }))}
                className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                  config.showCloseButton ? "bg-indigo-600" : "bg-slate-400"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    config.showCloseButton ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Control B: Dismissal Timing Rule */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                When Can the User Close or Proceed?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Immediate */}
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, dismissMode: "IMMEDIATE" }))}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    config.dismissMode === "IMMEDIATE"
                      ? "border-emerald-600 bg-emerald-50/60 text-emerald-950 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-600 font-bold text-lg">⚡</span>
                    <span className="font-bold text-sm">Allow Immediate Close</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    User can close or skip the announcement immediately with no waiting required.
                  </p>
                </button>

                {/* 2. Required Timer */}
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    dismissMode: "TIMER_REQUIRED",
                    lockDurationSeconds: prev.lockDurationSeconds > 0 ? prev.lockDurationSeconds : 10
                  }))}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    config.dismissMode === "TIMER_REQUIRED"
                      ? "border-amber-600 bg-amber-50/60 text-amber-950 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-sm">Require Viewing Timer</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    User must view for a set number of seconds or minutes before the close button unlocks.
                  </p>
                </button>

                {/* 3. Full Video Required */}
                <button
                  type="button"
                  disabled={config.type !== "VIDEO"}
                  onClick={() => setConfig(prev => ({ ...prev, dismissMode: "FULL_VIDEO_REQUIRED" }))}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    config.dismissMode === "FULL_VIDEO_REQUIRED"
                      ? "border-purple-600 bg-purple-50/60 text-purple-950 shadow-sm"
                      : config.type === "VIDEO"
                      ? "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                      : "border-slate-100 bg-slate-100/50 text-slate-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-sm">Require Full Video</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {config.type === "VIDEO"
                      ? "User must watch until the video finishes playing before close unlocks."
                      : "Only applicable when Content Format is set to Video."}
                  </p>
                </button>
              </div>
            </div>

            {/* Control C: Duration Seconds / Minutes Config (Active when timer or video fallback) */}
            {(config.dismissMode === "TIMER_REQUIRED" || config.dismissMode === "FULL_VIDEO_REQUIRED") && (
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-amber-500" />
                    {config.dismissMode === "FULL_VIDEO_REQUIRED"
                      ? "Safety Fallback Duration (Seconds)"
                      : "Required Minimum Duration (Seconds)"}
                  </label>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    Current Lock: {formatDurationDisplay(config.lockDurationSeconds)}
                  </span>
                </div>

                {/* Quick Preset Pills */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: "5s", sec: 5 },
                    { label: "10s", sec: 10 },
                    { label: "15s", sec: 15 },
                    { label: "30s", sec: 30 },
                    { label: "1 Min (60s)", sec: 60 },
                    { label: "2 Mins (120s)", sec: 120 },
                    { label: "5 Mins (300s)", sec: 300 }
                  ].map(pill => (
                    <button
                      key={pill.sec}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, lockDurationSeconds: pill.sec }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        config.lockDurationSeconds === pill.sec
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={config.lockDurationSeconds}
                    onChange={e => setConfig(prev => ({ ...prev, lockDurationSeconds: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-32 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-black text-slate-900 text-sm text-center"
                  />
                  <span className="text-xs text-slate-500">
                    Exact seconds user is required to view before skip/close is unlocked.
                  </span>
                </div>
              </div>
            )}

            {/* Control D: Auto-Dismiss Once Complete */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">Auto-dismiss Popup When Finished</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {config.autoCloseOnComplete
                    ? "Popup will automatically disappear on its own as soon as the timer ends or full video finishes."
                    : "Popup will stay on screen with the close/continue button unlocked so users can finish reading."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, autoCloseOnComplete: !prev.autoCloseOnComplete }))}
                className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                  config.autoCloseOnComplete ? "bg-emerald-600" : "bg-slate-400"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    config.autoCloseOnComplete ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition flex items-center gap-2 shadow-sm"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              {previewOpen ? "Hide Preview" : "Live Preview"}
            </button>
            {saveSuccess && (
              <span className="text-emerald-600 text-xs font-bold inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> All settings and media saved live!
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Saving Settings..." : "Save & Publish All Settings"}
          </button>
        </div>
      </form>

      {/* Live Preview Box */}
      {previewOpen && (
        <div className="p-6 bg-slate-950 border-t border-slate-800 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Live Preview (Reflecting Current Uploaded Media & Dismissal Rules)
          </div>
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-3xl p-5 text-left shadow-2xl space-y-3 relative overflow-hidden">
            {/* Top-Right Preview Indicator */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
              {config.dismissMode !== "IMMEDIATE" ? (
                <div className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{config.lockDurationSeconds}s</span>
                </div>
              ) : config.showCloseButton ? (
                <div className="p-1.5 rounded-full bg-slate-800 text-slate-400">
                  <X className="w-3.5 h-3.5" />
                </div>
              ) : null}
            </div>

            {config.type === "VIDEO" && config.mediaUrl && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {config.mediaUrl.startsWith("data:") || config.mediaUrl.endsWith(".mp4") || config.mediaUrl.includes("blob.vercel-storage.com") ? (
                  <video src={config.mediaUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <PlayCircle className="w-12 h-12 text-white/50" />
                )}
              </div>
            )}
            {config.type === "IMAGE" && config.mediaUrl && (
              <img src={config.mediaUrl} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
            )}
            <h4 className="text-lg font-bold text-white">{config.title || "Announcement Title"}</h4>
            {config.message && <p className="text-xs text-slate-300">{config.message}</p>}

            {/* Bottom Button Preview */}
            <div className="pt-2">
              {config.dismissMode !== "IMMEDIATE" ? (
                <div className="py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs text-center flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {config.dismissMode === "FULL_VIDEO_REQUIRED"
                      ? "Locked until video ends"
                      : `Locked for ${config.lockDurationSeconds}s`}
                  </span>
                </div>
              ) : (
                <div className="py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs text-center">
                  {config.buttonText || "Continue to App"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
