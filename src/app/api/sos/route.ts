import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSosConfig } from "@/lib/sosConfig"
import { sendPushNotification } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  
  let targetElderId: string | null = null
  let elderName = "Family Member"
  let latitude: number | null = null
  let longitude: number | null = null
  let source = "APP"

  try {
    const body = await req.json().catch(() => ({}))
    latitude = body.latitude || null
    longitude = body.longitude || null
    source = body.source || "APP"

    if (session?.user?.role === "ELDER") {
      targetElderId = session.user.id
      elderName = session.user.name || "Elder"
    } else if (body.elderId) {
      targetElderId = body.elderId
    } else if (session?.user?.role === "CHILD") {
      // Find the first active linked elder for this child
      const rel = await prisma.caregiverRelationship.findFirst({
        where: { childId: session.user.id, status: "ACTIVE" }
      })
      targetElderId = rel?.elderId || null
    }

    if (!targetElderId) {
      // Fallback: look for the first elder in the system if triggered from unlinked demo/widget
      const firstElder = await prisma.user.findFirst({ where: { role: "ELDER" } })
      targetElderId = firstElder?.id || null
      elderName = firstElder?.name || "Elder"
    } else {
      const elderUser = await prisma.user.findUnique({ where: { id: targetElderId } })
      if (elderUser?.name) elderName = elderUser.name
    }

    if (!targetElderId) {
      return NextResponse.json({ message: "No elder ID found for SOS" }, { status: 400 })
    }

    // 1. Create Emergency Event in database
    const event = await prisma.emergencyEvent.create({
      data: {
        elderId: targetElderId,
        latitude,
        longitude,
        status: "ACTIVE",
        escalationLevel: 1
      }
    })

    // 2. Fetch SOS configuration for this elder
    const sosConfig = await getSosConfig(targetElderId)

    // 3. Family Siren Broadcast (if enabled in settings)
    if (sosConfig.sosAlertFamily) {
      const caregivers = await prisma.caregiverRelationship.findMany({
        where: { elderId: targetElderId, status: "ACTIVE" },
        include: { child: true }
      })

      console.log(`[SOS] Broadcasting hyper-aggressive emergency alarm to ${caregivers.length} family members for ${elderName}`)

      for (const rel of caregivers) {
        try {
          await sendPushNotification(rel.childId, {
            type: "ALARM",
            label: `🚨 EMERGENCY SOS: ${elderName}!`,
            body: `${elderName} pressed the Emergency SOS button (${source})! Immediate assistance required.`,
            actionText: "RESPOND TO EMERGENCY",
            url: "/child/emergency",
            elderId: targetElderId,
            stickyNotification: "true"
          })
        } catch (pushErr) {
          console.error(`[SOS] Push error for caregiver ${rel.childId}:`, pushErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Emergency SOS triggered",
      eventId: event.id,
      sosConfig
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/sos] Error:", error)
    return NextResponse.json({ message: "Failed to trigger SOS", error: error.message }, { status: 500 })
  }
}
