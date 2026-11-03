import { prisma } from "./prisma"
import { sendPushNotification } from "./push"

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
}

export async function getUnifiedElderAlarms(elderId: string): Promise<UnifiedAlarmItem[]> {
  if (!elderId) return []

  try {
    const [meds, tasks] = await Promise.all([
      prisma.medication.findMany({ where: { elderId } }),
      prisma.task.findMany({ where: { elderId, triggerAlarm: true } })
    ])

    const items: UnifiedAlarmItem[] = [
      ...meds.map(m => ({
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
      })),
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

export async function sendSilentAlarmSchedulePush(elderId: string) {
  if (!elderId) return

  try {
    const items = await getUnifiedElderAlarms(elderId)
    await sendPushNotification(elderId, {
      type: "SYNC_MEDICATIONS",
      medications: JSON.stringify(items)
    })
  } catch (err) {
    console.warn("[sendSilentAlarmSchedulePush] Error sending push:", err)
  }
}
