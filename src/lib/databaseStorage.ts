import { prisma } from "@/lib/prisma"

export interface StorageCategory {
  id: string
  name: string
  table: string
  count: number
  bytes: number
  formattedSize: string
  percentageOfUsed: number
  color: string
  icon: string
  description: string
}

export interface DatabaseStorageStats {
  quotaBytes: number
  quotaFormatted: string
  usedBytes: number
  usedFormatted: string
  freeBytes: number
  freeFormatted: string
  usedPercentage: number
  freePercentage: number
  status: "HEALTHY" | "WARNING" | "CRITICAL"
  largestConsumer: StorageCategory
  categories: StorageCategory[]
  estimatedPhotosLeft: number
  isRealPostgresQuery: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  const kb = bytes / 1024
  if (kb < 1024) return kb.toFixed(1) + " KB"
  const mb = kb / 1024
  if (mb < 1024) return mb.toFixed(2) + " MB"
  const gb = mb / 1024
  return gb.toFixed(2) + " GB"
}

export async function getDatabaseStorageStats(): Promise<DatabaseStorageStats> {
  const TOTAL_QUOTA_BYTES = 500 * 1024 * 1024 // 500 MB Supabase Free Tier limit
  const BASE_ENGINE_OVERHEAD_BYTES = 14.5 * 1024 * 1024 // ~14.5 MB for PostgreSQL system schemas & indexes

  let isRealPostgres = false
  let realDbBytes: number | null = null

  try {
    const rawResult: any = await prisma.$queryRawUnsafe(
      "SELECT pg_database_size(current_database()) as bytes;"
    )
    if (rawResult && rawResult[0]?.bytes) {
      realDbBytes = Number(rawResult[0].bytes)
      isRealPostgres = true
    }
  } catch {
    // SQLite or restricted query permissions
    isRealPostgres = false
  }

  // 1. Fetch record counts and payload sizes
  let docCount = 0
  let docFileBytes = 0
  let notificationCount = 0
  let medCount = 0
  let medLogCount = 0
  let taskCount = 0
  let taskLogCount = 0
  let userCount = 0
  let relationshipCount = 0
  let noticeCount = 0
  let noticeBytes = 0

  try {
    const [
      docs,
      notifications,
      medications,
      medLogs,
      tasks,
      taskLogs,
      users,
      relationships,
      notices
    ] = await Promise.all([
      prisma.medicalDocument.findMany({ select: { fileUrl: true } }),
      prisma.appNotification.count(),
      prisma.medication.count(),
      prisma.medicationLog.count(),
      prisma.task.count(),
      prisma.taskLog.count(),
      prisma.user.count(),
      prisma.caregiverRelationship.count(),
      prisma.notice.findMany({ select: { content: true } })
    ])

    docCount = docs.length
    docFileBytes = docs.reduce((sum, d) => sum + (d.fileUrl ? d.fileUrl.length : 0), 0)
    notificationCount = notifications
    medCount = medications
    medLogCount = medLogs
    taskCount = tasks
    taskLogCount = taskLogs
    userCount = users
    relationshipCount = relationships
    noticeCount = notices.length
    noticeBytes = notices.reduce((sum, n) => sum + (n.content ? n.content.length : 0), 0)
  } catch (err) {
    console.error("Storage stats query error:", err)
  }

  // Calculate estimated bytes per category
  // Document storage includes the raw base64 or blob URL plus record rows (~500 B each)
  const docBytes = docFileBytes + docCount * 600
  const notifBytes = notificationCount * 450
  const medTotalBytes = medCount * 400 + medLogCount * 220
  const taskTotalBytes = taskCount * 400 + taskLogCount * 220
  const userTotalBytes = userCount * 1200 + relationshipCount * 300
  const systemBytes = noticeBytes + noticeCount * 500 + BASE_ENGINE_OVERHEAD_BYTES

  const computedTotalBytes = docBytes + notifBytes + medTotalBytes + taskTotalBytes + userTotalBytes + systemBytes
  const usedBytes = realDbBytes && realDbBytes > computedTotalBytes ? realDbBytes : computedTotalBytes
  const freeBytes = Math.max(0, TOTAL_QUOTA_BYTES - usedBytes)
  const usedPercentage = Math.min(100, Number(((usedBytes / TOTAL_QUOTA_BYTES) * 100).toFixed(1)))
  const freePercentage = Math.max(0, Number((100 - usedPercentage).toFixed(1)))

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY"
  if (usedPercentage >= 85) status = "CRITICAL"
  else if (usedPercentage >= 65) status = "WARNING"

  // Average compressed prescription photo is ~280 KB
  const estimatedPhotosLeft = Math.floor(freeBytes / (300 * 1024))

  const categories: StorageCategory[] = [
    {
      id: "prescriptions",
      name: "Prescriptions & Medical Files",
      table: "MedicalDocument",
      count: docCount,
      bytes: docBytes,
      formattedSize: formatBytes(docBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((docBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-purple-500",
      icon: "💊",
      description: "Scanned prescriptions, consultation slips, and lab attachments."
    },
    {
      id: "notifications",
      name: "Alerts & Notifications",
      table: "AppNotification",
      count: notificationCount,
      bytes: notifBytes,
      formattedSize: formatBytes(notifBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((notifBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-amber-500",
      icon: "🔔",
      description: "In-app bell alerts, SOS logs, and adherence notifications."
    },
    {
      id: "medications",
      name: "Medications & Dose Logs",
      table: "Medication & Log",
      count: medCount + medLogCount,
      bytes: medTotalBytes,
      formattedSize: formatBytes(medTotalBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((medTotalBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-blue-500",
      icon: "⏰",
      description: "Scheduled daily pills, dosage times, and 'TAKEN' timestamps."
    },
    {
      id: "tasks",
      name: "Things To Do & Chores",
      table: "Task & Log",
      count: taskCount + taskLogCount,
      bytes: taskTotalBytes,
      formattedSize: formatBytes(taskTotalBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((taskTotalBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-emerald-500",
      icon: "📋",
      description: "Daily chores, routine tasks, and completion checkmarks."
    },
    {
      id: "users",
      name: "User Profiles & Family Links",
      table: "User & CaregiverRelationship",
      count: userCount + relationshipCount,
      bytes: userTotalBytes,
      formattedSize: formatBytes(userTotalBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((userTotalBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-cyan-500",
      icon: "👥",
      description: "Elder profiles, family member credentials, and caregiver connections."
    },
    {
      id: "system",
      name: "System Overhead & Engine Indexes",
      table: "PostgreSQL Engine & Notice",
      count: noticeCount,
      bytes: systemBytes,
      formattedSize: formatBytes(systemBytes),
      percentageOfUsed: usedBytes > 0 ? Number(((systemBytes / usedBytes) * 100).toFixed(1)) : 0,
      color: "bg-slate-400",
      icon: "⚙️",
      description: "PostgreSQL B-Tree indexes, WAL, and alarm tone configurations."
    }
  ]

  // Sort categories by bytes descending to find largest consumer
  const sorted = [...categories].sort((a, b) => b.bytes - a.bytes)
  const largestConsumer = sorted[0]

  return {
    quotaBytes: TOTAL_QUOTA_BYTES,
    quotaFormatted: "500.00 MB",
    usedBytes,
    usedFormatted: formatBytes(usedBytes),
    freeBytes,
    freeFormatted: formatBytes(freeBytes),
    usedPercentage,
    freePercentage,
    status,
    largestConsumer,
    categories,
    estimatedPhotosLeft,
    isRealPostgresQuery: isRealPostgres
  }
}
