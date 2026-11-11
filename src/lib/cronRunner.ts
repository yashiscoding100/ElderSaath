import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { resolveCompactNoticeAudioUrl } from "@/lib/alarmSync"

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
  const details: Array<{ medId: string; medName: string; elderId: string; time: string }> = []

  for (const med of allMeds) {
    firedMedsCount++
    details.push({ medId: med.id, medName: med.name, elderId: med.elderId, time: med.time })
    try {
      const noticeAudioUrl =
        med.specialNoticeEnabled && med.specialNoticeType === "VOICE"
          ? resolveCompactNoticeAudioUrl(med.id, med.specialNoticeAudioUrl, med.specialNoticeVersion, true)
          : undefined

      await sendPushNotification(med.elderId, {
        type: "ALARM",
        medicationId: med.id,
        actionText: "TAKE MEDICINE / STOP ALARM",
        label: `Test Alarm: ${med.name}`,
        body: `Dosage: ${med.dosage || '1 tablet'}. Instructions: ${med.instructions || 'Manual test alarm'}`,
        snoozeText: med.elder.alarmSnoozeText || "Take later",
        snoozeDuration: (med.elder.alarmSnoozeDuration || 10).toString(),
        autoSnoozeEnabled: String(med.elder.autoSnoozeEnabled === true),
        autoSnoozeAfterSeconds: String(med.elder.autoSnoozeAfterSeconds ?? 60),
        elderId: med.elderId,
        stickyNotification: med.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false",
        ...(med.specialNoticeEnabled ? {
          specialNoticeEnabled: "true",
          specialNoticeType: med.specialNoticeType === "VOICE" ? "VOICE" : "TEXT",
          specialNoticeText: (med.specialNoticeText || "").slice(0, 800),
          specialNoticeAudioUrl: noticeAudioUrl || "",
          specialNoticeMaxCount: String(med.specialNoticeMaxCount || 5),
          specialNoticeShownCount: String(med.specialNoticeShownCount || 0),
          specialNoticeVersion: med.specialNoticeVersion || "1"
        } : {})
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
