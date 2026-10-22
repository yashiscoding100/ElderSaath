import { NextResponse } from "next/server"
import { isDemoEnabled } from "@/lib/demoConfig"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const enabled = await isDemoEnabled()
    return NextResponse.json({ enabled }, { status: 200 })
  } catch {
    return NextResponse.json({ enabled: true }, { status: 200 })
  }
}
