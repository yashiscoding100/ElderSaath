import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const elderId = body.elderId
    
    if (elderId) {
      const cookieStore = await cookies()
      cookieStore.set("activeElderId", elderId, {
        path: "/",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })
    }

    return NextResponse.json({ success: true, activeElderId: elderId })
  } catch (error) {
    return NextResponse.json({ message: "Internal Error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const elderId = searchParams.get("elderId")
    const redirectUrl = searchParams.get("redirect") || "/child/dashboard"
    
    if (elderId) {
      const cookieStore = await cookies()
      cookieStore.set("activeElderId", elderId, {
        path: "/",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })
    }

    return NextResponse.redirect(new URL(redirectUrl, req.url))
  } catch (error) {
    return NextResponse.json({ message: "Internal Error" }, { status: 500 })
  }
}
