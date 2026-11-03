import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ElderHomeClient } from "@/components/elder/ElderHomeClient"
import { parseElderUiStyle } from "@/lib/elderUiPreferences"

export const dynamic = "force-dynamic"

export default async function ElderHome() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  // Get today's start date
  const now = new Date()
  const currentHour = now.getHours()
  let greeting = "Good morning"
  if (currentHour >= 12 && currentHour < 17) {
    greeting = "Good afternoon"
  } else if (currentHour >= 17 && currentHour < 21) {
    greeting = "Good evening"
  } else if (currentHour >= 21 || currentHour < 5) {
    greeting = "Good night"
  }

  const dateFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const profile = await prisma.elderProfile.findUnique({
    where: { userId: session.user.id }
  })

  const initialStyle = parseElderUiStyle(profile?.notes)

  const requiredDays = profile?.vitalCheckDays || "0,1,2,3,4,5,6"
  const isCheckRequiredToday = requiredDays.includes(today.getDay().toString())

  const allMeasurements = await prisma.healthMeasurement.findMany({
    where: { elderId: session.user.id },
    orderBy: { timestamp: "desc" },
    take: 20
  })
  
  const todayMeasurements = allMeasurements.filter(m => m.timestamp >= today)

  const medications = await prisma.medication.findMany({
    where: { elderId: session.user.id },
    orderBy: { time: "asc" },
    include: {
      logs: {
        where: { timestamp: { gte: today } }
      }
    }
  })

  const pendingRequests = await prisma.caregiverRelationship.findMany({
    where: { elderId: session.user.id, status: "PENDING" },
    include: { child: { select: { name: true, email: true } } }
  })

  const todayTasks = await prisma.task.findMany({
    where: { elderId: session.user.id },
    include: {
      logs: {
        where: { timestamp: { gte: today } }
      }
    }
  })

  const totalMeds = medications.length
  const takenMeds = medications.filter(m => m.logs.some(l => l.status === "TAKEN")).length
  const healthCheckDone = todayMeasurements.length > 0

  // Identify next untaken medication
  const untakenMed = medications.find(m => !m.logs.some(l => l.status === "TAKEN"))
  const nextMed = untakenMed ? {
    id: untakenMed.id,
    name: untakenMed.name,
    time: untakenMed.time,
    dosage: untakenMed.dosage,
    instructions: untakenMed.instructions
  } : null

  const bp = todayMeasurements.find(m => m.type === "BP")?.value || "--"
  const sugar = todayMeasurements.find(m => m.type === "SUGAR")?.value || "--"
  const spo2 = todayMeasurements.find(m => m.type === "SPO2")?.value || "--"
  const pulse = todayMeasurements.find(m => m.type === "PULSE")?.value || "--"
  const temp = todayMeasurements.find(m => m.type === "TEMP")?.value || "--"
  const weight = todayMeasurements.find(m => m.type === "WEIGHT")?.value || "--"

  const completedTasksCount = todayTasks.filter(t => t.logs.some(l => l.status === "COMPLETED")).length

  return (
    <ElderHomeClient
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      }}
      initialStyle={initialStyle}
      todayData={{
        greeting,
        dateFormatted,
        totalMeds,
        takenMeds,
        nextMed,
        healthCheckDone,
        isCheckRequiredToday,
        vitals: { bp, sugar, spo2, pulse, temp, weight },
        pendingRequests,
        profile,
        tasksCount: todayTasks.length,
        completedTasksCount
      }}
    />
  )
}
