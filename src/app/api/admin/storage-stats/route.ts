import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getDatabaseStorageStats } from "@/lib/databaseStorage"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const stats = await getDatabaseStorageStats()
    return NextResponse.json({ stats }, { status: 200 })
  } catch (error: any) {
    console.error("[api/admin/storage-stats] Error:", error)
    return NextResponse.json({ message: "Failed to fetch storage stats: " + error.message }, { status: 500 })
  }
}
