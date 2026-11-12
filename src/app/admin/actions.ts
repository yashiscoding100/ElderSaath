"use server"

import { auth, signIn } from "@/auth"

export async function getImpersonationSecret() {
  const session = await auth()
  
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }

  if (!process.env.IMPERSONATION_SECRET) {
    throw new Error("Impersonation secret is not configured on the server")
  }

  return process.env.IMPERSONATION_SECRET
}
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export async function testAlarm(userId: string) { const session = await auth(); if (session?.user?.role !== 'ADMIN') return { success: false, message: 'Unauthorized' }; const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } }); if (subscriptions.length === 0) return { success: false, message: 'No push subscription found.' }; let sent = 0; for (const sub of subscriptions) { try { await sendPushNotification(userId, { title: 'ALARM TEST', body: 'Test', url: '/' }); sent++; } catch (e: any) { return { success: false, message: e.message || 'Firebase Push Error' }; } } return { success: true, message: 'Sent alarm to ' + sent + ' devices.' }; }

export async function sendAdminNotification(userId: string, title: string, body: string, isAlarm = false, snoozeDuration = 10, snoozeText = "I'll take the medicines later") {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return { success: false, message: 'Unauthorized' }

  try {
    let autoSnoozeEnabled = false
    let autoSnoozeAfterSeconds = 60
    let alarmButtonOrder = "TAKE_FIRST"
    let alarmTakeBtnColor = "#10B981"
    let alarmSnoozeBtnColor = "#334155"

    if (isAlarm && userId !== "ALL") {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          autoSnoozeEnabled: true,
          autoSnoozeAfterSeconds: true,
          alarmButtonOrder: true,
          alarmTakeBtnColor: true,
          alarmSnoozeBtnColor: true
        }
      })
      if (targetUser) {
        autoSnoozeEnabled = targetUser.autoSnoozeEnabled
        autoSnoozeAfterSeconds = targetUser.autoSnoozeAfterSeconds
        alarmButtonOrder = targetUser.alarmButtonOrder === "SNOOZE_FIRST" ? "SNOOZE_FIRST" : "TAKE_FIRST"
        alarmTakeBtnColor = /^#[0-9A-Fa-f]{6}$/.test(targetUser.alarmTakeBtnColor || "")
          ? targetUser.alarmTakeBtnColor.toUpperCase()
          : "#10B981"
        alarmSnoozeBtnColor = /^#[0-9A-Fa-f]{6}$/.test(targetUser.alarmSnoozeBtnColor || "")
          ? targetUser.alarmSnoozeBtnColor.toUpperCase()
          : "#334155"
      }
    }

    const payload: Record<string, unknown> = {
      title,
      body,
      url: '/',
      type: isAlarm ? 'ALARM' : 'NOTIFICATION',
      snoozeDuration: String(snoozeDuration),
      label: title,
      snoozeText,
      ...(userId !== "ALL" ? { elderId: userId } : {}),
      ...(isAlarm && userId !== "ALL" ? {
        autoSnoozeEnabled: String(autoSnoozeEnabled),
        autoSnoozeAfterSeconds: String(autoSnoozeAfterSeconds),
        alarmButtonOrder,
        alarmTakeBtnColor,
        alarmSnoozeBtnColor
      } : {})
    }

    if (userId === "ALL") {
      const { broadcastPushNotification } = await import('@/lib/push')
      await broadcastPushNotification(payload)
      return { success: true, message: 'Broadcast sent to all devices.' }
    } else {
      await sendPushNotification(userId, payload)
      return { success: true, message: 'Notification sent to user.' }
    }
  } catch (e: any) {
    return { success: false, message: e.message || 'Push Error' }
  }
}

export async function createFamilyNetwork(elderIds: string[], childIds: string[]) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")

  let count = 0
  for (const elderId of elderIds) {
    for (const childId of childIds) {
      // Upsert to avoid unique constraint errors
      await prisma.caregiverRelationship.upsert({
        where: {
          elderId_childId: { elderId, childId }
        },
        update: {
          status: "ACTIVE"
        },
        create: {
          elderId,
          childId,
          status: "ACTIVE",
          priority: 1
        }
      })
      count++
    }
  }
  return { success: true, message: `Successfully linked ${count} connections to form the family network!` }
}

export async function purgeAllMedicalDocuments() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    const docs = await prisma.medicalDocument.findMany({
      select: { fileUrl: true }
    })

    const { deleteDocument } = await import("@/lib/storage")
    for (const doc of docs) {
      if (doc.fileUrl && doc.fileUrl.startsWith("http")) {
        await deleteDocument(doc.fileUrl).catch(() => {})
      }
    }

    const result = await prisma.medicalDocument.deleteMany({})

    const { revalidatePath } = await import("next/cache")
    revalidatePath("/admin")
    revalidatePath("/elder/documents")
    revalidatePath("/child/documents")

    return { 
      success: true, 
      message: `Successfully deleted ${result.count} medical documents and freed database storage.` 
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to purge documents" }
  }
}

export async function purgeDatabaseLogs() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    const deletedNotifications = await prisma.appNotification.deleteMany({})
    const deletedMedLogs = await prisma.medicationLog.deleteMany({})
    const deletedTaskLogs = await prisma.taskLog.deleteMany({})

    const total = deletedNotifications.count + deletedMedLogs.count + deletedTaskLogs.count

    const { revalidatePath } = await import("next/cache")
    revalidatePath("/admin")

    return {
      success: true,
      message: `Cleared ${total} historical logs (${deletedNotifications.count} notifications, ${deletedMedLogs.count} medication logs, ${deletedTaskLogs.count} task logs).`
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to purge logs" }
  }
}
