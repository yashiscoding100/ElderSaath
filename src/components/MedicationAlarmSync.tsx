"use client"

import { useCallback, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

interface SyncedMedicationDto {
  id: string
  name: string
  dosage?: string | null
  time: string
  frequency?: string | null
  instructions?: string | null
  elderId?: string
  endDate?: string | null
  specialNoticeEnabled?: boolean
  specialNoticeType?: string | null
  specialNoticeText?: string | null
  specialNoticeAudioUrl?: string | null
  specialNoticeMaxCount?: number | null
  specialNoticeShownCount?: number | null
  specialNoticeVersion?: string | null
}

interface SyncedTaskDto {
  id: string
  title: string
  description?: string | null
  time?: string | null
  frequency?: string | null
  triggerAlarm?: boolean
  elderId?: string
}

interface SyncedAlarmItem {
  id: string
  name: string
  dosage: string
  time: string
  frequency: string
  instructions: string
  elderId: string
  type: "MEDICATION" | "TASK"
  label: string
  body: string
  actionText: string
  specialNoticeEnabled?: boolean
  specialNoticeType?: "TEXT" | "VOICE"
  specialNoticeText?: string
  specialNoticeAudioUrl?: string
  specialNoticeMaxCount?: number
  specialNoticeShownCount?: number
  specialNoticeVersion?: string
}

interface PendingSpecialNoticeSyncItem {
  medicationId: string
  version: string
  shownCount: number
  entry: string
}

interface AlarmSyncPluginNative {
  getPendingSpecialNoticeSync?: () => Promise<{ items?: PendingSpecialNoticeSyncItem[] }>
  clearPendingSpecialNoticeSync?: (arg: { entries: string[] }) => Promise<void>
  getPendingTakenMedications?: () => Promise<{ pendingIds?: string[] }>
  clearPendingTakenMedication?: (arg: { medicationId: string }) => Promise<void>
  syncAlarms?: (arg: { medications: SyncedAlarmItem[] }) => Promise<{ count?: number }>
  syncSosSettings?: (arg: {
    ambulanceNumber?: string
    sosCallAmbulance?: boolean
    sosAlertFamily?: boolean
    sosLocalSiren?: boolean
    elderId: string
    elderName: string
  }) => Promise<void>
  syncAlarmTone?: (arg: { enabled: boolean; toneUrl: string; toneTitle: string }) => Promise<void>
  syncHealthPreferences?: (arg: { requiredVitals: unknown; elderId: string; elderName: string }) => Promise<void>
  syncAlarmSettings?: (arg: {
    elderId: string
    alarmSnoozeText: string
    alarmSnoozeDuration: number
    autoSnoozeEnabled: boolean
    autoSnoozeAfterSeconds: number
    stickyAlarmNotification: boolean
    alarmButtonOrder: "TAKE_FIRST" | "SNOOZE_FIRST"
    alarmTakeBtnColor: string
    alarmSnoozeBtnColor: string
  }) => Promise<void>
}

type ElderWindow = Window & {
  Capacitor?: { Plugins?: { AlarmSyncPlugin?: AlarmSyncPluginNative } }
  __syncElderAlarms?: () => Promise<void>
}

export function MedicationAlarmSync() {
  const { data: session } = useSession()
  const isSyncing = useRef(false)
  const userId = session?.user?.id
  const userRole = session?.user?.role
  const userName = session?.user?.name

  const fetchAndSync = useCallback(async () => {
    if (!userId || userRole !== "ELDER") return
    if (isSyncing.current) return
    isSyncing.current = true

    try {
      const capacitor = (window as ElderWindow).Capacitor
      const AlarmSyncPlugin = capacitor?.Plugins?.AlarmSyncPlugin

      // 0. Flush any pending special-notice shown counts recorded offline BEFORE pulling meds
      if (AlarmSyncPlugin && typeof AlarmSyncPlugin.getPendingSpecialNoticeSync === "function") {
        try {
          const snRes = await AlarmSyncPlugin.getPendingSpecialNoticeSync()
          const snItems = snRes?.items || []
          if (snItems.length > 0) {
            const syncRes = await fetch("/api/medications/notice-shown", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: snItems.map((it) => ({
                  medicationId: it.medicationId,
                  elderId: userId,
                  version: it.version,
                  shownCount: it.shownCount
                }))
              })
            }).catch(() => null)
            if (syncRes && syncRes.ok && typeof AlarmSyncPlugin.clearPendingSpecialNoticeSync === "function") {
              await AlarmSyncPlugin.clearPendingSpecialNoticeSync({
                entries: snItems.map((it) => it.entry)
              }).catch(() => {})
            }
          }
        } catch (snErr) {
          console.warn("[MedicationAlarmSync] Flush pending special notice sync error:", snErr)
        }
      }

      // 1. Fetch Medications and Tasks with Alarms in parallel
      const cacheBust = Date.now()
      const [medsRes, tasksRes] = await Promise.all([
        fetch(`/api/medications?_t=${cacheBust}`, { cache: "no-store" }).catch(() => null),
        fetch(`/api/tasks?_t=${cacheBust}`, { cache: "no-store" }).catch(() => null)
      ])

      const meds: SyncedMedicationDto[] = medsRes && medsRes.ok ? await medsRes.json() : []
      const tasks: SyncedTaskDto[] = tasksRes && tasksRes.ok ? await tasksRes.json() : []

      // Build unified alarm items list (excluding medications whose prescribed duration has finished)
      const nowMs = Date.now()
      const activeMeds = Array.isArray(meds) ? meds.filter((m) => {
        if (!m.endDate) return true
        const endMs = new Date(m.endDate).getTime()
        return nowMs <= endMs
      }) : []

      const baseOrigin =
        typeof window !== "undefined" && window.location.origin.startsWith("http")
          ? window.location.origin
          : "https://eldersaath.vercel.app"

      const alarmItems: SyncedAlarmItem[] = [
        ...activeMeds.map((m) => {
          const item: SyncedAlarmItem = {
            id: m.id,
            name: m.name,
            dosage: m.dosage || "",
            time: m.time,
            frequency: m.frequency || "daily",
            instructions: m.instructions || "",
            elderId: m.elderId || userId,
            type: "MEDICATION",
            label: `Time for ${m.name}`,
            body: `Dosage: ${m.dosage || "Scheduled Dose"}${m.instructions ? ". " + m.instructions : ""}`,
            actionText: "TAKE MEDICINE / STOP ALARM"
          }
          if (m.specialNoticeEnabled) {
            item.specialNoticeEnabled = true
            item.specialNoticeType = m.specialNoticeType === "VOICE" ? "VOICE" : "TEXT"
            item.specialNoticeText = m.specialNoticeText || ""
            item.specialNoticeMaxCount = Number(m.specialNoticeMaxCount || 5)
            item.specialNoticeShownCount = Number(m.specialNoticeShownCount || 0)
            item.specialNoticeVersion = m.specialNoticeVersion || "1"
            if (m.specialNoticeAudioUrl) {
              item.specialNoticeAudioUrl = m.specialNoticeAudioUrl.startsWith("/")
                ? baseOrigin + m.specialNoticeAudioUrl
                : m.specialNoticeAudioUrl
            }
          }
          return item
        }),
        ...(Array.isArray(tasks) ? tasks.filter((t) => t.triggerAlarm && t.time).map((t): SyncedAlarmItem => ({
          id: t.id,
          name: t.title,
          dosage: "",
          time: t.time || "",
          frequency: t.frequency || "daily",
          instructions: t.description || "",
          elderId: t.elderId || userId,
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
      const sosRes = await fetch(`/api/sos/settings?_t=${cacheBust}`, { cache: "no-store" }).catch(() => null)
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
                elderId: userId,
                elderName: userName || "Elder"
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

      // 4. Sync Health Check Preferences & Required Vitals + Alarm & Auto-Snooze Config to Phone Memory
      const prefRes = await fetch(`/api/elder/preferences?_t=${cacheBust}`, { cache: "no-store" }).catch(() => null)
      if (prefRes && prefRes.ok) {
        const prefData = await prefRes.json()
        if (prefData?.requiredVitals && AlarmSyncPlugin && typeof AlarmSyncPlugin.syncHealthPreferences === "function") {
          try {
            await AlarmSyncPlugin.syncHealthPreferences({
              requiredVitals: prefData.requiredVitals,
              elderId: userId,
              elderName: userName || "Elder"
            })
            console.log("[MedicationAlarmSync] Health Check Widget preferences synced:", prefData.requiredVitals)
          } catch (prefErr) {
            console.warn("[MedicationAlarmSync] Health pref sync error:", prefErr)
          }
        }

        const rawOrder = prefData?.alarmButtonOrder === "SNOOZE_FIRST" ? "SNOOZE_FIRST" : "TAKE_FIRST"
        const rawTakeColor =
          typeof prefData?.alarmTakeBtnColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(prefData.alarmTakeBtnColor)
            ? prefData.alarmTakeBtnColor.toUpperCase()
            : "#10B981"
        const rawSnoozeColor =
          typeof prefData?.alarmSnoozeBtnColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(prefData.alarmSnoozeBtnColor)
            ? prefData.alarmSnoozeBtnColor.toUpperCase()
            : "#334155"

        const alarmSettings = {
          elderId: userId,
          alarmSnoozeText: prefData?.alarmSnoozeText || "Take later",
          alarmSnoozeDuration: Number(prefData?.alarmSnoozeDuration ?? 10),
          autoSnoozeEnabled: prefData?.autoSnoozeEnabled === true,
          autoSnoozeAfterSeconds: Number(prefData?.autoSnoozeAfterSeconds ?? 60),
          stickyAlarmNotification: prefData?.stickyAlarmNotification !== false,
          alarmButtonOrder: rawOrder as "TAKE_FIRST" | "SNOOZE_FIRST",
          alarmTakeBtnColor: rawTakeColor,
          alarmSnoozeBtnColor: rawSnoozeColor
        }

        try {
          localStorage.setItem("eldersaath_alarm_settings", JSON.stringify(alarmSettings))
        } catch {}

        if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncAlarmSettings === "function") {
          try {
            await AlarmSyncPlugin.syncAlarmSettings(alarmSettings)
            console.log("[MedicationAlarmSync] Auto-Snooze & snooze settings stored on device:", alarmSettings)
          } catch (alarmSettingErr) {
            console.warn("[MedicationAlarmSync] Alarm settings sync error:", alarmSettingErr)
          }
        }
      }
    } catch (err) {
      console.warn("[MedicationAlarmSync] Sync fetch error:", err)
    } finally {
      isSyncing.current = false
    }
  }, [userId, userRole, userName])

  useEffect(() => {
    if (!userId || userRole !== "ELDER") return

    // Expose global helper for instant re-sync
    ;(window as ElderWindow).__syncElderAlarms = fetchAndSync

    // Initial sync on app load
    fetchAndSync()

    // Sync when coming back online, switching back to the app, or foregrounding the screen
    const handleOnline = () => fetchAndSync()
    const handleFocus = () => fetchAndSync()
    const handleCustomSync = () => fetchAndSync()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAndSync()
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("eldersaath:refresh-medications", handleCustomSync)
    window.addEventListener("eldersaath:refresh-tasks", handleCustomSync)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Periodic check every 5 minutes in background
    const interval = setInterval(fetchAndSync, 5 * 60 * 1000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("eldersaath:refresh-medications", handleCustomSync)
      window.removeEventListener("eldersaath:refresh-tasks", handleCustomSync)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(interval)
    }
  }, [userId, userRole, fetchAndSync])

  return null
}
