"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { Layers, Bell, BatteryWarning, ShieldAlert } from "lucide-react"

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
    alert("CRITICAL FOR XIAOMI / REDMI / POCO:\n\n1. Tap 'Display pop-up windows while running in background' -> choose 'Always allow'\n2. Tap 'Show on Lock screen' -> choose 'Always allow'\n\nOpening settings now...");
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
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
        <h1 className="text-2xl font-extrabold text-white mb-2">Priority Setup</h1>
        <p className="text-sm text-slate-400 mb-8">
          Enable these permissions so life-saving alarms and SOS wake up your phone instantly.
        </p>

        <div className="space-y-4">
          {/* Step 1: Overlay */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${overlayGranted ? 'bg-emerald-900/30 border-emerald-500/30 opacity-50' : 'bg-slate-700 border-slate-600'}`}>
            <div className={`p-3 rounded-full ${overlayGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">1. Display Over Apps</h3>
              <p className="text-xs text-slate-400">Pops up alarm screen</p>
            </div>
            {!overlayGranted ? (
              <button onClick={handleRequestOverlay} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition">
                Enable
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-sm pr-2">Done</span>
            )}
          </div>

          {/* Step 2: Push Notifications */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${pushGranted ? 'bg-emerald-900/30 border-emerald-500/30 opacity-50' : 'bg-slate-700 border-slate-600'}`}>
            <div className={`p-3 rounded-full ${pushGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">2. Notifications</h3>
              <p className="text-xs text-slate-400">Receive Med Alerts</p>
            </div>
            {!pushGranted ? (
              <button onClick={handleRequestPush} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition">
                Enable
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-sm pr-2">Done</span>
            )}
          </div>
          
          {/* Step 3: Battery Optimization */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${batteryGranted ? 'bg-emerald-900/30 border-emerald-500/30 opacity-50' : 'bg-slate-700 border-slate-600'}`}>
            <div className={`p-3 rounded-full ${batteryGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
              <BatteryWarning className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-white text-sm">3. No Battery Restrictions</h3>
              <p className="text-xs text-slate-400">Prevents phone sleep-kill</p>
            </div>
            {!batteryGranted ? (
              <button onClick={handleOpenBatterySettings} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-sm transition whitespace-nowrap">
                Allow
              </button>
            ) : (
              <span className="text-emerald-400 font-bold text-sm pr-2">Done</span>
            )}
          </div>

          {/* Step 4: Xiaomi / MIUI Specific Permission */}
          {isMiui && (
            <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${miuiGranted ? 'bg-emerald-900/30 border-emerald-500/30 opacity-50' : 'bg-rose-950/40 border-rose-500/40'}`}>
              <div className={`p-3 rounded-full ${miuiGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-white text-sm">4. MI Background Pop-up</h3>
                <p className="text-xs text-rose-300">Required for MIUI / Xiaomi</p>
              </div>
              {!miuiGranted ? (
                <button onClick={handleOpenMiuiSettings} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-sm transition whitespace-nowrap">
                  Allow
                </button>
              ) : (
                <span className="text-emerald-400 font-bold text-sm pr-2">Done</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
