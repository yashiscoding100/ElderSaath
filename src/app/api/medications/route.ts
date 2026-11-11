import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { sendSilentAlarmSchedulePush, resolveCompactNoticeAudioUrl } from "@/lib/alarmSync"
import { calculateEndDate, checkAndNotifyExpiredMedications } from "@/lib/medicationDuration"

function serializeMedication<T extends { id: string; specialNoticeAudioUrl?: string | null; specialNoticeVersion?: string | null }>(med: T) {
  if (med.specialNoticeAudioUrl) {
    return {
      ...med,
      specialNoticeAudioUrl: resolveCompactNoticeAudioUrl(
        med.id,
        med.specialNoticeAudioUrl,
        med.specialNoticeVersion,
        false
      )
    }
  }
  return med
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    const data = await req.json()
    const { 
      name, 
      dosage, 
      frequency, 
      time, 
      instructions,
      durationValue,
      durationUnit,
      startDate,
      specialNoticeEnabled,
      specialNoticeType,
      specialNoticeText,
      specialNoticeAudioUrl,
      specialNoticeAudioName,
      specialNoticeMaxCount
    } = data
    let targetElderId = data.elderId
    
    if (session.user.role === "ELDER") {
      targetElderId = session.user.id
    } else if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({ 
        where: { elderId_childId: { elderId: targetElderId, childId: session.user.id } } 
      })
      if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    } else {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const start = startDate ? new Date(startDate) : new Date()
    const numDuration = durationValue ? Number(durationValue) : null
    const calculatedEndDate = calculateEndDate(start, numDuration, durationUnit)

    const isChild = session.user.role === "CHILD"
    const noticeEnabled = isChild && Boolean(specialNoticeEnabled)
    const noticeType = specialNoticeType === "VOICE" ? "VOICE" : "TEXT"
    const parsedMaxCount = Math.min(500, Math.max(1, Math.round(Number(specialNoticeMaxCount) || 5)))
    
    const medication = await prisma.medication.create({ 
      data: { 
        elderId: targetElderId, 
        name, 
        dosage, 
        frequency, 
        time, 
        instructions,
        startDate: start,
        endDate: calculatedEndDate,
        durationValue: numDuration,
        durationUnit: durationUnit || null,
        durationNotified: false,
        specialNoticeEnabled: noticeEnabled,
        specialNoticeType: noticeEnabled ? noticeType : "TEXT",
        specialNoticeText: noticeEnabled && noticeType === "TEXT" ? (specialNoticeText || "").trim() : null,
        specialNoticeAudioUrl: noticeEnabled && noticeType === "VOICE" ? (specialNoticeAudioUrl || null) : null,
        specialNoticeAudioName: noticeEnabled && noticeType === "VOICE" ? (specialNoticeAudioName || null) : null,
        specialNoticeMaxCount: parsedMaxCount,
        specialNoticeShownCount: 0,
        specialNoticeVersion: noticeEnabled ? Date.now().toString(36) : null
      } 
    })

    // Trigger silent hardware alarm sync on Elder's device immediately (Meds + Tasks)
    await sendSilentAlarmSchedulePush(targetElderId).catch(() => {})

    // If elder added it, notify caretakers
    if (session.user.role === "ELDER") {
      const rels = await prisma.caregiverRelationship.findMany({ where: { elderId: targetElderId, status: "ACTIVE" } })
      for (const rel of rels) {
        // Create in-app notification
        await prisma.appNotification.create({
          data: {
            userId: rel.childId,
            title: "New Medication Added",
            message: `${session.user.name} added a new medication: ${name} (${dosage}) at ${time}`,
            type: "INFO",
            link: "/child/medications"
          }
        }).catch(() => {})
        
        // Push Notification
        await sendPushNotification(rel.childId, {
          title: "New Medication Added",
          body: `${session.user.name} added a new medication: ${name} (${dosage}) at ${time}`,
          url: "/child/medications"
        }).catch(() => {})
      }
    }
    return NextResponse.json(serializeMedication(medication), { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications POST] Error:", error)
    return NextResponse.json({ message: "Error: " + msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    let elderId = session.user.id
    if (session.user.role === "CHILD") {
      const { searchParams } = new URL(req.url)
      const queryElder = searchParams.get("elderId")
      if (queryElder) {
        const rel = await prisma.caregiverRelationship.findUnique({
          where: { elderId_childId: { elderId: queryElder, childId: session.user.id } }
        })
        if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        elderId = queryElder
      }
    }

    // Automatically check for any expired medication durations and notify family members
    await checkAndNotifyExpiredMedications(elderId).catch(() => {})

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const meds = await prisma.medication.findMany({ 
      where: { elderId }, 
      include: { 
        logs: { where: { timestamp: { gte: today } } } 
      },
      orderBy: { createdAt: "desc" }
    })
    return NextResponse.json(meds.map(serializeMedication), { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications GET] Error:", error)
    return NextResponse.json({ message: "Error: " + msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ message: "ID missing" }, { status: 400 })

    const med = await prisma.medication.findUnique({ where: { id } })
    if (!med) return NextResponse.json({ message: "Not found" }, { status: 404 })

    // Verify child has access to this elder
    if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({ where: { elderId_childId: { elderId: med.elderId, childId: session.user.id } } })
      if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    } else if (session.user.role === "ELDER" && med.elderId !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    const targetElderId = med.elderId
    await prisma.medication.delete({ where: { id } })

    // Trigger silent hardware alarm sync on Elder's device immediately (Meds + Tasks)
    await sendSilentAlarmSchedulePush(targetElderId).catch(() => {})

    return NextResponse.json({ message: "Deleted" }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications DELETE] Error:", error)
    return NextResponse.json({ message: "Error: " + msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    const { 
      id, 
      name, 
      dosage, 
      frequency, 
      time, 
      instructions,
      durationValue,
      durationUnit,
      startDate,
      specialNoticeEnabled,
      specialNoticeType,
      specialNoticeText,
      specialNoticeAudioUrl,
      specialNoticeAudioName,
      specialNoticeMaxCount,
      resetSpecialNoticeCount
    } = await req.json()
    if (!id) return NextResponse.json({ message: "ID missing" }, { status: 400 })

    const med = await prisma.medication.findUnique({ where: { id } })
    if (!med) return NextResponse.json({ message: "Not found" }, { status: 404 })

    // Verify child has access to this elder
    if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({ where: { elderId_childId: { elderId: med.elderId, childId: session.user.id } } })
      if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    } else if (session.user.role === "ELDER" && med.elderId !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    // Reset old trigger logs when editing so newly scheduled time can fire freely
    await prisma.medicationLog.deleteMany({
      where: { medicationId: id, status: "TRIGGERED" }
    }).catch(() => {})

    // Calculate updated duration and end date
    const start = startDate ? new Date(startDate) : (med.startDate || new Date())
    const numDuration = durationValue !== undefined 
      ? (durationValue ? Number(durationValue) : null) 
      : med.durationValue
    const unitDuration = durationUnit !== undefined ? durationUnit : med.durationUnit
    const calculatedEndDate = calculateEndDate(start, numDuration, unitDuration)

    const noticePatch: {
      specialNoticeEnabled?: boolean
      specialNoticeType?: string
      specialNoticeText?: string | null
      specialNoticeAudioUrl?: string | null
      specialNoticeAudioName?: string | null
      specialNoticeMaxCount?: number
      specialNoticeShownCount?: number
      specialNoticeVersion?: string | null
    } = {}
    if (session.user.role === "CHILD" && specialNoticeEnabled !== undefined) {
      const enabled = Boolean(specialNoticeEnabled)
      const nextType = specialNoticeType === "VOICE" ? "VOICE" : "TEXT"
      const nextMaxCount = Math.min(500, Math.max(1, Math.round(Number(specialNoticeMaxCount) || 5)))

      const isProxyAudioUrl =
        typeof specialNoticeAudioUrl === "string" &&
        specialNoticeAudioUrl.includes("/api/medications/notice-audio")
      const resolvedAudioUrl = !enabled || nextType !== "VOICE"
        ? null
        : isProxyAudioUrl
          ? med.specialNoticeAudioUrl
          : specialNoticeAudioUrl || med.specialNoticeAudioUrl || null
      const resolvedAudioName = !enabled || nextType !== "VOICE"
        ? null
        : specialNoticeAudioName ?? med.specialNoticeAudioName ?? null

      const contentChanged =
        (!med.specialNoticeEnabled && enabled) ||
        med.specialNoticeType !== nextType ||
        (nextType === "TEXT" && (specialNoticeText || "").trim() !== (med.specialNoticeText || "").trim()) ||
        (nextType === "VOICE" && !isProxyAudioUrl && Boolean(specialNoticeAudioUrl) && specialNoticeAudioUrl !== med.specialNoticeAudioUrl)

      const shouldReset = Boolean(resetSpecialNoticeCount) || contentChanged || !med.specialNoticeVersion

      noticePatch.specialNoticeEnabled = enabled
      noticePatch.specialNoticeType = nextType
      noticePatch.specialNoticeText = enabled && nextType === "TEXT" ? (specialNoticeText || "").trim() : null
      noticePatch.specialNoticeAudioUrl = resolvedAudioUrl
      noticePatch.specialNoticeAudioName = resolvedAudioName
      noticePatch.specialNoticeMaxCount = nextMaxCount
      if (!enabled) {
        noticePatch.specialNoticeShownCount = 0
        noticePatch.specialNoticeVersion = null
      } else if (shouldReset) {
        noticePatch.specialNoticeShownCount = 0
        noticePatch.specialNoticeVersion = Date.now().toString(36)
      }
    }

    const updatedMed = await prisma.medication.update({
      where: { id },
      data: { 
        name, 
        dosage, 
        frequency, 
        time, 
        instructions,
        startDate: start,
        endDate: calculatedEndDate,
        durationValue: numDuration,
        durationUnit: unitDuration || null,
        durationNotified: false, // Reset flag if duration was adjusted
        ...noticePatch
      }
    })

    // Trigger silent hardware alarm sync on Elder's device immediately (Meds + Tasks)
    await sendSilentAlarmSchedulePush(med.elderId).catch(() => {})

    return NextResponse.json(serializeMedication(updatedMed), { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications PATCH] Error:", error)
    return NextResponse.json({ message: "Error: " + msg }, { status: 500 })
  }
}
