"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

export function MedicationAlarmSync() {
  const { data: session } = useSession()
  const isSyncing = useRef(false)

  const fetchAndSync = async () => {
    if (!session || session.user.role !== "ELDER") return
    if (isSyncing.current) return
    isSyncing.current = true

    try {
      const res = await fetch("/api/medications")
      if (!res.ok) {
        isSyncing.current = false
        return
      }

      const meds = await res.json()
      if (Array.isArray(meds)) {
        // 1. Cache to local offline storage
        try {
          localStorage.setItem("eldersaath_cached_medications", JSON.stringify(meds))
          localStorage.setItem("eldersaath_meds_last_synced", new Date().toISOString())
        } catch (e) {
          console.warn("[MedicationAlarmSync] LocalStorage cache warning:", e)
        }

        // 2. Sync with Native Android Hardware AlarmManager
        const capacitor = (window as any).Capacitor
        const AlarmSyncPlugin = capacitor?.Plugins?.AlarmSyncPlugin

        if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncAlarms === "function") {
          try {
            const syncResult = await AlarmSyncPlugin.syncAlarms({ medications: meds })
            console.log(`[MedicationAlarmSync] Synced ${syncResult?.count || meds.length} alarms directly into Android AlarmManager.`)
          } catch (pluginErr) {
            console.error("[MedicationAlarmSync] AlarmSyncPlugin.syncAlarms failed:", pluginErr)
          }
        } else {
          console.log("[MedicationAlarmSync] Web mode: cached", meds.length, "medications locally.")
        }
      }
    } catch (err) {
      console.warn("[MedicationAlarmSync] Sync fetch error:", err)
    } finally {
      isSyncing.current = false
    }
  }

  useEffect(() => {
    if (!session || session.user.role !== "ELDER") return

    // Expose global helper for instant re-sync
    ;(window as any).__syncElderAlarms = fetchAndSync

    // Initial sync on app load
    fetchAndSync()

    // Sync when coming back online or switching back to the app
    const handleOnline = () => fetchAndSync()
    const handleFocus = () => fetchAndSync()
    const handleCustomSync = () => fetchAndSync()

    window.addEventListener("online", handleOnline)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("eldersaath:refresh-medications", handleCustomSync)

    // Periodic check every 5 minutes in background
    const interval = setInterval(fetchAndSync, 5 * 60 * 1000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("eldersaath:refresh-medications", handleCustomSync)
      clearInterval(interval)
    }
  }, [session])

  return null
}
