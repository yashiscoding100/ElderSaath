import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    const data = await req.json()
    const { name, dosage, frequency, time, instructions } = data
    let targetElderId = data.elderId
    
    if (session.user.role === "ELDER") {
      targetElderId = session.user.id
    } else if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({ where: { elderId_childId: { elderId: targetElderId, childId: session.user.id } } })
      if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    } else {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    
    const medication = await prisma.medication.create({ data: { elderId: targetElderId, name, dosage, frequency, time, instructions } })

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
        })
        
        // Push Notification
        await sendPushNotification(rel.childId, {
          title: "New Medication Added",
          body: `${session.user.name} added a new medication: ${name} (${dosage}) at ${time}`,
          url: "/child/medications"
        })
      }
    }
    return NextResponse.json(medication, { status: 201 })
  } catch (error) { return NextResponse.json({ message: "Error" }, { status: 500 }) }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    if (session.user.role === "ELDER") {
      const today = new Date(); today.setHours(0,0,0,0)
      const meds = await prisma.medication.findMany({ where: { elderId: session.user.id }, include: { logs: { where: { timestamp: { gte: today } } } } })
      return NextResponse.json(meds, { status: 200 })
    }
    return NextResponse.json({ message: "Not implemented for child" }, { status: 400 })
  } catch (error) { return NextResponse.json({ message: "Error" }, { status: 500 }) }
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

    await prisma.medication.delete({ where: { id } })
    return NextResponse.json({ message: "Deleted" }, { status: 200 })
  } catch (error) { return NextResponse.json({ message: "Error" }, { status: 500 }) }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  try {
    const { id, name, dosage, frequency, time, instructions } = await req.json()
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

    const updatedMed = await prisma.medication.update({
      where: { id },
      data: { name, dosage, frequency, time, instructions }
    })
    return NextResponse.json(updatedMed, { status: 200 })
  } catch (error) { return NextResponse.json({ message: "Error" }, { status: 500 }) }
}
