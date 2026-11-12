import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"

export const dynamic = "force-dynamic"

function cleanOptionalText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

async function authorizeForElder(
  userId: string,
  userRole: string,
  requestedElderId: string | null
): Promise<{ elderId?: string; status?: number; message?: string }> {
  if (userRole === "ELDER") {
    if (requestedElderId && requestedElderId !== userId) {
      return { status: 403, message: "Forbidden" }
    }
    return { elderId: userId }
  }

  if (userRole === "CHILD") {
    let targetElderId = requestedElderId
    if (!targetElderId) {
      const activeRel = await getActiveElder(userId)
      targetElderId = activeRel?.elderId || null
    }
    if (!targetElderId) {
      return { status: 400, message: "No linked elder found" }
    }

    const rel = await prisma.caregiverRelationship.findUnique({
      where: { elderId_childId: { elderId: targetElderId, childId: userId } }
    })
    if (!rel || rel.status !== "ACTIVE") {
      return { status: 403, message: "Forbidden" }
    }
    return { elderId: targetElderId }
  }

  return { status: 403, message: "Only elders and linked caregivers can manage medication notes" }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const authResult = await authorizeForElder(
      session.user.id,
      session.user.role,
      searchParams.get("elderId")
    )
    if (!authResult.elderId) {
      return NextResponse.json(
        { message: authResult.message || "Forbidden" },
        { status: authResult.status || 403 }
      )
    }

    const notes = await prisma.medicationNote.findMany({
      where: { elderId: authResult.elderId },
      orderBy: { updatedAt: "desc" }
    })

    return NextResponse.json({ notes }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notes GET] Error:", error)
    return NextResponse.json({ message: "Failed to load notes: " + msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const authResult = await authorizeForElder(
      session.user.id,
      session.user.role,
      typeof body.elderId === "string" ? body.elderId : null
    )
    if (!authResult.elderId) {
      return NextResponse.json(
        { message: authResult.message || "Forbidden" },
        { status: authResult.status || 403 }
      )
    }

    const medicineName = cleanOptionalText(body.medicineName, 160)
    const timingText = cleanOptionalText(body.timingText, 200)
    const doctorName = cleanOptionalText(body.doctorName, 160)
    const durationText = cleanOptionalText(body.durationText, 160)
    const notes = cleanOptionalText(body.notes, 4000)

    if (!medicineName && !timingText && !doctorName && !durationText && !notes) {
      return NextResponse.json(
        { message: "Please write at least a medicine name or note details before saving." },
        { status: 400 }
      )
    }

    const note = await prisma.medicationNote.create({
      data: {
        elderId: authResult.elderId,
        authorId: session.user.id,
        authorName: session.user.name || session.user.email || (session.user.role === "ELDER" ? "Elder" : "Family"),
        authorRole: session.user.role,
        medicineName,
        timingText,
        doctorName,
        durationText,
        notes
      }
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notes POST] Error:", error)
    return NextResponse.json({ message: "Failed to save note: " + msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const id = typeof body.id === "string" ? body.id.trim() : ""
    if (!id) {
      return NextResponse.json({ message: "Note ID is required" }, { status: 400 })
    }

    const existing = await prisma.medicationNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 })
    }

    const authResult = await authorizeForElder(
      session.user.id,
      session.user.role,
      existing.elderId
    )
    if (!authResult.elderId) {
      return NextResponse.json(
        { message: authResult.message || "Forbidden" },
        { status: authResult.status || 403 }
      )
    }

    const medicineName = cleanOptionalText(body.medicineName, 160)
    const timingText = cleanOptionalText(body.timingText, 200)
    const doctorName = cleanOptionalText(body.doctorName, 160)
    const durationText = cleanOptionalText(body.durationText, 160)
    const notes = cleanOptionalText(body.notes, 4000)

    if (!medicineName && !timingText && !doctorName && !durationText && !notes) {
      return NextResponse.json(
        { message: "Please keep at least a medicine name or note details." },
        { status: 400 }
      )
    }

    const updated = await prisma.medicationNote.update({
      where: { id },
      data: {
        authorId: session.user.id,
        authorName: session.user.name || session.user.email || (session.user.role === "ELDER" ? "Elder" : "Family"),
        authorRole: session.user.role,
        medicineName,
        timingText,
        doctorName,
        durationText,
        notes
      }
    })

    return NextResponse.json({ note: updated }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notes PATCH] Error:", error)
    return NextResponse.json({ message: "Failed to update note: " + msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    let id = searchParams.get("id")?.trim() || ""
    if (!id) {
      const body = await req.json().catch(() => ({}))
      if (typeof body.id === "string") id = body.id.trim()
    }
    if (!id) {
      return NextResponse.json({ message: "Note ID is required" }, { status: 400 })
    }

    const existing = await prisma.medicationNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 })
    }

    const authResult = await authorizeForElder(
      session.user.id,
      session.user.role,
      existing.elderId
    )
    if (!authResult.elderId) {
      return NextResponse.json(
        { message: authResult.message || "Forbidden" },
        { status: authResult.status || 403 }
      )
    }

    await prisma.medicationNote.delete({ where: { id } })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notes DELETE] Error:", error)
    return NextResponse.json({ message: "Failed to delete note: " + msg }, { status: 500 })
  }
}
