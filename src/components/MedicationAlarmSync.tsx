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
      // 1. Sync Medications
      const res = await fetch("/api/medications")
      if (res.ok) {
        const meds = await res.json()
        if (Array.isArray(meds)) {
          try {
            localStorage.setItem("eldersaath_cached_medications", JSON.stringify(meds))
            localStorage.setItem("eldersaath_meds_last_synced", new Date().toISOString())
          } catch (e) {
            console.warn("[MedicationAlarmSync] LocalStorage cache warning:", e)
          }

          const capacitor = (window as any).Capacitor
          const AlarmSyncPlugin = capacitor?.Plugins?.AlarmSyncPlugin

          if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncAlarms === "function") {
            try {
              const syncResult = await AlarmSyncPlugin.syncAlarms({ medications: meds })
              console.log(`[MedicationAlarmSync] Synced ${syncResult?.count || meds.length} alarms directly into Android AlarmManager.`)
            } catch (pluginErr) {
              console.error("[MedicationAlarmSync] AlarmSyncPlugin.syncAlarms failed:", pluginErr)
            }
          }
        }
      }

      // 2. Sync SOS Widget Settings
      const sosRes = await fetch("/api/sos/settings")
      if (sosRes.ok) {
        const sosData = await sosRes.json()
        if (sosData?.config) {
          const capacitor = (window as any).Capacitor
          const AlarmSyncPlugin = capacitor?.Plugins?.AlarmSyncPlugin
          if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncSosSettings === "function") {
            try {
              await AlarmSyncPlugin.syncSosSettings({
                ambulanceNumber: sosData.config.ambulanceNumber,
                sosCallAmbulance: sosData.config.sosCallAmbulance,
                sosAlertFamily: sosData.config.sosAlertFamily,
                sosLocalSiren: sosData.config.sosLocalSiren,
                elderId: session.user.id,
                elderName: session.user.name || "Elder"
              })
              console.log("[MedicationAlarmSync] SOS Widget settings synced.")
            } catch (sosErr) {
              console.warn("[MedicationAlarmSync] SOS sync error:", sosErr)
            }
          }
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
