import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  
  try {
    const body = await req.json()
    const { medicationId, status, elderId, type } = body

    let targetElderId = session?.user?.id

    // Check hardware alarm secret header if session is not available from background native request
    const alarmSecret = req.headers.get("x-app-alarm-secret")
    if (!targetElderId && alarmSecret === "ElderSaath-Hardware-Alarm-v1" && elderId) {
      targetElderId = elderId
    }

    if (!targetElderId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // If it's a scheduled TASK
    if (type === "TASK") {
      const task = await prisma.task.findUnique({
        where: { id: medicationId },
      })
      if (task && (task.elderId === targetElderId || session?.user?.role === "ELDER")) {
        const existingLog = await prisma.taskLog.findFirst({
          where: {
            taskId: medicationId,
            elderId: targetElderId,
            timestamp: { gte: todayStart }
          }
        })

        if (!existingLog) {
          await prisma.taskLog.create({
            data: {
              taskId: medicationId,
              elderId: targetElderId,
              status: "COMPLETED"
            }
          })
        }
        return NextResponse.json({ success: true, type: "TASK" }, { status: 200 })
      }
    }

    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
    })

    if (!medication) {
      return NextResponse.json({ message: "Not found" }, { status: 404 })
    }

    if (medication.elderId !== targetElderId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    // Check if already marked taken today to avoid duplicates
    const existingLog = await prisma.medicationLog.findFirst({
      where: {
        medicationId,
        elderId: targetElderId,
        status: status || "TAKEN",
        timestamp: { gte: todayStart }
      }
    })

    if (existingLog) {
      return NextResponse.json(existingLog, { status: 200 })
    }

    const log = await prisma.medicationLog.create({
      data: {
        medicationId,
        elderId: targetElderId,
        status: status || "TAKEN",
      }
    })
    
    return NextResponse.json(log, { status: 201 })
  } catch (error: any) {
    console.error("[api/medications/log] Error:", error)
    return NextResponse.json({ message: "Failed to log medication", error: error?.message }, { status: 500 })
  }
}
