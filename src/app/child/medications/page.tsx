import { AddMedicineForm } from "./AddMedicineForm"
import { MedicineRow } from "./MedicineRow"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { resolveCompactNoticeAudioUrl } from "@/lib/alarmSync"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function ChildMedications() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  // Get the first linked elder
  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
    return (
      <div className="min-h-screen p-6 flex justify-center items-center">
        <p className="text-gray-500 font-bold">Please link an elder account first.</p>
      </div>
    )
  }

  const rawMedications = await prisma.medication.findMany({
    where: { elderId: relationship.elderId },
    orderBy: { createdAt: "desc" }
  })

  // Keep RSC payload lightweight by serving stored audio via API URL
  const medications = rawMedications.map(m => ({
    ...m,
    specialNoticeAudioUrl: m.specialNoticeAudioUrl
      ? resolveCompactNoticeAudioUrl(m.id, m.specialNoticeAudioUrl, m.specialNoticeVersion, false) || null
      : null
  }))

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/child/dashboard" 
            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medications</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage {relationship.elder.name}&apos;s daily prescriptions.</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
           <AddMedicineForm elderId={relationship.elderId} />
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {medications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <span className="text-2xl">💊</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active medications</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">Add a prescription to track adherence and send reminders to your care recipient.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-xs">
                <tr>
                  <th className="p-4 px-6">Name</th>
                  <th className="p-4 px-6">Dosage</th>
                  <th className="p-4 px-6">Time</th>
                  <th className="p-4 px-6">Frequency</th>
                  <th className="p-4 px-6">Course Duration</th>
                  <th className="p-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medications.map(med => (
                  <MedicineRow key={med.id} med={med} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
