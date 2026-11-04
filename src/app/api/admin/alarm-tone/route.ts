import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { saveAlarmToneConfig, getAlarmToneConfig } from "@/lib/alarmToneConfig"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const config = await getAlarmToneConfig()
  return NextResponse.json({ config })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const updated = await saveAlarmToneConfig(body)

    // Broadcast silent sync push to all elders so devices immediately download and switch the tone
    try {
      const elders = await prisma.user.findMany({
        where: { role: "ELDER" },
        select: { id: true }
      })

      for (const elder of elders) {
        sendPushNotification(elder.id, {
          type: "SYNC_ALARM_TONE",
          customToneEnabled: updated.enabled ? "true" : "false",
          customToneUrl: updated.toneUrl || "",
          customToneTitle: updated.toneTitle || ""
        }).catch((e) => console.warn(`[admin/alarm-tone] Push warning for elder ${elder.id}:`, e))
      }
    } catch (pushErr) {
      console.warn("[admin/alarm-tone] Broadcast push warning:", pushErr)
    }

    return NextResponse.json({
      success: true,
      config: updated,
      message: updated.enabled
        ? `🟢 Custom alarm tone "${updated.toneTitle}" enabled for all users.`
        : "⚪ Custom alarm tones disabled. All devices will use phone's system default alarm tone."
    })
  } catch (error: any) {
    console.error("[api/admin/alarm-tone] Error:", error)
    return NextResponse.json({ message: "Failed to update alarm tone: " + error.message }, { status: 500 })
  }
}
