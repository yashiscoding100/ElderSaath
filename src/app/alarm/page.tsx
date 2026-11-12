
"use client"

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LocalNotifications } from "@capacitor/local-notifications"
import { Capacitor } from "@capacitor/core"

const subscribeNoop = () => () => {}

function getStoredAlarmSettingsSnapshot(): string {
  try {
    return localStorage.getItem("eldersaath_alarm_settings") || ""
  } catch {
    return ""
  }
}

function getServerAlarmSettingsSnapshot(): string {
  return ""
}

function safeDecodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeHexColor(val: unknown, fallback: string): string {
  return typeof val === "string" && /^#[0-9A-Fa-f]{6}$/.test(val.trim())
    ? val.trim().toUpperCase()
    : fallback
}

function getContrastTextColor(hex: string): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#0F172A" : "#FFFFFF"
}

function AlarmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storedRaw = useSyncExternalStore(
    subscribeNoop,
    getStoredAlarmSettingsSnapshot,
    getServerAlarmSettingsSnapshot
  )

  const storedSettings = useMemo(() => {
    try {
      return storedRaw ? (JSON.parse(storedRaw) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }, [storedRaw])
  
  const label = searchParams.get("label") || "EMERGENCY ALARM!"
  const body = searchParams.get("body") || "Please check the notification for more details."
  const snoozeDuration = parseInt(searchParams.get("snooze") || "10", 10)
  const snoozeText = searchParams.get("snoozeText") || "I'll take the medicines later"

  const buttonOrderParam = searchParams.get("buttonOrder")
  const buttonOrder =
    buttonOrderParam === "SNOOZE_FIRST" || (!buttonOrderParam && storedSettings.alarmButtonOrder === "SNOOZE_FIRST")
      ? "SNOOZE_FIRST"
      : "TAKE_FIRST"

  const takeBtnColor = normalizeHexColor(
    searchParams.get("takeBtnColor") || storedSettings.alarmTakeBtnColor,
    "#10B981"
  )
  const snoozeBtnColor = normalizeHexColor(
    searchParams.get("snoozeBtnColor") || storedSettings.alarmSnoozeBtnColor,
    "#334155"
  )
  const isEmergencySos = /SOS|EMERGENCY/i.test(safeDecodeParam(label))

  const effectiveOrder = isEmergencySos ? "TAKE_FIRST" : buttonOrder
  const effectiveTakeColor = isEmergencySos ? "#10B981" : takeBtnColor
  const effectiveSnoozeColor = isEmergencySos ? "#4B5563" : snoozeBtnColor

  useEffect(() => {
    // Play a gentle repetitive chime instead of aggressive harsh beep
    try {
      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioContextCtor()
      
      const playChime = () => {
        if (audioCtx.state === "closed") return
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime)
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2)
        
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0)
        
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 1.0)
      }
      
      const beepInterval = setInterval(playChime, 1500)
      
      return () => {
        clearInterval(beepInterval)
        if (audioCtx.state !== "closed") {
          audioCtx.close()
        }
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e)
    }
  }, [])

  const handleStop = () => {
    router.replace("/dashboard")
  }

  const handleSnooze = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.requestPermissions()
        const nowTime = new Date().getTime()

        await LocalNotifications.schedule({
          notifications: [
            {
              title: safeDecodeParam(label),
              body: "Snooze timer finished! " + safeDecodeParam(label),
              id: nowTime,
              schedule: { at: new Date(nowTime + snoozeDuration * 60 * 1000) },
              sound: "default",
              actionTypeId: "",
              extra: {
                type: "ALARM",
                label: safeDecodeParam(label),
                body: safeDecodeParam(body),
                snoozeDuration: snoozeDuration,
                snoozeText: safeDecodeParam(snoozeText),
                alarmButtonOrder: buttonOrder,
                alarmTakeBtnColor: takeBtnColor,
                alarmSnoozeBtnColor: snoozeBtnColor
              }
            }
          ]
        })
        alert(`Snoozed! Waking you up again in ${snoozeDuration} mins.`)
      } catch (err) {
        console.error("Local notification error", err)
        alert(`Snoozed for ${snoozeDuration} minutes.`)
      }
    } else {
      alert(`Snoozed for ${snoozeDuration} minutes.`)
    }
    
    router.replace("/dashboard")
  }

  const takeBtnElement = (
    <button
      key="take"
      onClick={handleStop}
      style={{
        backgroundColor: effectiveTakeColor,
        color: getContrastTextColor(effectiveTakeColor)
      }}
      className="w-full py-4 text-[18px] font-bold rounded-[30px] hover:scale-95 transition-transform shadow-lg border-2 border-white/15"
    >
      TAKE MEDICINE / STOP ALARM
    </button>
  )

  const snoozeBtnElement = (
    <button
      key="snooze"
      onClick={handleSnooze}
      style={{
        backgroundColor: effectiveSnoozeColor,
        color: getContrastTextColor(effectiveSnoozeColor)
      }}
      className="w-full py-4 border-[3px] border-white/25 text-[16px] font-medium rounded-[30px] hover:scale-95 transition-transform shadow"
    >
      {safeDecodeParam(snoozeText)} ({snoozeDuration}M)
    </button>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#1E1B4B] to-[#312E81]">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md text-center">
        
        <h1 className="text-[32px] font-bold text-white mb-8">
          {safeDecodeParam(label)}
        </h1>

        <p className="text-[18px] text-[#E0E7FF] mb-16 px-4">
          {safeDecodeParam(body)}
        </p>
        
        <div className="w-full flex flex-col gap-6 mt-4">
          {effectiveOrder === "SNOOZE_FIRST"
            ? [snoozeBtnElement, takeBtnElement]
            : [takeBtnElement, snoozeBtnElement]}
        </div>
      </div>
    </div>
  )
}

export default function AlarmPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#1E1B4B] flex items-center justify-center text-white text-3xl font-bold">LOADING...</div>}>
      <AlarmContent />
    </Suspense>
  )
}
