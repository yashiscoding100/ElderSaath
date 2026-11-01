"use client"

import { useEffect, useState } from "react"
import { X, Volume2, Film, Image as ImageIcon, BellRing, ExternalLink } from "lucide-react"

interface StartupPopupConfig {
  enabled: boolean
  type: "TEXT" | "IMAGE" | "VIDEO"
  title: string
  message: string
  mediaUrl: string
  buttonText: string
  buttonLink: string
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export function StartupPopupModal() {
  const [config, setConfig] = useState<StartupPopupConfig | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Fetch active startup announcement
    fetch("/api/startup-popup")
      .then((res) => res.json())
      .then((data) => {
        if (data?.config?.enabled) {
          setConfig(data.config)
          setIsOpen(true)
        }
      })
      .catch((err) => {
        console.error("StartupPopup fetch error:", err)
      })
  }, [])

  if (!isOpen || !config || dismissed) return null

  const ytId = config.type === "VIDEO" ? extractYouTubeId(config.mediaUrl) : null
  const isDirectVideo = config.type === "VIDEO" && !ytId && config.mediaUrl

  const handleAction = () => {
    if (config.buttonLink) {
      if (config.buttonLink.startsWith("http://") || config.buttonLink.startsWith("https://")) {
        window.open(config.buttonLink, "_blank")
      } else {
        window.location.href = config.buttonLink
      }
    }
    setIsOpen(false)
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Close Bar */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => {
              setIsOpen(false)
              setDismissed(true)
            }}
            className="p-2 rounded-full bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 transition shadow-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Container */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* VIDEO TYPE */}
          {config.type === "VIDEO" && (
            <div className="w-full rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center shadow-inner">
              {ytId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`}
                  title={config.title || "Startup Announcement Video"}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : isDirectVideo ? (
                <video
                  src={config.mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-6">
                  <Film className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-xs">Video URL not provided or invalid.</p>
                </div>
              )}
            </div>
          )}

          {/* IMAGE TYPE */}
          {config.type === "IMAGE" && (
            <div className="w-full rounded-2xl overflow-hidden bg-slate-950/60 flex items-center justify-center max-h-[50vh] border border-slate-800">
              {config.mediaUrl ? (
                <img
                  src={config.mediaUrl}
                  alt={config.title || "Announcement photo"}
                  className="w-full h-auto max-h-[50vh] object-contain rounded-2xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 py-12">
                  <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-xs">No image URL configured.</p>
                </div>
              )}
            </div>
          )}

          {/* TEXT TYPE BADGE */}
          {config.type === "TEXT" && (
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider pt-2">
              <BellRing className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Official Announcement</span>
            </div>
          )}

          {/* Title and Message */}
          <div className="text-left space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {config.title || "Announcement"}
            </h2>
            {config.message && (
              <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
                {config.message}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-slate-800 flex gap-3">
          <button
            onClick={handleAction}
            className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>{config.buttonText || "Continue to App"}</span>
            {config.buttonLink && <ExternalLink className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
