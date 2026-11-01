import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { saveStartupPopupConfig, StartupPopupConfig } from "@/lib/startupPopup"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as StartupPopupConfig

    const success = await saveStartupPopupConfig(body)
    if (!success) {
      throw new Error("Failed to write to database")
    }

    return NextResponse.json({ message: "Startup popup settings updated successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("[api/admin/startup-popup] Error:", error)
    return NextResponse.json({ message: "Error updating startup popup", error: error.message }, { status: 500 })
  }
}
