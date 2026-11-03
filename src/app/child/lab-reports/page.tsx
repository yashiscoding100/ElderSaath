import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Files } from "lucide-react"
import { parseLabReport, isLabReport } from "@/lib/labReportUtils"
import { LabReportsClient } from "@/components/lab-reports/LabReportsClient"

export const dynamic = "force-dynamic"

export default async function ChildLabReportsPage() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
    return (
      <div className="min-h-[60vh] p-6 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-4">
          👨‍👩‍👧
        </div>
        <h2 className="text-xl font-bold text-slate-800">No Care Recipient Linked</h2>
        <p className="text-slate-500 text-sm mt-1">Please link a parent/elder account to view their lab & test reports.</p>
        <Link href="/child/dashboard" className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">
          Go to Dashboard
        </Link>
      </div>
    )
  }

  let allDocs: any[] = []
  try {
    allDocs = await prisma.medicalDocument.findMany({
      where: { elderId: relationship.elderId },
      orderBy: { uploadedAt: "desc" }
    })
  } catch (e) {
    console.error("Child lab reports fetch error:", e)
  }

  const labReports = allDocs
    .filter(doc => isLabReport(doc.title))
    .map(doc => parseLabReport(doc)!)
    .filter(Boolean)
    .sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""))

  const prescriptionCount = allDocs.filter(doc => !isLabReport(doc.title)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Lab & Diagnostic Test Reports
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage and view diagnostic records & lab test reports for {relationship.elder.name}
          </p>
        </div>

        {/* Tab Switcher: Prescriptions vs Test Reports */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center text-sm font-bold shadow-inner">
          <Link
            href="/child/documents"
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5"
          >
            <Files className="w-4 h-4 text-slate-500" />
            <span>Prescriptions ({prescriptionCount})</span>
          </Link>
          <div className="px-4 py-2 rounded-xl bg-white text-emerald-800 shadow-sm flex items-center gap-1.5">
            <span>🧪</span>
            <span>Test Reports ({labReports.length})</span>
          </div>
        </div>
      </header>

      {/* Main Lab Reports View */}
      <LabReportsClient
        initialReports={labReports}
        elderId={relationship.elderId}
        isElderView={false}
      />
    </div>
  )
}
