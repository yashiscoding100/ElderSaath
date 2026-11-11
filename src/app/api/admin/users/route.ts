import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { sendSilentAlarmSchedulePush } from "@/lib/alarmSync"

export const dynamic = 'force-dynamic'

export async function DELETE(req: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    if (id === session.user.id) {
      return NextResponse.json({ message: "Cannot delete yourself" }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: "User deleted" }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id, isBlocked, blockMessage, name, role, autoSnoozeEnabled, autoSnoozeAfterSeconds } = await req.json()

    if (!id) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    if (id === session.user.id && isBlocked) {
      return NextResponse.json({ message: "Cannot block yourself" }, { status: 400 })
    }

    const updateData: any = {}
    if (isBlocked !== undefined) {
      updateData.isBlocked = isBlocked
      updateData.blockMessage = isBlocked ? blockMessage : null
    }
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (autoSnoozeEnabled !== undefined) {
      updateData.autoSnoozeEnabled = Boolean(autoSnoozeEnabled)
    }
    if (autoSnoozeAfterSeconds !== undefined) {
      const parsedSec = Number(autoSnoozeAfterSeconds)
      if (!Number.isFinite(parsedSec) || parsedSec < 5 || parsedSec > 3600) {
        return NextResponse.json({ message: "Auto-snooze time must be between 5 seconds and 60 minutes (3600s)" }, { status: 400 })
      }
      updateData.autoSnoozeAfterSeconds = Math.round(parsedSec)
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    })

    // Immediately sync updated alarm & auto-snooze configuration to the user's phone memory via silent FCM
    if (autoSnoozeEnabled !== undefined || autoSnoozeAfterSeconds !== undefined) {
      await sendSilentAlarmSchedulePush(id).catch(() => {})
    }

    return NextResponse.json({ message: "User updated successfully" }, { status: 200 })
  } catch (error) {
    console.error("PATCH error:", error)
    return NextResponse.json({ message: "Failed to update user", error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, email, password, role } = await req.json()

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      }
    })

    return NextResponse.json({ message: "Account created successfully", user: { id: user.id, email: user.email } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Failed to create account" }, { status: 500 })
  }
}
