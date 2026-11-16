import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendSilentAlarmSchedulePush } from "@/lib/alarmSync"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 403 })
    }

    const body = (await req.json()) as {
      elderId?: string
      specialNoticeEnabled?: boolean
      specialNoticeType?: "TEXT" | "VOICE" | "VIDEO"
      specialNoticeText?: string
      specialNoticeAudioUrl?: string
      specialNoticeMaxCount?: number
      applyToAllAlarms?: boolean
    }

    if (!body.elderId) {
      return NextResponse.json({ message: "elderId is required" }, { status: 400 })
    }

    const elder = await prisma.user.findFirst({
      where: { id: body.elderId, role: "ELDER" },
      select: { id: true, name: true }
    })

    if (!elder) {
      return NextResponse.json({ message: "Elder account not found" }, { status: 404 })
    }

    const enabled = body.specialNoticeEnabled === true
    const noticeType = body.specialNoticeType === "VIDEO" ? "VIDEO" : body.specialNoticeType === "VOICE" ? "VOICE" : "TEXT"
    const noticeText = typeof body.specialNoticeText === "string" ? body.specialNoticeText.trim() : ""
    const mediaUrl = typeof body.specialNoticeAudioUrl === "string" ? body.specialNoticeAudioUrl.trim() : ""
    const maxCount = Math.max(1, typeof body.specialNoticeMaxCount === "number" ? body.specialNoticeMaxCount : 5)
    const newVersion = String(Date.now())

    const updateData = {
      specialNoticeEnabled: enabled,
      specialNoticeType: noticeType,
      specialNoticeText: noticeText,
      specialNoticeAudioUrl: mediaUrl,
      specialNoticeMaxCount: maxCount,
      specialNoticeShownCount: 0,
      specialNoticeVersion: newVersion
    }

    let updatedCount = 0
    if (body.applyToAllAlarms !== false) {
      const result = await prisma.medication.updateMany({
        where: { elderId: elder.id },
        data: updateData
      })
      updatedCount = result.count
    }

    // Trigger silent FCM sync to update elder's device phone memory and pre-cache media
    await sendSilentAlarmSchedulePush(elder.id)

    return NextResponse.json({
      success: true,
      elderId: elder.id,
      elderName: elder.name,
      updatedMedicationsCount: updatedCount,
      specialNoticeEnabled: enabled,
      specialNoticeType: noticeType,
      version: newVersion
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error"
    console.error("[api/admin/post-alarm-notice] Error:", error)
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
