import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"

export const dynamic = 'force-dynamic'
import { redirect } from "next/navigation"
import { GlobalNotice } from "@/components/GlobalNotice"
import { HealthCharts } from "@/components/HealthCharts"
import { AiInsights } from "@/components/AiInsights"
import { AcknowledgeEmergencyButton } from "@/components/AcknowledgeEmergencyButton"
import { LinkParentButton } from "./LinkParentButton"
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Scale, 
  Droplets,
  AlertCircle
} from "lucide-react"

export default async function ChildDashboard() {
  const session = await auth()

  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationships = await prisma.caregiverRelationship.findMany({
    where: { childId: session.user.id },
    include: { elder: { include: { elderProfile: true } } }
  })

  const activeRelationship = await getActiveElder(session.user.id)

  const elderData = await Promise.all(
    relationships.filter(r => r.status === "ACTIVE").map(async (rel) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(today.getDate() - 30)

      const allMeasurements = await prisma.healthMeasurement.findMany({
        where: { elderId: rel.elderId },
        orderBy: { timestamp: 'desc' },
      })
      
      const latestMeasurements = allMeasurements.filter(m => m.timestamp >= today)

      const medications = await prisma.medication.findMany({
        where: { elderId: rel.elderId },
        include: {
          logs: {
            where: { timestamp: { gte: today } }
          }
        }
      })

      const emergency = await prisma.emergencyEvent.findFirst({
        where: { elderId: rel.elderId, status: "ACTIVE" },
        orderBy: { timestamp: 'desc' }
      })

      const recentActivity = await prisma.healthMeasurement.findMany({
        where: { elderId: rel.elderId },
        orderBy: { timestamp: 'desc' },
        take: 5
      })

      const nowMs = Date.now()
      const activeMeds = medications.filter(m => !m.endDate || new Date(m.endDate).getTime() >= nowMs)
      const totalMeds = activeMeds.length
      const takenMeds = activeMeds.filter(m => m.logs.some(l => l.status === "TAKEN")).length

      const bp = latestMeasurements.find(m => m.type === "BP")
      const sugar = latestMeasurements.find(m => m.type === "SUGAR")
      const spo2 = latestMeasurements.find(m => m.type === "SPO2")
      const pulse = latestMeasurements.find(m => m.type === "PULSE")
      const temp = latestMeasurements.find(m => m.type === "TEMP")
      const weight = latestMeasurements.find(m => m.type === "WEIGHT")
      
      const requiredDays = rel.elder.elderProfile?.vitalCheckDays || "0,1,2,3,4,5,6"
      const isCheckRequiredToday = requiredDays.includes(today.getDay().toString())

      return {
        relationship: rel,
        allMeasurements,
        bp: bp?.value || "--",
        sugar: sugar?.value || "--",
        spo2: spo2?.value || "--",
        pulse: pulse?.value || "--",
        temp: temp?.value || "--",
        weight: weight?.value || "--",
        totalMeds,
        takenMeds,
        healthCheckDone: latestMeasurements.length > 0,
        isCheckRequiredToday,
        emergency,
        requiredVitals: rel.elder.elderProfile?.requiredVitals || "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT"
      }
    })
  )

  return (
    <div className="space-y-6">
      <GlobalNotice />

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good morning, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here is the latest health overview for your care recipients.</p>
        </div>
        {relationships.length > 0 && (
          <div className="hidden md:block">
            <LinkParentButton variant="small" />
          </div>
        )}
      </div>

      {relationships.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Connect Your Family</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">
            Connect with your elderly parents to monitor their real-time health data, medications, and tasks securely.
          </p>
          <LinkParentButton variant="large" />
        </div>
      ) : (
        <div className="space-y-8">
          {elderData.map(({ relationship: rel, allMeasurements, bp, sugar, spo2, pulse, temp, weight, totalMeds, takenMeds, healthCheckDone, isCheckRequiredToday, emergency, requiredVitals }) => (
            <div key={rel.id} className="space-y-6">
              
              {/* Emergency Banner */}
              {emergency && (
                <div className="bg-red-50 border-l-4 border-red-600 p-5 rounded-r-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-pulse-slow">
                  <div className="flex gap-4">
                    <div className="p-2 bg-red-100 rounded-full h-fit">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-900 tracking-tight">SOS Triggered</h3>
                      <p className="text-sm text-red-800 mt-1">
                        {rel.elder.name} needs immediate assistance!
                        {emergency.latitude && emergency.longitude 
                          ? ` Location: ${emergency.latitude.toFixed(4)}, ${emergency.longitude.toFixed(4)}` 
                          : " Location unavailable."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <AcknowledgeEmergencyButton emergencyId={emergency.id} />
                    {emergency.latitude && emergency.longitude && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${emergency.latitude},${emergency.longitude}`}
                        target="_blank"
                        className="bg-white border border-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-50 transition text-sm flex items-center justify-center whitespace-nowrap shadow-sm"
                      >
                        Open Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Status Header */}
              {rel.status === "PENDING" ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Connection Pending</h4>
                    <p className="text-xs text-amber-800">Waiting for {rel.elder.name} to accept your request.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 p-5 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        Today's Vitals
                      </h3>
                      <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                        {healthCheckDone ? "? Updated Today" : (!isCheckRequiredToday ? "? Rest Day" : "? Awaiting Update")}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      
                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blood Pressure</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{bp}</span>
                          {bp !== "—" && <span className="text-xs text-slate-500 font-medium">mmHg</span>}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Droplets className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sugar</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{sugar}</span>
                          {sugar !== "—" && <span className="text-xs text-slate-500 font-medium">mg/dL</span>}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-cyan-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SpO2</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{spo2}</span>
                          {spo2 !== "—" && <span className="text-xs text-slate-500 font-medium">%</span>}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="w-4 h-4 text-rose-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pulse</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{pulse}</span>
                          {pulse !== "—" && <span className="text-xs text-slate-500 font-medium">bpm</span>}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Thermometer className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temp</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{temp}</span>
                          {temp !== "—" && <span className="text-xs text-slate-500 font-medium">°F</span>}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Scale className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900 tracking-tight">{weight}</span>
                          {weight !== "—" && <span className="text-xs text-slate-500 font-medium">kg</span>}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* AI & Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 flex flex-col">
                      <div className="flex-1 min-h-0">
                        <AiInsights elderId={rel.elderId} />
                      </div>
                      
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 p-5 shrink-0">
                        <h4 className="text-sm font-bold text-slate-900 mb-4">Medication Adherence</h4>
                        <div className="flex items-end gap-3 mb-2">
                          <span className="text-3xl font-black tracking-tight text-slate-900">
                            {totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0}%
                          </span>
                          <span className="text-sm font-medium text-slate-500 mb-1">{takenMeds} of {totalMeds} taken today</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all" 
                            style={{ width: `${totalMeds > 0 ? (takenMeds / totalMeds) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="lg:col-span-2">
                      <HealthCharts 
                        measurements={allMeasurements} 
                        variant="child" 
                        requiredVitals={requiredVitals}
                      />
                    </div>
                  </div>

                  {/* Recent Activity Timeline */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 p-5 bg-slate-50/50">
                      <h3 className="font-bold text-slate-900 text-base">Recent Activity</h3>
                    </div>
                    <div className="p-5">
                      <div className="relative border-l border-slate-200 ml-3 space-y-6">
                        {allMeasurements.slice(0, 2).map((m, i) => (
                          <div key={`m-${i}`} className="relative pl-6">
                            <span className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></span>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Health check completed</p>
                                <p className="text-xs text-slate-500">Recorded {m.type} as {m.value} {m.unit}</p>
                              </div>
                              <span className="text-xs font-medium text-slate-400">
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {emergency && (
                          <div className="relative pl-6">
                            <span className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-red-500 ring-4 ring-white"></span>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-red-600">SOS Triggered</p>
                                <p className="text-xs text-slate-500">Emergency escalation initiated</p>
                              </div>
                              <span className="text-xs font-medium text-slate-400">
                                {emergency.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )}
                        {!emergency && allMeasurements.length === 0 && (
                          <p className="text-sm text-slate-500 ml-6">No recent activity.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

