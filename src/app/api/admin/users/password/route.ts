import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { sendPushNotification } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      return NextResponse.json({ message: "User ID and new password are required" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters long" }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true }
    })

    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // 1. Hash the new password securely using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // 2. Update user's password in database
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // 3. Immediately dispatch push notification to the user's phone & in-app bell
    try {
      await sendPushNotification(userId, {
        title: "Security Notice: Password Updated",
        body: "Your ElderSaath account password was updated by the Admin. Please call your administrator to get your new password.",
        url: "/login?fresh=true"
      })
    } catch (pushErr) {
      console.error("[AdminPasswordReset] Push error:", pushErr)
    }

    return NextResponse.json({
      message: `Password successfully updated for ${targetUser.name || targetUser.email}. Notification dispatched to user's phone!`,
      user: { id: targetUser.id, email: targetUser.email, name: targetUser.name }
    }, { status: 200 })
  } catch (error: any) {
    console.error("[AdminPasswordReset] Error:", error)
    return NextResponse.json({ message: "Failed to update password", error: error.message }, { status: 500 })
  }
}
