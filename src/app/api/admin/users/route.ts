import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isValidAlarmHexColor, sendSilentAlarmSchedulePush } from "@/lib/alarmSync"

export const dynamic = "force-dynamic"

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
  } catch {
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      id,
      isBlocked,
      blockMessage,
      name,
      role,
      autoSnoozeEnabled,
      autoSnoozeAfterSeconds,
      alarmSnoozeDuration,
      alarmSnoozeText,
      sosEnabled,
      canManageMeds,
      notifyVitals,
      notifySnooze,
      stickyAlarmNotification,
      alarmButtonOrder,
      alarmTakeBtnColor,
      alarmSnoozeBtnColor
    } = body

    if (!id) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    if (id === session.user.id && isBlocked) {
      return NextResponse.json({ message: "Cannot block yourself" }, { status: 400 })
    }

    const updateData: {
      isBlocked?: boolean
      blockMessage?: string | null
      name?: string
      role?: string
      autoSnoozeEnabled?: boolean
      autoSnoozeAfterSeconds?: number
      alarmSnoozeDuration?: number
      alarmSnoozeText?: string
      sosEnabled?: boolean
      canManageMeds?: boolean
      notifyVitals?: boolean
      notifySnooze?: boolean
      alarmButtonOrder?: string
      alarmTakeBtnColor?: string
      alarmSnoozeBtnColor?: string
    } = {}

    if (isBlocked !== undefined) {
      updateData.isBlocked = Boolean(isBlocked)
      updateData.blockMessage = isBlocked ? (blockMessage ? String(blockMessage) : null) : null
    }
    if (name !== undefined) updateData.name = String(name)
    if (role !== undefined) updateData.role = String(role)
    if (autoSnoozeEnabled !== undefined) {
      updateData.autoSnoozeEnabled = Boolean(autoSnoozeEnabled)
    }
    if (autoSnoozeAfterSeconds !== undefined) {
      const parsedSec = Number(autoSnoozeAfterSeconds)
      if (!Number.isFinite(parsedSec) || parsedSec < 5 || parsedSec > 3600) {
        return NextResponse.json(
          { message: "Auto-snooze time must be between 5 seconds and 60 minutes (3600s)" },
          { status: 400 }
        )
      }
      updateData.autoSnoozeAfterSeconds = Math.round(parsedSec)
    }
    if (alarmSnoozeDuration !== undefined) {
      const parsedMin = Number(alarmSnoozeDuration)
      if (!Number.isFinite(parsedMin) || parsedMin < 1 || parsedMin > 180) {
        return NextResponse.json(
          { message: "Snooze interval must be between 1 and 180 minutes" },
          { status: 400 }
        )
      }
      updateData.alarmSnoozeDuration = Math.round(parsedMin)
    }
    if (alarmSnoozeText !== undefined) {
      const trimmed = String(alarmSnoozeText).trim().slice(0, 80)
      updateData.alarmSnoozeText = trimmed || "Take later"
    }
    if (sosEnabled !== undefined) updateData.sosEnabled = Boolean(sosEnabled)
    if (canManageMeds !== undefined) updateData.canManageMeds = Boolean(canManageMeds)
    if (notifyVitals !== undefined) updateData.notifyVitals = Boolean(notifyVitals)
    if (notifySnooze !== undefined) updateData.notifySnooze = Boolean(notifySnooze)
    if (alarmButtonOrder !== undefined) {
      if (alarmButtonOrder !== "TAKE_FIRST" && alarmButtonOrder !== "SNOOZE_FIRST") {
        return NextResponse.json(
          { message: "Alarm button order must be TAKE_FIRST or SNOOZE_FIRST" },
          { status: 400 }
        )
      }
      updateData.alarmButtonOrder = alarmButtonOrder
    }
    if (alarmTakeBtnColor !== undefined) {
      if (!isValidAlarmHexColor(alarmTakeBtnColor)) {
        return NextResponse.json(
          { message: "Take Medicine button color must be a valid hex color (e.g. #10B981)" },
          { status: 400 }
        )
      }
      updateData.alarmTakeBtnColor = String(alarmTakeBtnColor).trim().toUpperCase()
    }
    if (alarmSnoozeBtnColor !== undefined) {
      if (!isValidAlarmHexColor(alarmSnoozeBtnColor)) {
        return NextResponse.json(
          { message: "Snooze button color must be a valid hex color (e.g. #334155)" },
          { status: 400 }
        )
      }
      updateData.alarmSnoozeBtnColor = String(alarmSnoozeBtnColor).trim().toUpperCase()
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: updateData
      })
    }

    if (stickyAlarmNotification !== undefined) {
      await prisma.elderProfile.upsert({
        where: { userId: id },
        update: { stickyAlarmNotification: Boolean(stickyAlarmNotification) },
        create: { userId: id, stickyAlarmNotification: Boolean(stickyAlarmNotification) }
      })
    }

    // Immediately sync updated alarm & auto-snooze configuration to the user's phone memory via silent FCM
    if (
      autoSnoozeEnabled !== undefined ||
      autoSnoozeAfterSeconds !== undefined ||
      alarmSnoozeDuration !== undefined ||
      alarmSnoozeText !== undefined ||
      stickyAlarmNotification !== undefined ||
      alarmButtonOrder !== undefined ||
      alarmTakeBtnColor !== undefined ||
      alarmSnoozeBtnColor !== undefined
    ) {
      await sendSilentAlarmSchedulePush(id, { settingsOnly: true }).catch(() => {})
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

    return NextResponse.json(
      { message: "Account created successfully", user: { id: user.id, email: user.email } },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ message: "Failed to create account" }, { status: 500 })
  }
}
