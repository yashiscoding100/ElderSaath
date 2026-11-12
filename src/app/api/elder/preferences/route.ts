import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_ALARM_SNOOZE_BTN_COLOR,
  DEFAULT_ALARM_TAKE_BTN_COLOR,
  normalizeAlarmButtonOrder,
  normalizeAlarmHexColor
} from "@/lib/alarmSync"

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    let targetElderId = session.user.id

    if (session.user.role === "CHILD") {
      targetElderId = body.elderId
      if (!targetElderId) return NextResponse.json({ message: "Missing elderId" }, { status: 400 })
      
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: targetElderId, childId: session.user.id } }
      })
      if (!relationship) return NextResponse.json({ message: "Unauthorized for this elder" }, { status: 403 })
    }

    const updateData: {
      requiredVitals?: string
      askSymptoms?: boolean
      stickyAlarmNotification?: boolean
    } = {}
    if (body.requiredVitals !== undefined) updateData.requiredVitals = body.requiredVitals
    if (body.askSymptoms !== undefined) updateData.askSymptoms = body.askSymptoms
    if (body.stickyAlarmNotification !== undefined) updateData.stickyAlarmNotification = body.stickyAlarmNotification

    const updatedProfile = await prisma.elderProfile.upsert({
      where: { userId: targetElderId },
      update: updateData,
      create: {
        userId: targetElderId,
        requiredVitals: body.requiredVitals || "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT",
        askSymptoms: body.askSymptoms ?? true,
        stickyAlarmNotification: body.stickyAlarmNotification ?? true
      }
    })

    return NextResponse.json({ message: "Preferences updated", profile: updatedProfile })
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    let targetElderId = session?.user?.id

    const alarmSecret = req.headers.get("x-app-alarm-secret")
    const url = new URL(req.url)
    const qElderId = url.searchParams.get("elderId")
    if (!targetElderId && alarmSecret === "ElderSaath-Hardware-Alarm-v1" && qElderId) {
      targetElderId = qElderId
    }
    
    if (!targetElderId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const [profile, user] = await Promise.all([
      prisma.elderProfile.findUnique({
        where: { userId: targetElderId }
      }),
      prisma.user.findUnique({
        where: { id: targetElderId },
        select: {
          alarmSnoozeText: true,
          alarmSnoozeDuration: true,
          autoSnoozeEnabled: true,
          autoSnoozeAfterSeconds: true,
          alarmButtonOrder: true,
          alarmTakeBtnColor: true,
          alarmSnoozeBtnColor: true
        }
      })
    ])

    return NextResponse.json({ 
      requiredVitals: profile?.requiredVitals || "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT",
      askSymptoms: profile?.askSymptoms ?? true,
      stickyAlarmNotification: profile?.stickyAlarmNotification ?? true,
      alarmSnoozeText: user?.alarmSnoozeText || "Take later",
      alarmSnoozeDuration: user?.alarmSnoozeDuration ?? 10,
      autoSnoozeEnabled: user?.autoSnoozeEnabled ?? false,
      autoSnoozeAfterSeconds: user?.autoSnoozeAfterSeconds ?? 60,
      alarmButtonOrder: normalizeAlarmButtonOrder(user?.alarmButtonOrder),
      alarmTakeBtnColor: normalizeAlarmHexColor(user?.alarmTakeBtnColor, DEFAULT_ALARM_TAKE_BTN_COLOR),
      alarmSnoozeBtnColor: normalizeAlarmHexColor(user?.alarmSnoozeBtnColor, DEFAULT_ALARM_SNOOZE_BTN_COLOR)
    })
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
