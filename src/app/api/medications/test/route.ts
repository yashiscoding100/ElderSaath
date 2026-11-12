import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import {
  DEFAULT_ALARM_SNOOZE_BTN_COLOR,
  DEFAULT_ALARM_TAKE_BTN_COLOR,
  normalizeAlarmButtonOrder,
  normalizeAlarmHexColor,
  resolveCompactNoticeAudioUrl
} from "@/lib/alarmSync"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const { medId } = await req.json()
    if (!medId) return NextResponse.json({ message: "medId required" }, { status: 400 })

    const med = await prisma.medication.findUnique({
      where: { id: medId },
      include: { elder: { include: { elderProfile: true } } }
    })

    if (!med) return NextResponse.json({ message: "Medication not found" }, { status: 404 })

    const noticeAudioUrl =
      med.specialNoticeEnabled && med.specialNoticeType === "VOICE"
        ? resolveCompactNoticeAudioUrl(med.id, med.specialNoticeAudioUrl, med.specialNoticeVersion, true)
        : undefined

    // Fire the hyper-aggressive alarm push directly to the elder
    await sendPushNotification(med.elderId, {
      type: "ALARM",
      medicationId: med.id,
      actionText: "TAKE MEDICINE / STOP ALARM",
      label: `Time for ${med.name}`,
      body: `Dosage: ${med.dosage}. ${med.instructions || 'Scheduled medication test.'}`.trim(),
      snoozeText: med.elder.alarmSnoozeText || "Take later",
      snoozeDuration: (med.elder.alarmSnoozeDuration || 10).toString(),
      autoSnoozeEnabled: String(med.elder.autoSnoozeEnabled === true),
      autoSnoozeAfterSeconds: String(med.elder.autoSnoozeAfterSeconds ?? 60),
      alarmButtonOrder: normalizeAlarmButtonOrder(med.elder.alarmButtonOrder),
      alarmTakeBtnColor: normalizeAlarmHexColor(med.elder.alarmTakeBtnColor, DEFAULT_ALARM_TAKE_BTN_COLOR),
      alarmSnoozeBtnColor: normalizeAlarmHexColor(med.elder.alarmSnoozeBtnColor, DEFAULT_ALARM_SNOOZE_BTN_COLOR),
      elderId: med.elderId,
      stickyNotification: med.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false",
      specialNoticeEnabled: med.specialNoticeEnabled ? "true" : "false",
      ...(med.specialNoticeEnabled ? {
        specialNoticeType: med.specialNoticeType === "VOICE" ? "VOICE" : "TEXT",
        specialNoticeText: (med.specialNoticeText || "").slice(0, 800),
        specialNoticeAudioUrl: noticeAudioUrl || "",
        specialNoticeMaxCount: String(med.specialNoticeMaxCount || 5),
        specialNoticeShownCount: String(med.specialNoticeShownCount || 0),
        specialNoticeVersion: med.specialNoticeVersion || "1"
      } : {})
    })

    return NextResponse.json({ message: `Alarm dispatched to ${med.elder.name}` }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/test] Error:", error)
    return NextResponse.json({ message: "Failed to test alarm", error: msg }, { status: 500 })
  }
}
