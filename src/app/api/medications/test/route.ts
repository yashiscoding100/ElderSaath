import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

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

    // Fire the hyper-aggressive alarm push directly to the elder
    await sendPushNotification(med.elderId, {
      type: "ALARM",
      actionText: "Take medicines",
      label: `Time for ${med.name}`,
      body: `Dosage: ${med.dosage}. ${med.instructions || 'Scheduled medication test.'}`.trim(),
      snoozeText: med.elder.alarmSnoozeText || "Take later",
      snoozeDuration: (med.elder.alarmSnoozeDuration || 10).toString(),
      autoSnoozeEnabled: String(med.elder.autoSnoozeEnabled === true),
      autoSnoozeAfterSeconds: String(med.elder.autoSnoozeAfterSeconds ?? 60),
      elderId: med.elderId,
      stickyNotification: med.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false"
    })

    return NextResponse.json({ message: `Alarm dispatched to ${med.elder.name}` }, { status: 200 })
  } catch (error: any) {
    console.error("[api/medications/test] Error:", error)
    return NextResponse.json({ message: "Failed to test alarm", error: error.message }, { status: 500 })
  }
}
