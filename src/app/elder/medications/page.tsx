import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ElderAddMedicationForm } from "./ElderAddMedicationForm"
import { MarkTakenButton } from "./MarkTakenButton"
import { ElderDeleteMedicationButton } from "./ElderDeleteMedicationButton"
import { MedicationsPageRefresher } from "./MedicationsPageRefresher"
import { checkAndNotifyExpiredMedications, formatDurationSummary, isMedicationExpired } from "@/lib/medicationDuration"

export default async function ElderMedications() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  // Trigger checks for any medications whose duration ended
  await checkAndNotifyExpiredMedications(session.user.id)

  const userProfile = await prisma.user.findUnique({ where: { id: session.user.id } })
  const canManageMeds = userProfile?.canManageMeds || false

  const medications = await prisma.medication.findMany({
    where: { elderId: session.user.id },
    orderBy: { time: 'asc' },
    include: {
      logs: {
        where: {
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }
    }
  })

  const activeMedications = medications.filter(m => !isMedicationExpired(m.endDate))
  const takenToday = activeMedications.filter(m => m.logs.some(l => l.status === "TAKEN")).length
  const total = activeMedications.length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <MedicationsPageRefresher />
      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-sm mb-6 text-center relative">
        <Link href="/elder/home" className="absolute left-4 top-4 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700 shadow-sm" title="Back to Home">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Today's Medicines</h1>
        {total > 0 && (
          <p className="text-lg text-gray-500 mt-2">{takenToday}/{total} active completed</p>
        )}
      </div>

      <div className="w-full max-w-md">
        {canManageMeds && <ElderAddMedicationForm />}
      </div>

      <div className="w-full max-w-md space-y-4 flex-1">
        {medications.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
             <p className="text-xl text-gray-600">No medicines scheduled.</p>
             {canManageMeds && <p className="text-gray-400 mt-2">Add your medicines above.</p>}
          </div>
        ) : (
          medications.map(med => {
            const isTaken = med.logs.some(l => l.status === "TAKEN")
            const expired = isMedicationExpired(med.endDate)
            const durationSummary = formatDurationSummary(med.durationValue, med.durationUnit, med.endDate)

            return (
              <div 
                key={med.id} 
                className={`p-6 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${
                  isTaken 
                    ? 'bg-green-50 border-green-200' 
                    : expired 
                    ? 'bg-amber-50/70 border-amber-200' 
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="pr-2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold text-sm">
                      {med.time}
                    </span>
                    {expired ? (
                      <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-xs">
                        Course Finished • Alarm Off
                      </span>
                    ) : durationSummary ? (
                      <span className="inline-block px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-full font-medium text-xs">
                        📅 {durationSummary}
                      </span>
                    ) : null}
                  </div>

                  {canManageMeds && (
                    <div className="mb-2">
                      <ElderDeleteMedicationButton medicationId={med.id} medicationName={med.name} />
                    </div>
                  )}

                  <h2 className={`text-2xl font-bold ${isTaken ? 'text-green-800 line-through' : expired ? 'text-slate-600' : 'text-gray-900'}`}>
                    {med.name}
                  </h2>
                  <p className="text-lg text-gray-600">{med.dosage}</p>
                  {med.instructions && (
                    <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>
                  )}

                  {expired && (
                    <div className="text-xs text-amber-900 font-medium bg-amber-100/90 border border-amber-200 rounded-lg p-2 mt-2">
                      Prescribed course ended. Daily alarms are now stopped. Please consult your doctor for next steps.
                    </div>
                  )}
                </div>

                {isTaken ? (
                  <div className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center text-3xl text-green-600 shrink-0">✓</div>
                ) : expired ? (
                  <div className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold text-center shrink-0">
                    Course<br />Finished
                  </div>
                ) : (
                  <div className="shrink-0">
                    <MarkTakenButton medicationId={med.id} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      
      <div className="w-full max-w-md pt-6">
        <a href="/elder/home" className="block w-full py-4 text-center bg-gray-200 text-gray-800 font-bold rounded-2xl text-xl hover:bg-gray-300 transition-colors">
          Back Home
        </a>
      </div>
    </div>
  )
}
