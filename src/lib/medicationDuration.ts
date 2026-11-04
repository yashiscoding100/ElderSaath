import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { sendSilentAlarmSchedulePush } from "@/lib/alarmSync"

export type DurationUnit = "DAYS" | "WEEKS" | "MONTHS"

export function calculateEndDate(
  startDate: Date = new Date(),
  durationValue?: number | null,
  durationUnit?: string | null
): Date | null {
  if (!durationValue || durationValue <= 0 || !durationUnit) {
    return null
  }

  const end = new Date(startDate.getTime())
  const val = Math.floor(durationValue)

  if (durationUnit === "DAYS") {
    end.setDate(end.getDate() + val)
  } else if (durationUnit === "WEEKS") {
    end.setDate(end.getDate() + val * 7)
  } else if (durationUnit === "MONTHS") {
    end.setMonth(end.getMonth() + val)
  } else {
    return null
  }

  // Set to end of the day 23:59:59 so the full final day is included
  end.setHours(23, 59, 59, 999)
  return end
}

export function formatDurationSummary(
  durationValue?: number | null,
  durationUnit?: string | null,
  endDate?: Date | string | null
): string | null {
  if (!endDate) return null

  const end = new Date(endDate)
  const formattedDate = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })

  const now = new Date()
  const isExpired = now.getTime() > end.getTime()

  if (isExpired) {
    return `Course ended on ${formattedDate}`
  }

  if (durationValue && durationUnit) {
    const unitLabel = durationValue === 1 
      ? durationUnit.slice(0, -1).toLowerCase() 
      : durationUnit.toLowerCase()
    return `${durationValue} ${unitLabel} (until ${formattedDate})`
  }

  return `Until ${formattedDate}`
}

export function isMedicationExpired(endDate?: Date | string | null): boolean {
  if (!endDate) return false
  const end = new Date(endDate)
  return new Date().getTime() > end.getTime()
}

/**
 * Checks for any medications whose prescribed duration has passed,
 * notifies both the elder and all linked family members, and stops the daily alarms.
 */
export async function checkAndNotifyExpiredMedications(targetElderId?: string) {
  try {
    const now = new Date()

    const whereClause: any = {
      endDate: {
        lte: now
      },
      durationNotified: false
    }

    if (targetElderId) {
      whereClause.elderId = targetElderId
    }

    const expiredMeds = await prisma.medication.findMany({
      where: whereClause,
      include: {
        elder: {
          select: { id: true, name: true }
        }
      }
    })

    if (expiredMeds.length === 0) return []

    for (const med of expiredMeds) {
      // 1. Fetch all linked family members for this elder
      const relationships = await prisma.caregiverRelationship.findMany({
        where: {
          elderId: med.elderId,
          status: "ACTIVE"
        },
        select: {
          childId: true
        }
      })

      const elderName = med.elder?.name || "Your loved one"
      const durationStr = med.durationValue && med.durationUnit 
        ? `${med.durationValue} ${med.durationUnit.toLowerCase()}` 
        : "prescribed"

      const notificationTitle = `💊 Medication Course Finished: ${med.name}`
      const notificationBodyElder = `Your ${durationStr} course of ${med.name} (${med.dosage}) has finished today! The daily alarm has been stopped. Please consult your doctor for a follow-up or next steps.`
      const notificationBodyFamily = `Prescribed course for ${med.name} (${med.dosage}) for ${elderName} has finished today. Daily alarms are now off. You may schedule a doctor visit or review further action.`

      // 2. Create in-app notification for Elder
      await prisma.appNotification.create({
        data: {
          userId: med.elderId,
          title: notificationTitle,
          message: notificationBodyElder,
          type: "ALERT",
          link: "/elder/medications"
        }
      }).catch((e) => console.warn("Elder notification error:", e))

      // 3. Send Push to Elder
      sendPushNotification(med.elderId, {
        title: notificationTitle,
        body: notificationBodyElder,
        url: "/elder/medications"
      }).catch(() => {})

      // 4. Create in-app notifications and send push to all linked children
      for (const rel of relationships) {
        await prisma.appNotification.create({
          data: {
            userId: rel.childId,
            title: notificationTitle,
            message: notificationBodyFamily,
            type: "ALERT",
            link: "/child/medications"
          }
        }).catch((e) => console.warn("Child notification error:", e))

        sendPushNotification(rel.childId, {
          title: notificationTitle,
          body: notificationBodyFamily,
          url: "/child/medications"
        }).catch(() => {})
      }

      // 5. Mark as notified so notification is sent only once
      await prisma.medication.update({
        where: { id: med.id },
        data: { durationNotified: true }
      }).catch((e) => console.warn("Update durationNotified error:", e))

      // 6. Trigger silent alarm sync to remove the alarm from the phone's native AlarmManager
      await sendSilentAlarmSchedulePush(med.elderId).catch(() => {})
    }

    return expiredMeds
  } catch (error) {
    console.error("[checkAndNotifyExpiredMedications] Error:", error)
    return []
  }
}
