import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export async function runMedicationAndTaskCrons(forceAll: boolean = false) {
  // Time-based alarms are now fully scheduled and saved directly on the Android hardware AlarmManager.
  // Automated background cron cloud pushes for time-based alarms are disabled to prevent duplicate rings,
  // dual-audio echoes, and redundant server polling.
  if (!forceAll) {
    return {
      status: "SKIPPED",
      message: "Automated time-based cloud push alarms are disabled in favor of on-device hardware AlarmManager scheduling.",
      firedMedsCount: 0,
      firedTasksCount: 0,
      totalScheduled: 0,
      details: []
    }
  }

  // If forceAll === true (manual admin test trigger):
  console.log(`[CronRunner] Manual force test triggered by admin.`)
  const allMeds = await prisma.medication.findMany({
    take: 1,
    include: { elder: { include: { elderProfile: true } } }
  })

  let firedMedsCount = 0
  const details: any[] = []

  for (const med of allMeds) {
    firedMedsCount++
    details.push({ medId: med.id, medName: med.name, elderId: med.elderId, time: med.time })
    try {
      await sendPushNotification(med.elderId, {
        type: "ALARM",
        actionText: "Take medicines",
        label: `Test Alarm: ${med.name}`,
        body: `Dosage: ${med.dosage || '1 tablet'}. Instructions: ${med.instructions || 'Manual test alarm'}`,
        snoozeText: med.elder.alarmSnoozeText || "Take later",
        snoozeDuration: (med.elder.alarmSnoozeDuration || 10).toString(),
        elderId: med.elderId,
        stickyNotification: med.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false"
      })
    } catch (err) {
      console.error(`[CronRunner] Manual test error for ${med.name}:`, err)
    }
  }

  return {
    status: "TEST_EXECUTED",
    message: "Manual test alarm triggered.",
    firedMedsCount,
    firedTasksCount: 0,
    totalScheduled: firedMedsCount,
    details
  }
}
