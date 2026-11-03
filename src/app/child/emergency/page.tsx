import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'
import { redirect } from "next/navigation"
import { AcknowledgeEmergencyButton } from "@/components/AcknowledgeEmergencyButton"
import { 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Activity,
  Pill,
  PhoneCall
} from "lucide-react"

export default async function EmergencyCenter() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationships = await prisma.caregiverRelationship.findMany({
    where: { childId: session.user.id, status: "ACTIVE" },
    include: { elder: true },
  })

  if (relationships.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        Please link an elder account first to view the emergency center.
      </div>
    )
  }

  // Find any active emergency for any linked elder
  const activeEmergencies = await Promise.all(relationships.map(async (rel) => {
    const emergency = await prisma.emergencyEvent.findFirst({
      where: { elderId: rel.elderId, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      orderBy: { timestamp: 'desc' }
    })

    if (!emergency) return null

    const recentVitals = await prisma.healthMeasurement.findMany({
      where: { elderId: rel.elderId },
      orderBy: { timestamp: 'desc' },
      take: 4
    })

    const medications = await prisma.medication.findMany({
      where: { elderId: rel.elderId }
    })

    const contacts = await prisma.emergencyContact.findMany({
      where: { elderId: rel.elderId }
    })

    const profile = await prisma.elderProfile.findUnique({
      where: { userId: rel.elderId }
    })

    return {
      emergency,
      elder: rel.elder,
      profile,
      recentVitals,
      medications,
      contacts
    }
  }))

  const emergencies = activeEmergencies.filter(Boolean) as NonNullable<typeof activeEmergencies[0]>[]

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Emergency Center</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor SOS alerts and manage crisis response.</p>
        </div>
      </header>

      {emergencies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Active Emergencies</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            All systems are quiet. Your care recipients are currently safe.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {emergencies.map(({ emergency, elder, profile, recentVitals, medications, contacts }) => (
            <div key={emergency.id} className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="bg-red-50 p-6 border-b border-red-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-red-900 tracking-tight">SOS Triggered: {elder.name}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm font-medium text-red-700">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(emergency.timestamp).toLocaleTimeString()}
                      </span>
                      
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        emergency.escalationLevel === 3 ? 'bg-red-800 text-white animate-pulse' :
                        emergency.escalationLevel === 2 ? 'bg-red-600 text-white' :
                        'bg-red-200 text-red-900'
                      }`}>
                        Escalation Level: {emergency.escalationLevel}
                      </span>

                      {emergency.latitude && emergency.longitude && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Location Recorded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <AcknowledgeEmergencyButton emergencyId={emergency.id} />
                  {emergency.latitude && emergency.longitude && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${emergency.latitude},${emergency.longitude}`}
                      target="_blank"
                      className="bg-white text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-50 transition border border-slate-300 text-sm text-center flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      <MapPin className="w-4 h-4" />
                      Open Maps
                    </a>
                  )}
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Info Column */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-400" /> Recent Vitals
                    </h4>
                    {recentVitals.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {recentVitals.map(v => (
                          <div key={v.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">{v.type}</span>
                            <span className="font-bold text-slate-900 text-lg">{v.value}</span> <span className="text-xs text-slate-400">{v.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No recent vitals found.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-slate-400" /> Active Medications
                    </h4>
                    {medications.length > 0 ? (
                      <ul className="space-y-2">
                        {medications.map(m => (
                          <li key={m.id} className="text-sm font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-md border border-slate-100 flex justify-between">
                            <span>{m.name}</span>
                            <span className="text-slate-500">{m.dosage}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No active medications.</p>
                    )}
                  </div>

                  {profile && (profile.bloodGroup || profile.allergies || profile.medicalConditions) && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-800">
                        🚨 Emergency Medical ID
                      </h4>
                      {profile.bloodGroup && (
                        <div className="text-xs text-slate-700 flex justify-between">
                          <span className="font-semibold text-slate-500">Blood Group:</span>
                          <span className="font-bold text-red-700">{profile.bloodGroup}</span>
                        </div>
                      )}
                      {profile.allergies && (
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-500 block">Allergies:</span>
                          <span className="font-bold text-slate-900">{profile.allergies}</span>
                        </div>
                      )}
                      {profile.medicalConditions && (
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-500 block">Conditions:</span>
                          <span className="font-bold text-slate-900">{profile.medicalConditions}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Column */}
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-slate-400" /> Escalation Status
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                        <span className="font-bold text-slate-900 text-sm">Level 1: Primary Caregivers</span>
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">NOTIFIED</span>
                      </div>
                      <div className="p-4 border-b border-slate-200 flex justify-between items-center opacity-50">
                        <span className="font-bold text-slate-900 text-sm">Level 2: Secondary Contacts</span>
                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">PENDING ({10}m)</span>
                      </div>
                      <div className="p-4 flex justify-between items-center opacity-50">
                        <span className="font-bold text-slate-900 text-sm">Level 3: Local Emergency Services</span>
                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">MANUAL OVERRIDE ONLY</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-slate-400" /> Next Steps
                    </h4>
                    <p className="text-sm text-slate-700 bg-amber-50 p-4 rounded-lg border border-amber-200 font-medium">
                      If you cannot reach {elder.name}, consider dispatching local emergency services using the coordinates provided in the map link. Once the situation is stable, please click 'Acknowledge & Resolve'.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
