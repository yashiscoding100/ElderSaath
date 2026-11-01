import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { saveStartupPopupConfig, getStartupPopupConfig, StartupPopupConfig } from "@/lib/startupPopup"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Partial<StartupPopupConfig>

    const success = await saveStartupPopupConfig(body)
    if (!success) {
      throw new Error("Failed to write to database")
    }

    const updated = await getStartupPopupConfig()

    return NextResponse.json({
      message: `Startup popup ${updated.enabled ? "enabled and active" : "disabled"} successfully`,
      config: updated
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/admin/startup-popup] Error:", error)
    return NextResponse.json({ message: "Error updating startup popup", error: error.message }, { status: 500 })
  }
}
