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
  let accuracy: number | null = null
  let batteryLevel: number | null = null
  let isCharging: boolean | null = null
  let source = "APP"

  try {
    const body = await req.json().catch(() => ({}))
    latitude = typeof body.latitude === "number" ? body.latitude : null
    longitude = typeof body.longitude === "number" ? body.longitude : null
    accuracy = typeof body.accuracy === "number" ? body.accuracy : null
    batteryLevel = typeof body.batteryLevel === "number" ? body.batteryLevel : null
    isCharging = typeof body.isCharging === "boolean" ? body.isCharging : null
    source = body.source || "APP"

    if (session?.user?.role === "ELDER") {
      targetElderId = session.user.id
      elderName = session.user.name || "Elder"
    } else if (body.elderId) {
      targetElderId = body.elderId
    } else if (session?.user?.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findFirst({
        where: { childId: session.user.id, status: "ACTIVE" }
      })
      targetElderId = rel?.elderId || null
    }

    if (!targetElderId) {
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

    // 3. Fetch Elder Medical Profile if medical ID is enabled
    let medicalSummary = ""
    if (sosConfig.sosIncludeMedicalId) {
      try {
        const [profile, meds] = await Promise.all([
          prisma.elderProfile.findUnique({ where: { userId: targetElderId } }),
          prisma.medication.findMany({ where: { elderId: targetElderId }, take: 4 })
        ])

        const parts: string[] = []
        if (profile?.bloodGroup) parts.push(`Blood: ${profile.bloodGroup}`)
        if (profile?.allergies) parts.push(`Allergies: ${profile.allergies}`)
        if (profile?.medicalConditions) parts.push(`Conditions: ${profile.medicalConditions}`)
        if (meds.length > 0) parts.push(`Meds: ${meds.map(m => m.name).join(", ")}`)

        if (parts.length > 0) {
          medicalSummary = " | " + parts.join(" • ")
        }
      } catch (medErr) {
        console.warn("[SOS] Failed to fetch medical summary:", medErr)
      }
    }

    // 4. Construct location link and telemetry
    const mapsLink = (latitude !== null && longitude !== null)
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : ""
    const batteryText = (batteryLevel !== null)
      ? ` | 🔋 ${batteryLevel}%${isCharging ? " ⚡" : ""}`
      : ""

    // 5. Family Siren Broadcast (if enabled in settings)
    if (sosConfig.sosAlertFamily) {
      const caregivers = await prisma.caregiverRelationship.findMany({
        where: { elderId: targetElderId, status: "ACTIVE" },
        include: { child: true }
      })

      console.log(`[SOS] Broadcasting hyper-aggressive emergency alarm to ${caregivers.length} family members for ${elderName}`)

      const alertBody = `${elderName} pressed the Emergency SOS button (${source})! Immediate assistance required.${mapsLink ? " 📍 Location: " + mapsLink : ""}${batteryText}${medicalSummary}`

      for (const rel of caregivers) {
        try {
          await sendPushNotification(rel.childId, {
            type: "ALARM",
            label: `🚨 EMERGENCY SOS: ${elderName}!`,
            body: alertBody,
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
      mapsLink,
      batteryLevel,
      isCharging,
      sosConfig
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/sos] Error:", error)
    return NextResponse.json({ message: "Failed to trigger SOS", error: error.message }, { status: 500 })
  }
}
