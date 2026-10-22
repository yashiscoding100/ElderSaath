import { NextResponse } from "next/server"
import { 
  DEMO_PARENT_EMAIL, 
  DEMO_CHILD_EMAIL, 
  DEMO_PASSWORD, 
  ensureDemoAccountsExist, 
  isDemoEnabled 
} from "@/lib/demoConfig"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const enabled = await isDemoEnabled()
    if (!enabled) {
      return NextResponse.json({ message: "Demo mode is currently disabled by administrator." }, { status: 403 })
    }

    const { role } = await req.json()
    if (role !== "PARENT" && role !== "CHILD") {
      return NextResponse.json({ message: "Invalid demo role selected" }, { status: 400 })
    }

    // Ensure demo accounts and relationships are present in DB
    await ensureDemoAccountsExist()

    const email = role === "PARENT" ? DEMO_PARENT_EMAIL : DEMO_CHILD_EMAIL
    const password = DEMO_PASSWORD
    const redirectUrl = role === "PARENT" ? "/elder/home" : "/child/dashboard"

    return NextResponse.json({
      success: true,
      email,
      password,
      redirectUrl
    }, { status: 200 })
  } catch (err: any) {
    console.error("Demo login error:", err)
    return NextResponse.json({ message: err.message || "Failed to initialize demo" }, { status: 500 })
  }
}
