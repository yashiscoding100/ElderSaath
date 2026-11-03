import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encodeElderUiStyle, ElderUiStyle } from "@/lib/elderUiPreferences"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { style, elderId } = await req.json()
    if (style !== "MODERN" && style !== "CLASSIC") {
      return NextResponse.json({ message: "Invalid style" }, { status: 400 })
    }

    let targetElderId = session.user.id

    // If a child is updating on behalf of an elder
    if (session.user.role === "CHILD") {
      if (!elderId) {
        return NextResponse.json({ message: "Missing elderId" }, { status: 400 })
      }
      const relationship = await prisma.caregiverRelationship.findFirst({
        where: {
          childId: session.user.id,
          elderId: elderId,
          status: "ACTIVE"
        }
      })
      if (!relationship) {
        return NextResponse.json({ message: "Unauthorized for this care recipient" }, { status: 403 })
      }
      targetElderId = elderId
    }

    // Retrieve existing profile to preserve existing notes
    const profile = await prisma.elderProfile.findUnique({
      where: { userId: targetElderId }
    })

    const updatedNotes = encodeElderUiStyle(profile?.notes, style as ElderUiStyle)

    await prisma.elderProfile.upsert({
      where: { userId: targetElderId },
      update: { notes: updatedNotes },
      create: {
        userId: targetElderId,
        notes: updatedNotes
      }
    })

    return NextResponse.json({ success: true, style })
  } catch (error) {
    console.error("Failed to update elder UI style:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    let targetElderId = session.user.id

    if (session.user.role === "CHILD") {
      const childElderId = searchParams.get("elderId")
      if (childElderId) {
        targetElderId = childElderId
      }
    }

    const profile = await prisma.elderProfile.findUnique({
      where: { userId: targetElderId },
      select: { notes: true }
    })

    const style = profile?.notes?.includes("[UI_STYLE:CLASSIC]") ? "CLASSIC" : "MODERN"
    return NextResponse.json({ style })
  } catch (error) {
    return NextResponse.json({ message: "Error reading style" }, { status: 500 })
  }
}
