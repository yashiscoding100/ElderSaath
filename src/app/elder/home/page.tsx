import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { LogoutButton } from "@/components/LogoutButton"
import { Settings } from "lucide-react"
import Link from "next/link"
import { TestAlarmButton } from "./TestAlarmButton"
import { PendingConnections } from "./PendingConnections"
import { GlobalNotice } from "@/components/GlobalNotice"
import { HealthCharts } from "@/components/HealthCharts"
import { MedicalProfileCard } from "@/components/MedicalProfileCard"
import { Heart, Droplets, Activity } from "lucide-react"
import { PushSubscriptionManager } from "@/components/PushSubscriptionManager"

export default async function ElderHome() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  // Get today's data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const profile = await prisma.elderProfile.findUnique({
    where: { userId: session.user.id }
  })
  const requiredVitals = profile?.requiredVitals || "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT"
  const requiredDays = profile?.vitalCheckDays || "0,1,2,3,4,5,6"
  const isCheckRequiredToday = requiredDays.includes(today.getDay().toString())

  const allMeasurements = await prisma.healthMeasurement.findMany({
    where: { elderId: session.user.id },
    orderBy: { timestamp: 'desc' },
  })
  
  const todayMeasurements = allMeasurements.filter(m => m.timestamp >= today)

  const medications = await prisma.medication.findMany({
    where: { elderId: session.user.id },
    include: {
      logs: {
        where: { timestamp: { gte: today } }
      }
    }
  })

  // Get pending connection requests
  const pendingRequests = await prisma.caregiverRelationship.findMany({
    where: { elderId: session.user.id, status: "PENDING" },
    include: { child: { select: { name: true, email: true } } }
  })

  const totalMeds = medications.length
  const takenMeds = medications.filter(m => m.logs.some(l => l.status === "TAKEN")).length
  const healthCheckDone = todayMeasurements.length > 0
  const showHealthCheckAsDone = healthCheckDone || !isCheckRequiredToday

  const bp = todayMeasurements.find(m => m.type === "BP")?.value || "--"
  const sugar = todayMeasurements.find(m => m.type === "SUGAR")?.value || "--"
  const spo2 = todayMeasurements.find(m => m.type === "SPO2")?.value || "--"
  const pulse = todayMeasurements.find(m => m.type === "PULSE")?.value || "--"
  const temp = todayMeasurements.find(m => m.type === "TEMP")?.value || "--"
  const weight = todayMeasurements.find(m => m.type === "WEIGHT")?.value || "--"


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-8">
      {/* Premium Header */}
      <div className="w-full bg-white shadow-sm border-b border-slate-200 mb-6">
        <div className="max-w-4xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hello, {session.user.name?.split(" ")[0]}!</h1>
            <p className="text-slate-500 font-medium mt-1">Here is your daily care schedule.</p>
          </div>
          <div className="flex items-center gap-4">
            <PushSubscriptionManager />
            <Link href="/elder/settings" className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700">
              <Settings className="w-5 h-5" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl px-6 space-y-6 flex-1">
        
        <GlobalNotice />
        <PendingConnections requests={pendingRequests} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health Check - Main Action Button */}
          <a href="/elder/checkin" className={`block w-full rounded-2xl p-6 text-left transition-all transform hover:-translate-y-1 shadow-sm border flex flex-col justify-between h-full ${
            showHealthCheckAsDone 
                ? 'bg-emerald-50 border-emerald-200 hover:shadow-emerald-100' 
                : 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700 hover:shadow-blue-200'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${showHealthCheckAsDone ? 'bg-emerald-100' : 'bg-blue-500'}`}>
                🩺
              </div>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${showHealthCheckAsDone ? 'text-emerald-800' : 'text-white'}`}>Health Check</h2>
              <p className={`text-sm font-medium mt-1 ${showHealthCheckAsDone ? 'text-emerald-600' : 'text-blue-100'}`}>
                {healthCheckDone ? '? Completed today' : (!isCheckRequiredToday ? 'Rest day, no check needed' : 'Tap here to record vitals')}
              </p>
            </div>
          </a>

          {/* Medicines */}
          <a href="/elder/medications" className="block w-full bg-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 flex flex-col justify-between border border-slate-200 h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-2xl">
                💊
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Medicines</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {totalMeds > 0 ? `${takenMeds} out of ${totalMeds} taken` : 'No medicines today'}
              </p>
            </div>
          </a>

          {/* Wellbeing */}
          <a href="/elder/tasks" className="block w-full bg-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 flex flex-col justify-between border border-slate-200 h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-2xl">
                🌸
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your Wellbeing</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">Gentle reminders & care notes</p>
            </div>
          </a>

          {/* Games */}
          <a href="/elder/games" className="block w-full bg-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 flex flex-col justify-between border border-slate-200 h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-2xl">
                🧩
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Brain Games</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">Keep your mind sharp</p>
            </div>
          </a>
        </div>

        {/* Today's Vitals Summary */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="border-b border-slate-100 p-5 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Today's Vitals
            </h3>
            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              {healthCheckDone ? "✅ Updated Today" : (!isCheckRequiredToday ? "✅ Rest Day" : "⚠️ Awaiting Update")}
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            <div className="p-4 flex flex-col justify-between text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Blood Pressure</span>
              <span className="text-xl font-black text-slate-800">{bp}</span>
            </div>
            <div className="p-4 flex flex-col justify-between text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Blood Sugar</span>
              <span className="text-xl font-black text-slate-800">{sugar}</span>
            </div>
            <div className="p-4 flex flex-col justify-between text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SpO2</span>
              <span className="text-xl font-black text-slate-800">{spo2}</span>
            </div>
          </div>
        </div>

        {/* Medication Adherence */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 mt-6 p-6">
          <h4 className="text-sm font-bold text-slate-900 mb-4">Today's Medication Adherence</h4>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">
              {totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0}%
            </span>
            <span className="text-sm font-medium text-slate-500 mb-1">{takenMeds} of {totalMeds} taken today</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div 
              className="bg-emerald-500 h-3 rounded-full transition-all" 
              style={{ width: (totalMeds > 0 ? (takenMeds / totalMeds) * 100 : 0) + '%' }}
            ></div>
          </div>
        </div>

        {/* Medical Profile */}
        <MedicalProfileCard initialProfile={profile} />

        <a href="/elder/team" className="mt-6 block w-full bg-slate-800 text-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 flex items-center justify-between border border-slate-700"><div><h2 className="text-xl font-bold">Helpers &amp; Team</h2><p className="text-sm font-medium text-slate-300 mt-1">Call maids, nurses, and drivers</p></div><div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">CALL</div></a>{/* Historical Health Trends */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <a href="/elder/health" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2.5">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Activity className="w-6 h-6" /></div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Health History</h2>
                <p className="text-xs text-slate-500 mt-0.5">Graphs & Vitals Table</p>
              </div>
            </a>
            <a href="/elder/documents" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2.5">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Prescriptions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Vault & Records</p>
              </div>
            </a>
            <a href="/elder/lab-reports" className="bg-emerald-50/80 rounded-2xl p-5 shadow-sm border border-emerald-300 hover:shadow-md hover:bg-emerald-100/60 transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform">??</div>
              <div>
                <h2 className="font-bold text-emerald-950 text-base">Test Reports</h2>
                <p className="text-xs text-emerald-700 font-semibold mt-0.5">Blood, ECG, Scans</p>
              </div>
            </a>
          </div>
      </div>
    </div>
  )
}
