import { prisma } from "@/lib/prisma"
import { UserManagementClient, ManagedUserItem } from "./UserManagementClient"

export const dynamic = "force-dynamic"

export default async function AdminUserManagementPage() {
  let users: ManagedUserItem[] = []

  try {
    const rawUsers = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        blockMessage: true,
        notifyVitals: true,
        notifySnooze: true,
        sosEnabled: true,
        canManageMeds: true,
        alarmSnoozeText: true,
        alarmSnoozeDuration: true,
        autoSnoozeEnabled: true,
        autoSnoozeAfterSeconds: true,
        createdAt: true,
        elderProfile: {
          select: {
            stickyAlarmNotification: true
          }
        },
        caregivers: {
          where: { status: "ACTIVE" },
          select: {
            child: {
              select: { name: true, email: true }
            }
          }
        },
        eldersCaredFor: {
          where: { status: "ACTIVE" },
          select: {
            elder: {
              select: { name: true, email: true }
            }
          }
        }
      }
    })

    users = rawUsers.map((u) => {
      const linkedNames =
        u.role === "ELDER"
          ? u.caregivers.map((c) => c.child.name || c.child.email || "Caregiver")
          : u.eldersCaredFor.map((e) => e.elder.name || e.elder.email || "Elder")

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isBlocked: Boolean(u.isBlocked),
        blockMessage: u.blockMessage || "",
        notifyVitals: Boolean(u.notifyVitals),
        notifySnooze: Boolean(u.notifySnooze),
        sosEnabled: Boolean(u.sosEnabled),
        canManageMeds: Boolean(u.canManageMeds),
        alarmSnoozeText: u.alarmSnoozeText || "Take later",
        alarmSnoozeDuration: u.alarmSnoozeDuration ?? 10,
        autoSnoozeEnabled: Boolean(u.autoSnoozeEnabled),
        autoSnoozeAfterSeconds: Math.max(5, u.autoSnoozeAfterSeconds ?? 60),
        stickyAlarmNotification: u.elderProfile?.stickyAlarmNotification !== false,
        linkedNames,
        createdAt: u.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error("AdminUserManagementPage error:", error)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">User Management</h2>
        <p className="text-slate-500 mt-2">
          Enable or disable Auto-Snooze, set per-account trigger timers, and configure alarm, SOS, and notification settings. Alarm preferences sync directly to each device&apos;s phone memory.
        </p>
      </header>

      <UserManagementClient initialUsers={users} />
    </div>
  )
}
