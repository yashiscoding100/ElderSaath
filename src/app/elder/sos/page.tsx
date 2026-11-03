"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { 
  PhoneCall, 
  ShieldAlert, 
  ArrowLeft, 
  Settings, 
  Loader2, 
  MapPin, 
  Battery, 
  Share2, 
  Volume2, 
  VolumeX, 
  Zap, 
  XCircle,
  ExternalLink
} from "lucide-react"

export default function SOSPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Tap the red button for emergency help")
  const [phase, setPhase] = useState<"IDLE" | "COUNTDOWN" | "ACTIVE">("IDLE")
  const [countdown, setCountdown] = useState(3)
  const countdownTimerRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Config State
  const [ambulanceNumber, setAmbulanceNumber] = useState("108")
  const [callAmbulance, setCallAmbulance] = useState(true)
  const [callTarget, setCallTarget] = useState("AMBULANCE")
  const [customPhone, setCustomPhone] = useState("")
  const [sirenMode, setSirenMode] = useState<"LOUD" | "SILENT">("LOUD")
  const [strobeFlashlight, setStrobeFlashlight] = useState(true)
  const [countdownSeconds, setCountdownSeconds] = useState(3)
  const [shareLocation, setShareLocation] = useState(true)
  const [shareBattery, setShareBattery] = useState(true)

  // Telemetry gathered during trigger
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; isCharging: boolean } | null>(null)
  const [mapsUrl, setMapsUrl] = useState("")

  useEffect(() => {
    fetch("/api/sos/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.config) {
          const cfg = data.config
          if (cfg.ambulanceNumber) setAmbulanceNumber(cfg.ambulanceNumber)
          if (cfg.sosCallAmbulance !== undefined) setCallAmbulance(cfg.sosCallAmbulance)
          if (cfg.sosCallTarget) setCallTarget(cfg.sosCallTarget)
          if (cfg.sosCustomPhone) setCustomPhone(cfg.sosCustomPhone)
          if (cfg.sosSirenMode) setSirenMode(cfg.sosSirenMode)
          if (cfg.sosStrobeFlashlight !== undefined) setStrobeFlashlight(cfg.sosStrobeFlashlight)
          if (typeof cfg.sosCountdownSeconds === "number") setCountdownSeconds(cfg.sosCountdownSeconds)
          if (cfg.sosShareLocation !== undefined) setShareLocation(cfg.sosShareLocation)
          if (cfg.sosShareBattery !== undefined) setShareBattery(cfg.sosShareBattery)
        }
      })
      .catch(() => {})
  }, [])

  // Audio helper for countdown and siren
  const playBeep = (freq = 750, duration = 0.15) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.8, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch (e) {
      console.warn("AudioContext error:", e)
    }
  }

  const triggerDirectCall = (phoneToCall: string) => {
    const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null)
    if (cap?.isNativePlatform && cap?.Plugins?.AlarmSyncPlugin?.directCall) {
      cap.Plugins.AlarmSyncPlugin.directCall({ phone: phoneToCall }).catch(() => {
        window.location.href = `tel:${phoneToCall}`
      })
    } else {
      window.location.href = `tel:${phoneToCall}`
    }
  }

  const triggerStrobeTorch = () => {
    const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null)
    if (cap?.isNativePlatform && cap?.Plugins?.AlarmSyncPlugin?.strobeFlashlight) {
      cap.Plugins.AlarmSyncPlugin.strobeFlashlight({ duration: 20 }).catch(() => {})
    }
  }

  const getPhoneToCall = () => {
    if (callTarget === "CUSTOM" && customPhone.trim().length > 0) {
      return customPhone.trim()
    }
    return ambulanceNumber || "108"
  }

  const executeSos = async (coords?: { latitude: number; longitude: number; accuracy?: number }) => {
    setPhase("ACTIVE")
    setStatus("🚨 EMERGENCY BEACON TRANSMITTING...")

    // 1. Hardware Torch Strobe
    if (strobeFlashlight) {
      triggerStrobeTorch()
    }

    // 2. Read Battery State if supported
    let batteryLvl: number | null = null
    let charging = false
    if (shareBattery && typeof navigator !== "undefined" && "getBattery" in navigator) {
      try {
        const bat: any = await (navigator as any).getBattery()
        batteryLvl = Math.round(bat.level * 100)
        charging = bat.charging
        setBatteryInfo({ level: batteryLvl, isCharging: charging })
      } catch (e) {}
    }

    // 3. Post to Emergency SOS Cloud Dispatcher
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          accuracy: coords?.accuracy || null,
          batteryLevel: batteryLvl,
          isCharging: charging,
          source: "IN_APP_BUTTON"
        })
      })

      const data = await res.json()
      if (data?.mapsLink) {
        setMapsUrl(data.mapsLink)
      } else if (coords) {
        setMapsUrl(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)
      }

      setStatus("🚨 Family alerted with emergency siren!")

      // 4. Automatically place call directly via native dialer
      if (callAmbulance) {
        const targetNumber = getPhoneToCall()
        setTimeout(() => {
          triggerDirectCall(targetNumber)
        }, 1200)
      }
    } catch (e) {
      setStatus("Alert sent locally. Placing emergency call...")
      if (callAmbulance) {
        triggerDirectCall(getPhoneToCall())
      }
    }
  }

  const handleStartCountdown = () => {
    if (countdownSeconds <= 0) {
      handleAcquireLocationAndFire()
      return
    }

    setPhase("COUNTDOWN")
    setCountdown(countdownSeconds)
    playBeep(880, 0.2)

    let remaining = countdownSeconds
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        playBeep(880, 0.2)
      } else {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
        handleAcquireLocationAndFire()
      }
    }, 1000)
  }

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setPhase("IDLE")
    setStatus("Emergency SOS cancelled. You are safe.")
  }

  const handleAcquireLocationAndFire = () => {
    setStatus("Capturing live GPS location...")

    if (shareLocation && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setLocationCoords(coords)
          setMapsUrl(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)
          executeSos(coords)
        },
        () => {
          executeSos()
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    } else {
      executeSos()
    }
  }

  const handleWhatsAppShare = () => {
    const maps = mapsUrl || (locationCoords ? `https://www.google.com/maps?q=${locationCoords.latitude},${locationCoords.longitude}` : "")
    const bat = batteryInfo ? ` (Battery: ${batteryInfo.level}%)` : ""
    const msg = encodeURIComponent(
      `🚨 EMERGENCY SOS ALERT! I need immediate help!${maps ? `\n📍 My Live Location: ${maps}` : ""}${bat}\nPlease call or send assistance right now!`
    )
    window.open(`https://wa.me/?text=${msg}`, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/elder/home")}
            className="p-3 bg-white border border-red-200 rounded-full text-slate-700 shadow-sm hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <h1 className="text-2xl font-black text-red-700 tracking-tight">EMERGENCY SOS</h1>
          </div>
          <button
            onClick={() => router.push("/elder/settings")}
            className="p-3 bg-white border border-red-200 rounded-full text-slate-700 shadow-sm hover:bg-slate-100 transition"
            title="Configure SOS Settings"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Phase: IDLE - Giant Primary SOS Button */}
        {phase === "IDLE" && (
          <div className="space-y-6 animate-fade-in">
            <button 
              onClick={handleStartCountdown}
              className="w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-2xl flex flex-col items-center justify-center border-8 border-red-200 active:scale-95 transition-transform hover:shadow-red-500/50"
            >
              <ShieldAlert className="w-14 h-14 text-white/95 mb-1 animate-pulse" />
              <span className="text-white text-5xl font-black tracking-widest drop-shadow-md">SOS</span>
              <span className="text-red-100 text-xs font-bold mt-2 tracking-wider uppercase">
                {countdownSeconds > 0 ? `TAP (${countdownSeconds}s Safety Cancel)` : "1-TAP EMERGENCY"}
              </span>
            </button>

            {/* Quick Status Pill */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>ACTIVE SOS CONFIGURATION</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">🟢 Ready</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{status}</p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-slate-600">
                <span className="bg-slate-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                  📞 Calls: {getPhoneToCall()}
                </span>
                <span className="bg-slate-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                  {sirenMode === "LOUD" ? <Volume2 className="w-3.5 h-3.5 text-red-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  {sirenMode === "LOUD" ? "Loud Siren" : "Discreet Silent"}
                </span>
                {strobeFlashlight && (
                  <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-600" /> Strobe Flash
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase: COUNTDOWN - Accidental Press Safety Window */}
        {phase === "COUNTDOWN" && (
          <div className="space-y-6 animate-fade-in">
            <div className="w-64 h-64 mx-auto rounded-full bg-red-600 shadow-2xl flex flex-col items-center justify-center border-8 border-yellow-300 animate-pulse">
              <span className="text-yellow-200 text-xs font-bold uppercase tracking-wider mb-1">Triggering in</span>
              <span className="text-white text-7xl font-black">{countdown}</span>
              <span className="text-white/80 text-xs font-medium mt-1">Seconds</span>
            </div>

            <button
              onClick={handleCancelCountdown}
              className="w-full py-4 bg-white text-slate-900 border-2 border-slate-300 font-black rounded-2xl text-xl shadow-lg hover:bg-slate-100 flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <XCircle className="w-6 h-6 text-red-600" />
              <span>CANCEL (ACCIDENTAL PRESS)</span>
            </button>
            <p className="text-xs text-slate-500">Tap Cancel immediately if you touched this by mistake.</p>
          </div>
        )}

        {/* Phase: ACTIVE - Emergency Beacon is Live */}
        {phase === "ACTIVE" && (
          <div className="space-y-4 animate-fade-in text-left">
            <div className="bg-red-600 text-white p-5 rounded-2xl shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl animate-spin">
                🚨
              </div>
              <div>
                <h3 className="font-black text-lg">EMERGENCY SOS IS ACTIVE!</h3>
                <p className="text-xs text-red-100 mt-0.5">Family siren alert sounded &amp; dialer triggered.</p>
              </div>
            </div>

            {/* Live Telemetry Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Distress Telemetry</h4>
              
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm transition"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    GPS Location Captured
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {batteryInfo && (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <Battery className="w-4 h-4 text-emerald-600" />
                  <span>Battery Level: {batteryInfo.level}% {batteryInfo.isCharging ? "⚡ (Charging)" : "(On Battery)"}</span>
                </div>
              )}
            </div>

            {/* Emergency Action Buttons */}
            <div className="grid gap-3 pt-2">
              <button
                onClick={handleWhatsAppShare}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl text-base shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-5 h-5" />
                <span>Share SOS on WhatsApp</span>
              </button>

              <button
                onClick={() => triggerDirectCall(getPhoneToCall())}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl text-base shadow-lg hover:bg-red-700 flex items-center justify-center gap-2 transition"
              >
                <PhoneCall className="w-5 h-5" />
                <span>Call Emergency Number ({getPhoneToCall()})</span>
              </button>

              <button
                onClick={() => {
                  setPhase("IDLE")
                  setStatus("Emergency resolved. You are safe.")
                }}
                className="w-full py-3 bg-slate-200 text-slate-800 font-bold rounded-2xl text-sm hover:bg-slate-300 transition"
              >
                I Am Safe / Stop Alert
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
