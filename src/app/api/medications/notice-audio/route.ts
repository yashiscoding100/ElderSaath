import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const medId = searchParams.get("id")
    if (!medId) {
      return NextResponse.json({ message: "Medication ID is required" }, { status: 400 })
    }

    const session = await auth()
    const alarmSecret = req.headers.get("x-app-alarm-secret")
    const isNativeAlarmRequest = alarmSecret === "ElderSaath-Hardware-Alarm-v1"

    if (!session && !isNativeAlarmRequest) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const med = await prisma.medication.findUnique({
      where: { id: medId },
      select: {
        id: true,
        elderId: true,
        specialNoticeAudioUrl: true,
        specialNoticeAudioName: true
      }
    })

    if (!med || !med.specialNoticeAudioUrl) {
      return NextResponse.json({ message: "Voice notice audio not found" }, { status: 404 })
    }

    if (session && !isNativeAlarmRequest) {
      if (session.user.role === "ELDER" && med.elderId !== session.user.id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
      if (session.user.role === "CHILD") {
        const rel = await prisma.caregiverRelationship.findUnique({
          where: { elderId_childId: { elderId: med.elderId, childId: session.user.id } }
        })
        if (!rel || rel.status !== "ACTIVE") {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }
      }
    }

    const rawUrl = med.specialNoticeAudioUrl.trim()

    if (rawUrl.startsWith("data:")) {
      const match = rawUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ message: "Invalid stored audio format" }, { status: 500 })
      }
      const mimeType = match[1] || "audio/mpeg"
      const buffer = Buffer.from(match[2], "base64")
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(buffer.length),
          "Cache-Control": "private, max-age=86400",
          "Accept-Ranges": "bytes"
        }
      })
    }

    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      const upstream = await fetch(rawUrl)
      if (!upstream.ok) {
        return NextResponse.json({ message: "Upstream audio unavailable" }, { status: 502 })
      }
      const arrayBuf = await upstream.arrayBuffer()
      const contentType = upstream.headers.get("content-type") || "audio/mpeg"
      return new NextResponse(Buffer.from(arrayBuf), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(arrayBuf.byteLength),
          "Cache-Control": "private, max-age=86400"
        }
      })
    }

    return NextResponse.json({ message: "Unsupported audio URL" }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notice-audio] Error:", error)
    return NextResponse.json({ message: "Failed to serve audio", error: message }, { status: 500 })
  }
}
