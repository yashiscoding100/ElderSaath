import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AddVitalsModal } from "./AddVitalsModal"

export default async function ChildHealthHistory() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
    return (
      <div className="min-h-screen p-6 flex justify-center items-center">
        <p className="text-gray-500 font-bold">Please link an elder account first.</p>
      </div>
    )
  }

  const measurements = await prisma.healthMeasurement.findMany({
    where: { elderId: relationship.elderId },
    orderBy: { timestamp: 'desc' },
  })

  // Group by date
  const grouped = measurements.reduce((acc, curr) => {
    const date = curr.timestamp.toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(curr)
    return acc
  }, {} as Record<string, typeof measurements>)

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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health History Timeline</h1>
            <p className="text-sm text-slate-500 mt-0.5">Historical records for {relationship.elder.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AddVitalsModal elderId={relationship.elderId} />
        </div>
      </header>

      <div className="space-y-6">
        {Object.keys(grouped).length === 0 ? (
           <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200 flex flex-col items-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
               <span className="text-2xl">📉</span>
             </div>
             <h3 className="text-lg font-bold text-slate-900">No health records found</h3>
             <p className="text-slate-500 text-sm mt-1">Add vitals to begin tracking health history.</p>
           </div>
        ) : (
          Object.entries(grouped).map(([date, records]) => (
            <div key={date} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-500 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">{date}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {records.map(record => (
                  <div key={record.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center group hover:bg-slate-100 transition">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{record.type}</p>
                      <p className="font-black text-slate-900 text-2xl tracking-tight">{record.value} <span className="text-sm font-semibold text-slate-400">{record.unit}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
