import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export const dynamic = "force-dynamic"

const QUESTIONNAIRE_TYPES = ["FEELING", "SLEEP", "MORNING_MEDS", "SYMPTOMS"]

interface HealthPostPayload {
  elderId?: string
  bp?: string
  sugar?: string
  spo2?: string
  pulse?: string
  temperature?: string
  weight?: string
  symptoms?: string[]
  feeling?: string
  sleep?: string
  morningMedicine?: string
  source?: string
}

interface HealthDeletePayload {
  id?: string
  ids?: unknown[]
  elderId?: string
  category?: string
  olderThanDays?: number | string | null
}

async function authorizeHealthAccess(requestedElderId: string | null | undefined) {
  const session = await auth()

  if (!session?.user?.id) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) }
  }

  if (session.user.role === "ELDER") {
    if (requestedElderId && requestedElderId !== session.user.id) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) }
    }
    return { elderId: session.user.id }
  }

  if (session.user.role === "CHILD") {
    if (!requestedElderId) {
      return { error: NextResponse.json({ message: "Elder ID is required" }, { status: 400 }) }
    }

    const relationship = await prisma.caregiverRelationship.findUnique({
      where: {
        elderId_childId: {
          elderId: requestedElderId,
          childId: session.user.id,
        },
      },
    })

    if (!relationship || relationship.status !== "ACTIVE") {
      return { error: NextResponse.json({ message: "Not authorized for this elder" }, { status: 403 }) }
    }

    return { elderId: requestedElderId }
  }

  return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const access = await authorizeHealthAccess(searchParams.get("elderId"))

  if ("error" in access) {
    return access.error
  }

  try {
    const measurements = await prisma.healthMeasurement.findMany({
      where: { elderId: access.elderId },
      orderBy: { timestamp: "desc" },
    })

    return NextResponse.json({ measurements }, { status: 200 })
  } catch (error) {
    console.error("Health GET error:", error)
    return NextResponse.json({ message: "Failed to fetch health records" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  let targetElderId = (session && session.user.role === "ELDER") ? session.user.id : null
  let elderName = (session && session.user.name) || "Elder"

  let data: HealthPostPayload = {}
  try {
    data = (await req.json()) as HealthPostPayload
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

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)

  let body: HealthDeletePayload = {}
  try {
    const rawBody = await req.text()
    if (rawBody.trim().length > 0) {
      const parsed = JSON.parse(rawBody) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as HealthDeletePayload
      } else {
        return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
      }
    }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
  }

  const requestedElderId =
    typeof body.elderId === "string" && body.elderId.trim().length > 0
      ? body.elderId.trim()
      : searchParams.get("elderId")

  const singleId =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim()
      : searchParams.get("id")

  const batchIds = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim())
        )
      )
    : []

  const rawCategory =
    typeof body.category === "string" && body.category.trim().length > 0
      ? body.category.trim().toUpperCase()
      : searchParams.get("category")?.trim().toUpperCase() || null

  const olderThanDaysParam =
    body.olderThanDays !== undefined ? body.olderThanDays : searchParams.get("olderThanDays")

  try {
    // 1. Delete batch of specific record IDs (e.g. a day's entries or filtered selection)
    if (batchIds.length > 0) {
      const access = await authorizeHealthAccess(requestedElderId)
      if ("error" in access) {
        return access.error
      }

      const matching = await prisma.healthMeasurement.findMany({
        where: {
          id: { in: batchIds },
          elderId: access.elderId,
        },
        select: { id: true },
      })
      const deletedIds = matching.map((m) => m.id)

      const result =
        deletedIds.length > 0
          ? await prisma.healthMeasurement.deleteMany({
              where: {
                id: { in: deletedIds },
                elderId: access.elderId,
              },
            })
          : { count: 0 }

      return NextResponse.json(
        {
          message: `Deleted ${result.count} health record${result.count === 1 ? "" : "s"}`,
          deletedCount: result.count,
          deletedIds,
        },
        { status: 200 }
      )
    }

    // 2. Delete a single vital or questionnaire record by ID
    if (singleId) {
      const existing = await prisma.healthMeasurement.findUnique({
        where: { id: singleId },
      })

      if (!existing) {
        return NextResponse.json({ message: "Health record not found" }, { status: 404 })
      }

      if (requestedElderId && requestedElderId !== existing.elderId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }

      const access = await authorizeHealthAccess(existing.elderId)
      if ("error" in access) {
        return access.error
      }

      await prisma.healthMeasurement.delete({
        where: { id: singleId },
      })

      return NextResponse.json(
        {
          message: "Health record deleted",
          deletedCount: 1,
          deletedIds: [singleId],
        },
        { status: 200 }
      )
    }

    // 3. Bulk cleanup by category ("ALL" | "VITALS" | "QUESTIONNAIRE") and optional age threshold
    if (rawCategory) {
      if (rawCategory !== "ALL" && rawCategory !== "VITALS" && rawCategory !== "QUESTIONNAIRE") {
        return NextResponse.json(
          { message: "Invalid cleanup category. Use ALL, VITALS, or QUESTIONNAIRE." },
          { status: 400 }
        )
      }

      const access = await authorizeHealthAccess(requestedElderId)
      if ("error" in access) {
        return access.error
      }

      const where: Prisma.HealthMeasurementWhereInput = {
        elderId: access.elderId,
      }

      if (rawCategory === "QUESTIONNAIRE") {
        where.type = { in: QUESTIONNAIRE_TYPES }
      } else if (rawCategory === "VITALS") {
        where.type = { notIn: QUESTIONNAIRE_TYPES }
      }

      if (
        olderThanDaysParam !== undefined &&
        olderThanDaysParam !== null &&
        String(olderThanDaysParam).trim() !== ""
      ) {
        const days = Number(olderThanDaysParam)
        if (!Number.isFinite(days) || days < 0) {
          return NextResponse.json({ message: "Invalid olderThanDays value" }, { status: 400 })
        }

        if (days > 0) {
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          where.timestamp = { lt: cutoff }
        }
      }

      const matching = await prisma.healthMeasurement.findMany({
        where,
        select: { id: true },
      })
      const deletedIds = matching.map((m) => m.id)

      const result =
        deletedIds.length > 0
          ? await prisma.healthMeasurement.deleteMany({
              where: {
                id: { in: deletedIds },
                elderId: access.elderId,
              },
            })
          : { count: 0 }

      return NextResponse.json(
        {
          message: `Deleted ${result.count} old record${result.count === 1 ? "" : "s"}`,
          deletedCount: result.count,
          deletedIds,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { message: "Specify a record id, ids list, or bulk cleanup category" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Health DELETE error:", error)
    return NextResponse.json({ message: "Failed to delete health data" }, { status: 500 })
  }
}
