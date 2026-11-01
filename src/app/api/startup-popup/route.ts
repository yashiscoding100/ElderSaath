import { NextResponse } from "next/server"
import { getStartupPopupConfig } from "@/lib/startupPopup"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const config = await getStartupPopupConfig()
    return NextResponse.json({ config }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
