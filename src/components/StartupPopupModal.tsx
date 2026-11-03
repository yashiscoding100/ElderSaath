"use client"

import { useEffect, useState, useRef } from "react"
import { X, Film, Image as ImageIcon, BellRing, ExternalLink, Clock, Lock, CheckCircle2 } from "lucide-react"
import { StartupPopupConfig, DismissMode } from "@/lib/startupPopup"

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

  // Timer & Locking state
  const [locked, setLocked] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [videoCompleted, setVideoCompleted] = useState(false)

  useEffect(() => {
    // Fetch active startup announcement with cache busting and origin resolution
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const baseUrl = (origin && !origin.includes("eldersaath.vercel.app") && !origin.includes("3000"))
      ? "https://eldersaath.vercel.app"
      : ""

    fetch(`${baseUrl}/api/startup-popup?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.config?.enabled) {
          const cfg = data.config as StartupPopupConfig
          setConfig(cfg)
          setIsOpen(true)

          const isLockedInitially = cfg.dismissMode !== "IMMEDIATE"
          setLocked(isLockedInitially)

          // ZERO fallback period for FULL_VIDEO_REQUIRED - must watch full video
          if (cfg.dismissMode === "FULL_VIDEO_REQUIRED") {
            setRemainingSeconds(0)
          } else if (cfg.dismissMode === "TIMER_REQUIRED") {
            const duration = typeof cfg.lockDurationSeconds === "number" && cfg.lockDurationSeconds > 0
              ? cfg.lockDurationSeconds
              : 10
            setRemainingSeconds(duration)
          } else {
            setRemainingSeconds(0)
          }
        }
      })
      .catch((err) => {
        console.error("StartupPopup fetch error:", err)
      })
  }, [])

  // Handle Countdown Timer (Only for TIMER_REQUIRED mode - zero fallback for FULL_VIDEO_REQUIRED)
  useEffect(() => {
    if (!isOpen || !locked || !config) return
    if (config.dismissMode !== "TIMER_REQUIRED") return

    if (remainingSeconds > 0) {
      const timer = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            setLocked(false)
            if (config.autoCloseOnComplete) {
              setTimeout(() => {
                setIsOpen(false)
                setDismissed(true)
              }, 800)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    } else if (remainingSeconds === 0) {
      setLocked(false)
      if (config.autoCloseOnComplete) {
        setIsOpen(false)
        setDismissed(true)
      }
    }
  }, [isOpen, locked, remainingSeconds, config])

  // Handle Full Video completion - STRICT unlock trigger
  const handleVideoEnded = () => {
    setVideoCompleted(true)
    setLocked(false)
    if (config?.autoCloseOnComplete) {
      setTimeout(() => {
        setIsOpen(false)
        setDismissed(true)
      }, 1000)
    }
  }

  // YouTube IFrame API integration to detect when video finishes
  const ytId = config?.type === "VIDEO" && config.mediaUrl ? extractYouTubeId(config.mediaUrl) : null
  const isDirectVideo = config?.type === "VIDEO" && !ytId && config.mediaUrl

  useEffect(() => {
    if (!isOpen || !config || config.type !== "VIDEO" || !ytId || config.dismissMode !== "FULL_VIDEO_REQUIRED") return

    // Inject YouTube API script if not present
    if (!(window as any).YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      }
    }

    let player: any = null
    const initPlayer = () => {
      try {
        if ((window as any).YT && (window as any).YT.Player) {
          player = new (window as any).YT.Player("startup-yt-player-container", {
            events: {
              onStateChange: (event: any) => {
                // YT.PlayerState.ENDED is 0
                if (event.data === 0) {
                  handleVideoEnded()
                }
              }
            }
          })
        }
      } catch (e) {
        console.warn("YouTube player init warning:", e)
      }
    }

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer()
    } else {
      const prevHandler = (window as any).onYouTubeIframeAPIReady
      ;(window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevHandler === "function") prevHandler()
        initPlayer()
      }
    }

    return () => {
      try {
        if (player && player.destroy) player.destroy()
      } catch {}
    }
  }, [isOpen, config?.dismissMode, ytId])

  if (!isOpen || !config || dismissed) return null

  const handleAction = () => {
    if (locked) return

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

  const getLockNoticeText = () => {
    if (config.dismissMode === "FULL_VIDEO_REQUIRED") {
      return "Please watch full video to continue"
    }
    return `Please view for ${remainingSeconds}s`
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top-Right Header Area: Lock Badge or Cross Button */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {locked ? (
            <div className="px-3 py-1.5 rounded-full bg-slate-800/95 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-sm animate-pulse">
              {config.dismissMode === "FULL_VIDEO_REQUIRED" ? (
                <>
                  <Film className="w-3.5 h-3.5 text-purple-400" />
                  <span>Watching Video</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{remainingSeconds > 0 ? `${remainingSeconds}s` : "Locked"}</span>
                </>
              )}
            </div>
          ) : config.showCloseButton ? (
            <button
              onClick={() => {
                setIsOpen(false)
                setDismissed(true)
              }}
              className="p-2 rounded-full bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 transition shadow-lg focus:outline-none"
              aria-label="Close"
              title="Close announcement"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {/* Media Container */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* VIDEO TYPE */}
          {config.type === "VIDEO" && (
            <div className="w-full rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center shadow-inner relative">
              {ytId ? (
                <iframe
                  id="startup-yt-player-container"
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1&rel=0&playsinline=1`}
                  title={config.title || "Startup Video"}
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
                  onEnded={handleVideoEnded}
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
        <div className="p-4 sm:p-5 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-2">
          {locked ? (
            <div className="w-full">
              <button
                disabled
                className="w-full py-3 px-5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-400 font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>{getLockNoticeText()}</span>
              </button>
              {config.dismissMode === "TIMER_REQUIRED" && config.lockDurationSeconds > 0 && (
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-amber-400 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((config.lockDurationSeconds - remainingSeconds) / config.lockDurationSeconds) * 100))}%`
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleAction}
              className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 focus:outline-none"
            >
              <CheckCircle2 className="w-4 h-4 text-blue-200" />
              <span>{config.buttonText || "Continue to App"}</span>
              {config.buttonLink && <ExternalLink className="w-4 h-4 ml-1" />}
            </button>
          )}

          {config.autoCloseOnComplete && (
            <p className="text-[11px] text-center text-slate-500 font-medium">
              This announcement will close automatically when finished.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
