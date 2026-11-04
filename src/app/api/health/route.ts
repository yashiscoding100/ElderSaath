import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  let targetElderId = (session && session.user.role === "ELDER") ? session.user.id : null
  let elderName = (session && session.user.name) || "Elder"

  let data: any = {}
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  // Support native background/widget entry with secret header
  const alarmSecret = req.headers.get("x-app-alarm-secret")
  if (!targetElderId && alarmSecret === "ElderSaath-Hardware-Alarm-v1" && typeof data.elderId === "string") {
    targetElderId = data.elderId
    const elderUser = await prisma.user.findUnique({ where: { id: data.elderId } })
    if (elderUser?.name) elderName = elderUser.name || "Elder"
  }

  if (!targetElderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { bp, sugar, spo2, pulse, temperature, weight, symptoms, feeling, sleep, morningMedicine, source } = data
    
    const measurements: { type: string; value: string; unit: string }[] = []
    
    if (bp) measurements.push({ type: "BP", value: bp, unit: "mmHg" })
    if (sugar) measurements.push({ type: "SUGAR", value: sugar, unit: "mg/dL" })
    if (spo2) measurements.push({ type: "SPO2", value: spo2, unit: "%" })
    if (pulse) measurements.push({ type: "PULSE", value: pulse, unit: "BPM" })
    if (temperature) measurements.push({ type: "TEMP", value: temperature, unit: "°F" })
    if (weight) measurements.push({ type: "WEIGHT", value: weight, unit: "kg" })
    
    if (symptoms && symptoms.length > 0 && symptoms[0] !== "None") {
      measurements.push({ type: "SYMPTOMS", value: symptoms.join(", "), unit: "list" })
    }
    if (feeling) measurements.push({ type: "FEELING", value: feeling, unit: "string" })
    if (sleep) measurements.push({ type: "SLEEP", value: sleep, unit: "string" })
    if (morningMedicine) measurements.push({ type: "MORNING_MEDS", value: morningMedicine, unit: "string" })
    
    for (const m of measurements) {
      await prisma.healthMeasurement.create({
        data: {
          elderId: targetElderId,
          type: m.type,
          value: m.value,
          unit: m.unit,
          source: source || "MANUAL"
        }
      })
    }

    // Notify caregivers
    const relationships = await prisma.caregiverRelationship.findMany({
      where: { elderId: targetElderId, status: "ACTIVE" },
      include: { child: true }
    })
    
    const notifySource = source === "WIDGET" ? " (via Home Screen Widget)" : ""
    for (const rel of relationships) {
      if (rel.child.notifyVitals) {
        await sendPushNotification(rel.childId, {
          title: "Health Vitals Updated",
          body: `${elderName} just logged their health vitals for today${notifySource}.`,
          url: "/child/health"
        })
      }
    }

    return NextResponse.json({ message: "Saved successfully", count: measurements.length }, { status: 201 })
  } catch (error) {
    console.error("Health API error:", error)
    return NextResponse.json({ message: "Failed to save health data" }, { status: 500 })
  }
}
