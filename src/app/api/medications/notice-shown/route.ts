import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const session = await auth()
    const alarmSecret = req.headers.get("x-app-alarm-secret")
    const isNativeAlarmRequest = alarmSecret === "ElderSaath-Hardware-Alarm-v1"

    const body = await req.json()
    const items = Array.isArray(body?.items) ? body.items : [body]

    const defaultElderId = session?.user?.id || body?.elderId
    if (!session && (!isNativeAlarmRequest || !defaultElderId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const results: Array<{
      medicationId: string
      skipped?: string
      currentShownCount?: number
      specialNoticeShownCount?: number
      specialNoticeMaxCount?: number
    }> = []

    for (const item of items) {
      const medicationId = item?.medicationId
      const itemElderId = item?.elderId || defaultElderId
      const reportedVersion = item?.version ? String(item.version) : null
      const reportedCount = item?.shownCount !== undefined ? Number(item.shownCount) : null

      if (!medicationId) continue

      const med = await prisma.medication.findUnique({
        where: { id: medicationId },
        select: {
          id: true,
          elderId: true,
          specialNoticeEnabled: true,
          specialNoticeMaxCount: true,
          specialNoticeShownCount: true,
          specialNoticeVersion: true
        }
      })

      if (!med) continue
      if (session?.user?.role === "ELDER" && med.elderId !== session.user.id) continue
      if (!session && itemElderId && med.elderId !== itemElderId) continue

      // Ignore stale sync records from an older special-notice version if child already reset/edited it
      if (
        med.specialNoticeVersion &&
        reportedVersion &&
        reportedVersion !== med.specialNoticeVersion
      ) {
        results.push({ medicationId, skipped: "version_mismatch", currentShownCount: med.specialNoticeShownCount })
        continue
      }

      const maxCount = Math.max(1, med.specialNoticeMaxCount || 5)
      const candidate =
        reportedCount !== null && Number.isFinite(reportedCount)
          ? Math.max(med.specialNoticeShownCount, Math.round(reportedCount))
          : med.specialNoticeShownCount + 1
      const nextCount = Math.min(maxCount, Math.max(0, candidate))

      if (nextCount !== med.specialNoticeShownCount) {
        await prisma.medication.update({
          where: { id: medicationId },
          data: { specialNoticeShownCount: nextCount }
        })
      }

      results.push({
        medicationId,
        specialNoticeShownCount: nextCount,
        specialNoticeMaxCount: maxCount
      })
    }

    return NextResponse.json({ success: true, results }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notice-shown] Error:", error)
    return NextResponse.json({ message: "Failed to record notice count", error: message }, { status: 500 })
  }
}
