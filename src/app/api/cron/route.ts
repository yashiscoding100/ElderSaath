import { NextResponse } from "next/server"
import { runMedicationAndTaskCrons } from "@/lib/cronRunner"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get("force") === "true"

    const result = await runMedicationAndTaskCrons(force)

    return NextResponse.json({
      scheduled: result.totalScheduled,
      ...result
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/cron] Error:", error)
    return NextResponse.json({
      message: "Failed to run cron",
      error: error?.message || String(error)
    }, { status: 500 })
  }
}
