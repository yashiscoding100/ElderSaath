import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

function getIstTime() {
  const now = new Date()
  
  // Format in Indian Standard Time (Asia/Kolkata)
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  })
  
  const parts = istFormatter.formatToParts(now)
  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === "hour") hour = parseInt(part.value, 10)
    if (part.type === "minute") minute = parseInt(part.value, 10)
  }
  
  // Normalize 24:00 to 00:00
  if (hour === 24) hour = 0
  const currentTotalMinutes = hour * 60 + minute

  // Date in IST for day of week and start of today
  const istDateStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" })
  const istDate = new Date(istDateStr)
  const dayOfWeek = istDate.getDay().toString() // "0" = Sun, "1" = Mon, etc.

  // Start of today in IST (UTC epoch)
  const startOfTodayIst = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate())

  return {
    hour,
    minute,
    currentTotalMinutes,
    dayOfWeek,
    startOfTodayIst
  }
}

export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null
  const cleaned = timeStr.trim().toUpperCase().replace(/\u202F/g, ' ').replace(/\s+/g, ' ')

  // 12-hour format: "09:50 PM", "9:50 AM", "8:00PM"
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2], 10)
    const isPm = match12[3] === "PM"
    if (isPm && h < 12) h += 12
    if (!isPm && h === 12) h = 0
    return h * 60 + m
  }

  // 24-hour format: "21:50", "09:50", "8:00"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const h = parseInt(match24[1], 10)
    const m = parseInt(match24[2], 10)
    return h * 60 + m
  }

  return null
}

export async function runMedicationAndTaskCrons(forceAll: boolean = false) {
  const { hour, minute, currentTotalMinutes, dayOfWeek, startOfTodayIst } = getIstTime()
  
  console.log(`[CronRunner] Current IST: ${hour}:${minute} (${currentTotalMinutes}m), Day: ${dayOfWeek}, Force: ${forceAll}`)

  // 1. Fetch all active medications
  const allMeds = await prisma.medication.findMany({
    include: { elder: { include: { elderProfile: true } } }
  })

  let firedMedsCount = 0
  const details: any[] = []

  for (const med of allMeds) {
    // Check day of week
    let freq = med.frequency
    if (!freq || freq.toLowerCase() === "daily" || freq === "") {
      freq = "0,1,2,3,4,5,6"
    }
    if (!freq.includes(dayOfWeek) && !forceAll) {
      continue
    }

    const medMinutes = parseTimeToMinutes(med.time)
    if (medMinutes === null) continue

    // Time window check:
    // With a 5-minute cron interval, allow matching if scheduled within the last 6 minutes
    // e.g. scheduled at 21:50, cron runs at 21:54 -> diff = 4 minutes (MATCH!)
    const diff = currentTotalMinutes - medMinutes
    const isDue = forceAll || (diff >= 0 && diff <= 6)

    if (!isDue) {
      continue
    }

    // Check if an alarm log was already recorded today to avoid duplicate rings
    const existingLog = await prisma.medicationLog.findFirst({
      where: {
        medicationId: med.id,
        timestamp: { gte: startOfTodayIst }
      }
    })

    if (existingLog && !forceAll) {
      console.log(`[CronRunner] Med ${med.name} (${med.time}) was already logged today, skipping duplicate.`)
      continue
    }

    // FIRE HYPER-AGGRESSIVE ALARM
    firedMedsCount++
    details.push({ medId: med.id, medName: med.name, elderId: med.elderId, time: med.time })

    try {
      await sendPushNotification(med.elderId, {
        type: "ALARM",
        actionText: "Take medicines",
        label: `Time for ${med.name}`,
        body: `Dosage: ${med.dosage}. ${med.instructions || ''}`.trim(),
        snoozeText: med.elder.alarmSnoozeText || "Take later",
        snoozeDuration: (med.elder.alarmSnoozeDuration || 10).toString(),
        elderId: med.elderId,
        stickyNotification: med.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false"
      })

      // Record in MedicationLog so it won't fire again today
      await prisma.medicationLog.create({
        data: {
          medicationId: med.id,
          elderId: med.elderId,
          status: "TRIGGERED"
        }
      })
      console.log(`[CronRunner] Fired ALARM for ${med.name} to elder ${med.elderId}`)
    } catch (err) {
      console.error(`[CronRunner] Push error for ${med.name}:`, err)
    }
  }

  // 2. Fetch all scheduled tasks
  const allTasks = await prisma.task.findMany({
    where: { time: { not: null } },
    include: { elder: { include: { elderProfile: true } } }
  })

  let firedTasksCount = 0

  for (const task of allTasks) {
    if (!task.time) continue

    let taskFreq = task.frequency
    if (!taskFreq || taskFreq.toUpperCase() === "DAILY" || taskFreq.toUpperCase() === "WEEKLY" || taskFreq.toUpperCase() === "ONCE") {
      taskFreq = "0,1,2,3,4,5,6"
    }
    if (!taskFreq.includes(dayOfWeek) && !forceAll) continue

    const taskMinutes = parseTimeToMinutes(task.time)
    if (taskMinutes === null) continue

    const diff = currentTotalMinutes - taskMinutes
    const isDue = forceAll || (diff >= 0 && diff <= 6)
    if (!isDue) continue

    firedTasksCount++
    try {
      if (task.triggerAlarm) {
        await sendPushNotification(task.elderId, {
          type: "ALARM",
          actionText: "Complete task",
          label: `Task: ${task.title}`,
          body: task.description || "Important task scheduled for now.",
          snoozeText: task.elder.alarmSnoozeText || "Do later",
          snoozeDuration: (task.elder.alarmSnoozeDuration || 10).toString(),
          elderId: task.elderId,
          stickyNotification: task.elder.elderProfile?.stickyAlarmNotification !== false ? "true" : "false"
        })
      } else {
        await sendPushNotification(task.elderId, {
          title: `Task Due: ${task.title}`,
          body: task.description || "It is time for your scheduled task.",
          url: "/elder/tasks"
        })
      }
    } catch (err) {
      console.error(`[CronRunner] Push error for task ${task.title}:`, err)
    }
  }

  return {
    istTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    firedMedsCount,
    firedTasksCount,
    totalScheduled: firedMedsCount + firedTasksCount,
    details
  }
}
