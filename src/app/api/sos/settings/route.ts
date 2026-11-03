import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSosConfig, saveSosConfig } from "@/lib/sosConfig"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  let targetElderId = url.searchParams.get("elderId")

  if (session.user.role === "ELDER") {
    targetElderId = session.user.id
  } else if (session.user.role === "CHILD") {
    if (!targetElderId) {
      // Find the first active linked elder for this child
      const rel = await prisma.caregiverRelationship.findFirst({
        where: { childId: session.user.id, status: "ACTIVE" }
      })
      targetElderId = rel?.elderId || null
    } else {
      const rel = await prisma.caregiverRelationship.findFirst({
        where: { childId: session.user.id, elderId: targetElderId, status: "ACTIVE" }
      })
      if (!rel) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  }

  if (!targetElderId) {
    return NextResponse.json({ message: "No elder found" }, { status: 400 })
  }

  const config = await getSosConfig(targetElderId)
  return NextResponse.json({ config, elderId: targetElderId })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const data = await req.json()
    let targetElderId = data.elderId

    if (session.user.role === "ELDER") {
      targetElderId = session.user.id
    } else if (session.user.role === "CHILD") {
      if (!targetElderId) return NextResponse.json({ message: "Missing elderId" }, { status: 400 })
      const rel = await prisma.caregiverRelationship.findFirst({
        where: { childId: session.user.id, elderId: targetElderId, status: "ACTIVE" }
      })
      if (!rel) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const updated = await saveSosConfig(targetElderId, data)
    return NextResponse.json({ success: true, config: updated })
  } catch (error: any) {
    console.error("[api/sos/settings] POST Error:", error)
    return NextResponse.json({ message: "Failed to update settings", error: error.message }, { status: 500 })
  }
}
