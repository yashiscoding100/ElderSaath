import { prisma } from "./prisma"
import { sendPushNotification } from "./push"

export const DEFAULT_ALARM_BUTTON_ORDER = "TAKE_FIRST" as const
export const DEFAULT_ALARM_TAKE_BTN_COLOR = "#10B981"
export const DEFAULT_ALARM_SNOOZE_BTN_COLOR = "#334155"

export type AlarmButtonOrder = "TAKE_FIRST" | "SNOOZE_FIRST"

export function normalizeAlarmButtonOrder(val: unknown): AlarmButtonOrder {
  return val === "SNOOZE_FIRST" ? "SNOOZE_FIRST" : "TAKE_FIRST"
}

export function isValidAlarmHexColor(val: unknown): val is string {
  return typeof val === "string" && /^#[0-9A-Fa-f]{6}$/.test(val.trim())
}

export function normalizeAlarmHexColor(val: unknown, fallback: string): string {
  return isValidAlarmHexColor(val) ? val.trim().toUpperCase() : fallback
}

export interface UnifiedAlarmItem {
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

export function resolveCompactNoticeAudioUrl(
  medId: string,
  audioUrl: string | null | undefined,
  version: string | null | undefined,
  absolute: boolean = true
): string | undefined {
  if (!audioUrl) return undefined
  if (audioUrl.startsWith("http") && !audioUrl.includes("/api/medications/notice-audio") && audioUrl.length <= 280) {
    return audioUrl
  }
  const path = `/api/medications/notice-audio?id=${medId}&v=${encodeURIComponent(version || "1")}`
  return absolute ? `https://eldersaath.vercel.app${path}` : path
}

export async function getUnifiedElderAlarms(elderId: string): Promise<UnifiedAlarmItem[]> {
  if (!elderId) return []

  try {
    const [meds, tasks] = await Promise.all([
      prisma.medication.findMany({ 
        where: { 
          elderId,
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        } 
      }),
      prisma.task.findMany({ where: { elderId, triggerAlarm: true } })
    ])

    const items: UnifiedAlarmItem[] = [
      ...meds.map(m => {
        const base: UnifiedAlarmItem = {
          id: m.id,
          name: m.name,
          dosage: m.dosage || "",
          time: m.time,
          frequency: m.frequency || "daily",
          instructions: m.instructions || "",
          elderId: m.elderId,
          type: "MEDICATION" as const,
          label: `Time for ${m.name}`,
          body: `Dosage: ${m.dosage || "Scheduled Dose"}${m.instructions ? ". " + m.instructions : ""}`,
          actionText: "TAKE MEDICINE / STOP ALARM"
        }

        if (m.specialNoticeEnabled) {
          base.specialNoticeEnabled = true
          base.specialNoticeType = m.specialNoticeType === "VOICE" ? "VOICE" : "TEXT"
          base.specialNoticeText = m.specialNoticeText || ""
          base.specialNoticeMaxCount = Math.max(1, m.specialNoticeMaxCount || 5)
          base.specialNoticeShownCount = Math.max(0, m.specialNoticeShownCount || 0)
          base.specialNoticeVersion = m.specialNoticeVersion || "1"
          if (base.specialNoticeType === "VOICE") {
            const compactAudio = resolveCompactNoticeAudioUrl(
              m.id,
              m.specialNoticeAudioUrl,
              base.specialNoticeVersion,
              true
            )
            if (compactAudio) base.specialNoticeAudioUrl = compactAudio
          }
        }

        return base
      }),
      ...tasks
        .filter(t => t.time && t.time.trim().length > 0)
        .map(t => ({
          id: t.id,
          name: t.title,
          dosage: "",
          time: t.time!,
          frequency: t.frequency || "daily",
          instructions: t.description || "",
          elderId: t.elderId,
          type: "TASK" as const,
          label: `Task: ${t.title}`,
          body: t.description || "Important task scheduled for now.",
          actionText: "COMPLETE TASK / STOP ALARM"
        }))
    ]

    return items
  } catch (err) {
    console.error("[getUnifiedElderAlarms] Error:", err)
    return []
  }
}

export async function getElderAlarmSettings(elderId: string) {
  if (!elderId) {
    return {
      alarmSnoozeText: "Take later",
      alarmSnoozeDuration: 10,
      autoSnoozeEnabled: false,
      autoSnoozeAfterSeconds: 60,
      stickyAlarmNotification: true,
      alarmButtonOrder: DEFAULT_ALARM_BUTTON_ORDER,
      alarmTakeBtnColor: DEFAULT_ALARM_TAKE_BTN_COLOR,
      alarmSnoozeBtnColor: DEFAULT_ALARM_SNOOZE_BTN_COLOR
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: elderId },
      select: {
        alarmSnoozeText: true,
        alarmSnoozeDuration: true,
        autoSnoozeEnabled: true,
        autoSnoozeAfterSeconds: true,
        alarmButtonOrder: true,
        alarmTakeBtnColor: true,
        alarmSnoozeBtnColor: true,
        elderProfile: {
          select: { stickyAlarmNotification: true }
        }
      }
    })

    return {
      alarmSnoozeText: user?.alarmSnoozeText || "Take later",
      alarmSnoozeDuration: user?.alarmSnoozeDuration ?? 10,
      autoSnoozeEnabled: user?.autoSnoozeEnabled ?? false,
      autoSnoozeAfterSeconds: user?.autoSnoozeAfterSeconds ?? 60,
      stickyAlarmNotification: user?.elderProfile?.stickyAlarmNotification !== false,
      alarmButtonOrder: normalizeAlarmButtonOrder(user?.alarmButtonOrder),
      alarmTakeBtnColor: normalizeAlarmHexColor(user?.alarmTakeBtnColor, DEFAULT_ALARM_TAKE_BTN_COLOR),
      alarmSnoozeBtnColor: normalizeAlarmHexColor(user?.alarmSnoozeBtnColor, DEFAULT_ALARM_SNOOZE_BTN_COLOR)
    }
  } catch (err) {
    console.warn("[getElderAlarmSettings] Error:", err)
    return {
      alarmSnoozeText: "Take later",
      alarmSnoozeDuration: 10,
      autoSnoozeEnabled: false,
      autoSnoozeAfterSeconds: 60,
      stickyAlarmNotification: true,
      alarmButtonOrder: DEFAULT_ALARM_BUTTON_ORDER,
      alarmTakeBtnColor: DEFAULT_ALARM_TAKE_BTN_COLOR,
      alarmSnoozeBtnColor: DEFAULT_ALARM_SNOOZE_BTN_COLOR
    }
  }
}

export async function sendSilentAlarmSchedulePush(elderId: string) {
  if (!elderId) return

  try {
    const [items, settings] = await Promise.all([
      getUnifiedElderAlarms(elderId),
      getElderAlarmSettings(elderId)
    ])

    let medicationsJson = JSON.stringify(items)
    // Respect FCM 4096-byte UTF-8 data payload limit if many medications have very long notice texts
    if (Buffer.byteLength(medicationsJson, "utf8") > 3200) {
      const compactItems = items.map(it =>
        it.specialNoticeText && it.specialNoticeText.length > 80
          ? { ...it, specialNoticeText: it.specialNoticeText.slice(0, 80) + "..." }
          : it
      )
      medicationsJson = JSON.stringify(compactItems)
    }

    await sendPushNotification(elderId, {
      type: "SYNC_MEDICATIONS",
      elderId,
      medications: medicationsJson,
      alarmSnoozeText: String(settings.alarmSnoozeText),
      alarmSnoozeDuration: String(settings.alarmSnoozeDuration),
      autoSnoozeEnabled: String(settings.autoSnoozeEnabled),
      autoSnoozeAfterSeconds: String(settings.autoSnoozeAfterSeconds),
      stickyAlarmNotification: String(settings.stickyAlarmNotification),
      alarmButtonOrder: settings.alarmButtonOrder,
      alarmTakeBtnColor: settings.alarmTakeBtnColor,
      alarmSnoozeBtnColor: settings.alarmSnoozeBtnColor
    })
  } catch (err) {
    console.warn("[sendSilentAlarmSchedulePush] Error sending push:", err)
  }
}
