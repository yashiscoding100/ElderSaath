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
      // 1. Fetch Medications and Tasks with Alarms in parallel
      const [medsRes, tasksRes] = await Promise.all([
        fetch("/api/medications").catch(() => null),
        fetch("/api/tasks").catch(() => null)
      ])

      const meds = medsRes && medsRes.ok ? await medsRes.json() : []
      const tasks = tasksRes && tasksRes.ok ? await tasksRes.json() : []

      // Build unified alarm items list
      const alarmItems: any[] = [
        ...(Array.isArray(meds) ? meds.map((m: any) => ({
          id: m.id,
          name: m.name,
          dosage: m.dosage || "",
          time: m.time,
          frequency: m.frequency || "daily",
          instructions: m.instructions || "",
          elderId: m.elderId || session.user.id,
          type: "MEDICATION",
          label: `Time for ${m.name}`,
          body: `Dosage: ${m.dosage || "Scheduled Dose"}${m.instructions ? ". " + m.instructions : ""}`,
          actionText: "TAKE MEDICINE / STOP ALARM"
        })) : []),
        ...(Array.isArray(tasks) ? tasks.filter((t: any) => t.triggerAlarm && t.time).map((t: any) => ({
          id: t.id,
          name: t.title,
          dosage: "",
          time: t.time,
          frequency: t.frequency || "daily",
          instructions: t.description || "",
          elderId: t.elderId || session.user.id,
          type: "TASK",
          label: `Task: ${t.title}`,
          body: t.description || "Important task scheduled for now.",
          actionText: "COMPLETE TASK / STOP ALARM"
        })) : [])
      ]

      try {
        localStorage.setItem("eldersaath_cached_alarms", JSON.stringify(alarmItems))
        localStorage.setItem("eldersaath_alarms_last_synced", new Date().toISOString())
      } catch (e) {
        console.warn("[MedicationAlarmSync] LocalStorage cache warning:", e)
      }

      const capacitor = (window as any).Capacitor
      const AlarmSyncPlugin = capacitor?.Plugins?.AlarmSyncPlugin

      // Flush any pending taken medications logged by native AlarmActivity
      if (AlarmSyncPlugin && typeof AlarmSyncPlugin.getPendingTakenMedications === "function") {
        try {
          const pendingRes = await AlarmSyncPlugin.getPendingTakenMedications()
          const pendingIds: string[] = pendingRes?.pendingIds || []
          for (const pId of pendingIds) {
            try {
              const res = await fetch("/api/medications/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ medicationId: pId, status: "TAKEN" }),
              })
              if (res.ok && typeof AlarmSyncPlugin.clearPendingTakenMedication === "function") {
                await AlarmSyncPlugin.clearPendingTakenMedication({ medicationId: pId })
              }
            } catch (pErr) {
              console.warn("[MedicationAlarmSync] Flush pending med error:", pErr)
            }
          }
        } catch (e) {
          console.warn("[MedicationAlarmSync] getPendingTakenMedications error:", e)
        }
      }

      if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncAlarms === "function") {
        try {
          const syncResult = await AlarmSyncPlugin.syncAlarms({ medications: alarmItems })
          console.log(`[MedicationAlarmSync] Synced ${syncResult?.count || alarmItems.length} alarms (meds & tasks) directly into Android AlarmManager.`)
        } catch (pluginErr) {
          console.error("[MedicationAlarmSync] AlarmSyncPlugin.syncAlarms failed:", pluginErr)
        }
      }

      // 2. Sync SOS Widget Settings
      const sosRes = await fetch("/api/sos/settings").catch(() => null)
      if (sosRes && sosRes.ok) {
        const sosData = await sosRes.json()
        if (sosData?.config) {
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

      // 3. Sync Global Custom Alarm Tone Settings
      const toneRes = await fetch("/api/alarm-tone?t=" + Date.now()).catch(() => null)
      if (toneRes && toneRes.ok) {
        const toneData = await toneRes.json()
        if (toneData?.config && AlarmSyncPlugin && typeof AlarmSyncPlugin.syncAlarmTone === "function") {
          try {
            let finalUrl = toneData.config.toneUrl || ""
            if (finalUrl && finalUrl.startsWith("/")) {
              const baseOrigin = typeof window !== "undefined" && window.location.origin.startsWith("http")
                ? window.location.origin
                : "https://eldersaath.vercel.app"
              finalUrl = baseOrigin + finalUrl
            }

            await AlarmSyncPlugin.syncAlarmTone({
              enabled: toneData.config.enabled === true,
              toneUrl: finalUrl,
              toneTitle: toneData.config.toneTitle || "Custom Tone"
            })
            console.log(`[MedicationAlarmSync] Alarm tone synced: enabled=${toneData.config.enabled}`)
          } catch (toneErr) {
            console.warn("[MedicationAlarmSync] Alarm tone sync error:", toneErr)
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
    window.addEventListener("eldersaath:refresh-tasks", handleCustomSync)

    // Periodic check every 5 minutes in background
    const interval = setInterval(fetchAndSync, 5 * 60 * 1000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("eldersaath:refresh-medications", handleCustomSync)
      window.removeEventListener("eldersaath:refresh-tasks", handleCustomSync)
      clearInterval(interval)
    }
  }, [session])

  return null
}
