import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 403 })
    }

    const body = (await req.json()) as {
      elderId?: string
      title?: string
      message?: string
      noticeType?: "TEXT" | "VOICE" | "VIDEO"
      mediaUrl?: string
    }

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "📢 General Awareness Notice"
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : "Important health and wellness notice."
    const noticeType = body.noticeType === "VIDEO" ? "VIDEO" : body.noticeType === "VOICE" ? "VOICE" : "TEXT"
    const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : ""

    let targetElderIds: string[] = []
    if (body.elderId && body.elderId !== "ALL") {
      const elder = await prisma.user.findFirst({
        where: { id: body.elderId, role: "ELDER" },
        select: { id: true }
      })
      if (!elder) {
        return NextResponse.json({ message: "Elder account not found" }, { status: 404 })
      }
      targetElderIds = [elder.id]
    } else {
      const allElders = await prisma.user.findMany({
        where: { role: "ELDER" },
        select: { id: true }
      })
      targetElderIds = allElders.map(e => e.id)
    }

    if (targetElderIds.length === 0) {
      return NextResponse.json({ message: "No active elder accounts found to receive popup" }, { status: 400 })
    }

    const pushPayload: Record<string, string> = {
      type: "POPUP_NOTICE",
      title,
      message,
      body: message,
      noticeType,
      mediaUrl,
      triggerNonce: String(Date.now())
    }

    const pushPromises = targetElderIds.map(elderId =>
      sendPushNotification(elderId, {
        ...pushPayload,
        elderId
      })
    )

    await Promise.allSettled(pushPromises)

    return NextResponse.json({
      success: true,
      recipientsCount: targetElderIds.length,
      noticeType,
      title
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error"
    console.error("[api/admin/awareness-popup] Error:", error)
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
