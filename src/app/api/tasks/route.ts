import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { sendSilentAlarmSchedulePush } from "@/lib/alarmSync"

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

    const tasks = await prisma.task.findMany({
      where: { elderId },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(tasks)
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch tasks" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const data = await req.json()
    const { title, description, elderId, time, triggerAlarm, frequency } = data
    let targetElderId = elderId
    
    if (session.user.role === "ELDER") {
      targetElderId = session.user.id
    } else if (session.user.role === "CHILD") {
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: targetElderId, childId: session.user.id } }
      })
      if (!relationship || relationship.status !== "ACTIVE") return NextResponse.json({ message: "Unauthorized for this elder" }, { status: 403 })
    } else {
      return NextResponse.json({ message: "Unauthorized role" }, { status: 401 })
    }

    const task = await prisma.task.create({
      data: { elderId: targetElderId, assignerId: session.user.id, title, description, time, triggerAlarm: triggerAlarm === true, frequency: frequency || "DAILY" }
    })

    // If task has alarm enabled, immediately trigger silent hardware alarm sync on elder's phone
    if (triggerAlarm === true) {
      await sendSilentAlarmSchedulePush(targetElderId).catch(() => {})
    }
    
    if (session.user.role === "CHILD") {
      await sendPushNotification(targetElderId, {
        title: "New Thing to Do",
        body: session.user.name + " added a new thing to do: " + title,
        url: "/elder/home"
      })
    }
    
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Failed to create task" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 })

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 })

    if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: task.elderId, childId: session.user.id } }
      })
      if (!rel || rel.status !== "ACTIVE") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    } else if (session.user.role === "ELDER" && task.elderId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const targetElderId = task.elderId
    const hadAlarm = task.triggerAlarm

    await prisma.task.delete({ where: { id } })

    // If deleted task had an alarm, re-sync hardware alarms immediately
    if (hadAlarm) {
      await sendSilentAlarmSchedulePush(targetElderId).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ message: "Failed to delete" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const data = await req.json()
    const { id, title, description, time, triggerAlarm, frequency } = data

    if (!id) {
      return NextResponse.json({ message: "Missing id" }, { status: 400 })
    }

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }

    if (session.user.role === "CHILD") {
      const rel = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: task.elderId, childId: session.user.id } }
      })
      if (!rel || rel.status !== "ACTIVE") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (session.user.role === "ELDER" && task.elderId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        time: time !== undefined ? time : task.time,
        triggerAlarm: triggerAlarm !== undefined ? triggerAlarm === true : task.triggerAlarm,
        frequency: frequency !== undefined ? (frequency || "DAILY") : task.frequency
      }
    })

    // If task has alarm enabled or previously had alarm, trigger silent hardware alarm sync immediately
    if (updatedTask.triggerAlarm || task.triggerAlarm) {
      await sendSilentAlarmSchedulePush(task.elderId).catch(() => {})
    }

    return NextResponse.json(updatedTask, { status: 200 })
  } catch (error: any) {
    console.error("[api/tasks PATCH] Error:", error)
    return NextResponse.json({ message: "Failed to update task: " + error.message }, { status: 500 })
  }
}
