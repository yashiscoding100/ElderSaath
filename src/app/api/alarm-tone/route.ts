import { NextResponse } from "next/server"
import { getAlarmToneConfig } from "@/lib/alarmToneConfig"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const config = await getAlarmToneConfig()
    return NextResponse.json(
      { config },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      }
    )
  } catch (error: any) {
    console.error("[api/alarm-tone] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
