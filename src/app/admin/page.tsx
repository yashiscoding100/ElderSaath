import { prisma } from "@/lib/prisma"
import { DatabaseCleanupCard } from "./DatabaseCleanupCard"

export default async function AdminDashboard() {
  let userCount = 0
  let elderCount = 0
  let childCount = 0
  let connectionCount = 0
  let noticeCount = 0
  let documentCount = 0
  let notificationCount = 0

  try {
    userCount = await prisma.user.count()
    elderCount = await prisma.user.count({ where: { role: "ELDER" } })
    childCount = await prisma.user.count({ where: { role: "CHILD" } })
    connectionCount = await prisma.caregiverRelationship.count({ where: { status: "ACTIVE" } })
    noticeCount = await prisma.notice.count({ where: { isActive: true } })
    documentCount = await prisma.medicalDocument.count()
    notificationCount = await prisma.appNotification.count()
  } catch (err) {
    console.error("Admin dashboard database fetch error (e.g. quota limit):", err)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Platform Overview</h2>
        <p className="text-slate-500 mt-2">Real-time statistics for ElderSaath.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Users</p>
          <p className="text-4xl font-black text-slate-900">{userCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Elders</p>
          <p className="text-4xl font-black text-blue-600">{elderCount}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Family Members</p>
          <p className="text-4xl font-black text-emerald-600">{childCount}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Active Connections</p>
          <p className="text-4xl font-black text-purple-600">{connectionCount}</p>
        </div>
      </div>

      <DatabaseCleanupCard 
        documentCount={documentCount} 
        notificationCount={notificationCount} 
      />

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-900 mb-4">System Status</h3>
        <div className="flex items-center gap-3">
          <span className="flex w-3 h-3 rounded-full bg-emerald-500"></span>
          <p className="text-slate-700 font-medium">All systems operational.</p>
        </div>
        <p className="text-slate-500 mt-4">There are currently {noticeCount} active global notices being broadcasted to all users.</p>
      </div>
    </div>
  )
}

