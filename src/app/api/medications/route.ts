import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { sendSilentAlarmSchedulePush } from "@/lib/alarmSync"
import { calculateEndDate, checkAndNotifyExpiredMedications } from "@/lib/medicationDuration"

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
      startDate 
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
        durationNotified: false
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
    return NextResponse.json(medication, { status: 201 })
  } catch (error: any) { 
    console.error("[api/medications POST] Error:", error)
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 }) 
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
    return NextResponse.json(meds, { status: 200 })
  } catch (error: any) { 
    console.error("[api/medications GET] Error:", error)
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 }) 
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
  } catch (error: any) { 
    console.error("[api/medications DELETE] Error:", error)
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 }) 
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
      startDate 
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
        durationNotified: false // Reset flag if duration was adjusted
      }
    })

    // Trigger silent hardware alarm sync on Elder's device immediately (Meds + Tasks)
    await sendSilentAlarmSchedulePush(med.elderId).catch(() => {})

    return NextResponse.json(updatedMed, { status: 200 })
  } catch (error: any) { 
    console.error("[api/medications PATCH] Error:", error)
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 }) 
  }
}
