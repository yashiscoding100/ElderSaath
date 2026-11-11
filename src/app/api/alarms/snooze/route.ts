import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export async function POST(req: Request) {
  try {
    const { elderId, autoSnoozed } = await req.json()
    
    if (!elderId) {
      return NextResponse.json({ message: "Missing elderId" }, { status: 400 })
    }

    const elder = await prisma.user.findUnique({ where: { id: elderId } })
    if (!elder) {
      return NextResponse.json({ message: "Elder not found" }, { status: 404 })
    }

    const relationships = await prisma.caregiverRelationship.findMany({
      where: { elderId: elderId, status: "ACTIVE" },
      include: { child: true }
    })
    
    for (const rel of relationships) {
      if (rel.child.notifySnooze) {
        await sendPushNotification(rel.childId, {
          title: autoSnoozed ? "Medication Auto-Snoozed" : "Medication Snoozed",
          body: autoSnoozed
            ? `${elder.name} did not respond to their alarm, so it was automatically snoozed for ${elder.alarmSnoozeDuration || 10} minutes.`
            : `${elder.name} just hit the '${elder.alarmSnoozeText || "Take later"}' button on their medication alarm.`,
          url: "/child/medications"
        })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Snooze API Error:", error)
    return NextResponse.json({ message: "Internal Error" }, { status: 500 })
  }
}
