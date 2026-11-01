"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { Layers, Bell, BatteryWarning, ShieldAlert, AlertTriangle, ChevronRight } from "lucide-react"

// Bind the custom local plugin written in Java
const AppPermissions = registerPlugin("AppPermissions") as any

export function MandatoryPermissions() {
  const [overlayGranted, setOverlayGranted] = useState(true)
  const [pushGranted, setPushGranted] = useState(true)
  const [batteryGranted, setBatteryGranted] = useState(true)
  const [isMiui, setIsMiui] = useState(false)
  const [miuiGranted, setMiuiGranted] = useState(true)
  const [checking, setChecking] = useState(true)

  const checkPermissions = async () => {
    if (!Capacitor.isNativePlatform()) {
      setChecking(false)
      return
    }

    try {
      // 1. Check Overlay
      const overlayRes = await AppPermissions.checkOverlayPermission()
      setOverlayGranted(overlayRes.granted)

      // 2. Check Push
      const pushRes = await PushNotifications.checkPermissions()
      setPushGranted(pushRes.receive === "granted")
      
      // 3. Check Battery
      const batDone = localStorage.getItem("batterySetupComplete") === "true"
      setBatteryGranted(batDone)

      // 4. Check if Xiaomi / Redmi / POCO
      try {
        const miRes = await AppPermissions.isMiui()
        if (miRes?.isMiui) {
          setIsMiui(true)
          const miDone = localStorage.getItem("miuiSetupComplete") === "true"
          setMiuiGranted(miDone)
        }
      } catch (ignored) {}

      // Sync FCM token if granted
      if (pushRes.receive === "granted") {
        await PushNotifications.register()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      PushNotifications.addListener("registration", async (token) => {
        try {
          await fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: "fcm:" + token.value,
              keys: { p256dh: "fcm", auth: "fcm" }
            })
          })
        } catch(e) {}
      })
      
      checkPermissions()

      // When user returns from Android Settings, re-check everything
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkPermissions()
        }
      })
    }
  }, [])

  const handleOpenBatterySettings = async () => {
    try {
      await AppPermissions.requestIgnoreBatteryOptimizations()
    } catch {
      await AppPermissions.openAppSettings()
    }
    localStorage.setItem("batterySetupComplete", "true")
    setBatteryGranted(true)
  }

  const handleOpenMiuiSettings = async () => {
    try {
      await AppPermissions.openMiuiPermissions()
    } catch {
      await AppPermissions.openAppSettings()
    }
    localStorage.setItem("miuiSetupComplete", "true")
    setMiuiGranted(true)
  }

  const handleRequestOverlay = async () => {
    await AppPermissions.requestOverlayPermission()
  }

  const handleRequestPush = async () => {
    try {
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions()
      }
      if (permStatus.receive !== "granted") {
        await AppPermissions.openAppSettings()
      } else {
        await checkPermissions()
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (checking || (!Capacitor.isNativePlatform())) return null
  if (overlayGranted && pushGranted && batteryGranted && (!isMiui || miuiGranted)) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md overflow-y-auto flex flex-col items-center justify-start p-4 py-8 text-center">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl my-auto">
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">First-Time Setup Required</h1>
        <p className="text-sm text-slate-400 mb-6">
          To ensure life-saving SOS alerts and medication alarms can wake up your phone immediately, enable the permissions below.
        </p>

        {/* Action Steps */}
        <div className="space-y-3">
          {/* Step 1: Overlay */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${overlayGranted ? 'bg-emerald-950/20 border-emerald-500/20 opacity-60' : 'bg-slate-800/80 border-slate-700'}`}>
            <div className={`p-2.5 rounded-xl ${overlayGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">1. Display Over Other Apps</h3>
              <p className="text-xs text-slate-400">Allows full-screen alarm screen</p>
            </div>
            {!overlayGranted ? (
              <button onClick={handleRequestOverlay} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition">
                Enable
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-xs pr-1">Done ✓</span>
            )}
          </div>

          {/* Step 2: Push Notifications */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${pushGranted ? 'bg-emerald-950/20 border-emerald-500/20 opacity-60' : 'bg-slate-800/80 border-slate-700'}`}>
            <div className={`p-2.5 rounded-xl ${pushGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">2. Push Notifications</h3>
              <p className="text-xs text-slate-400">Receive medicine reminders</p>
            </div>
            {!pushGranted ? (
              <button onClick={handleRequestPush} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition">
                Enable
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-xs pr-1">Done ✓</span>
            )}
          </div>
          
          {/* Step 3: Battery Optimization */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${batteryGranted ? 'bg-emerald-950/20 border-emerald-500/20 opacity-60' : 'bg-slate-800/80 border-slate-700'}`}>
            <div className={`p-2.5 rounded-xl ${batteryGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <BatteryWarning className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">3. No Battery Restrictions</h3>
              <p className="text-xs text-slate-400">Prevents phone sleep-kill</p>
            </div>
            {!batteryGranted ? (
              <button onClick={handleOpenBatterySettings} className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition whitespace-nowrap">
                Allow
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-xs pr-1">Done ✓</span>
            )}
          </div>

          {/* Step 4: Xiaomi / MIUI Shortcut */}
          {isMiui && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${miuiGranted ? 'bg-emerald-950/20 border-emerald-500/20 opacity-60' : 'bg-rose-950/30 border-rose-500/40'}`}>
              <div className={`p-2.5 rounded-xl ${miuiGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-white text-sm">4. MI Background Pop-Up</h3>
                <p className="text-xs text-rose-300">Opens Other Permissions</p>
              </div>
              {!miuiGranted ? (
                <button onClick={handleOpenMiuiSettings} className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition whitespace-nowrap flex items-center gap-1">
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-emerald-400 font-bold text-xs pr-1">Done ✓</span>
              )}
            </div>
          )}
        </div>

        {/* Prominent First-Time Setup Instructions Callout */}
        <div className="mt-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-left">
          <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Important for Xiaomi / Redmi / POCO Users</span>
          </div>
          <p className="text-xs text-amber-200/90 mb-2.5 leading-relaxed font-medium">
            Turn on these two critical permissions in your phone settings so the alarm screen pops up automatically:
          </p>
          <div className="space-y-2 text-xs text-slate-200 bg-black/40 p-3 rounded-xl border border-amber-500/20 font-medium leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-sm">🔴 ➔ 🟢</span>
              <div>
                <strong>&quot;Display pop-up windows while running in the background&quot;</strong> ➔ Set to <span className="text-emerald-400 font-bold">&quot;Always allow&quot;</span> <span className="text-slate-400 text-[11px] block mt-0.5">(This is the exact reason it wasn&apos;t popping up!)</span>
              </div>
            </div>
            <div className="flex items-start gap-2 pt-1 border-t border-slate-800">
              <span className="shrink-0 text-sm">🔴 ➔ 🟢</span>
              <div>
                <strong>&quot;Show on Lock screen&quot;</strong> ➔ Set to <span className="text-emerald-400 font-bold">&quot;Always allow&quot;</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            localStorage.setItem("batterySetupComplete", "true")
            localStorage.setItem("miuiSetupComplete", "true")
            setBatteryGranted(true)
            setMiuiGranted(true)
          }}
          className="mt-5 text-xs text-slate-500 hover:text-slate-400 underline transition"
        >
          Dismiss & Continue to App
        </button>
      </div>
    </div>
  )
}
