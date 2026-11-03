import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Files, ArrowLeft } from "lucide-react"
import { UploadDocumentForm } from "./UploadDocumentForm"
import { DocumentRow } from "./DocumentRow"
import { isLabReport } from "@/lib/labReportUtils"

export const dynamic = "force-dynamic"

export default async function ChildDocuments() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
    return (
      <div className="min-h-screen p-6 flex justify-center items-center">
        <p className="text-gray-500">Please link an elder account first.</p>
      </div>
    )
  }

  let documents: any[] = []
  try {
    documents = await prisma.medicalDocument.findMany({
      where: { elderId: relationship.elderId },
      orderBy: { uploadedAt: 'desc' }
    })
  } catch (e) {
    console.error("Child documents fetch error:", e)
  }

  const prescriptions = documents.filter(doc => !isLabReport(doc.title))
  const labReportsCount = documents.filter(doc => isLabReport(doc.title)).length

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/child/dashboard" 
            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💊</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Prescriptions Vault</h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Manage doctor prescriptions and records for {relationship.elder.name}</p>
          </div>
        </div>

        {/* Tab Switcher: Prescriptions vs Test Reports */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center text-sm font-bold shadow-inner">
            <div className="px-4 py-2 rounded-xl bg-white text-slate-900 shadow-sm flex items-center gap-1.5">
              <Files className="w-4 h-4 text-purple-600" />
              <span>Prescriptions ({prescriptions.length})</span>
            </div>
            <Link
              href="/child/lab-reports"
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5"
            >
              <span>🧪</span>
              <span>Test Reports ({labReportsCount})</span>
            </Link>
          </div>
          <UploadDocumentForm elderId={relationship.elderId} />
        </div>
      </header>

      {/* Lab Reports Banner if tests exist */}
      {labReportsCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0">
              🧪
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-sm">
                Diagnostic test reports available
              </p>
              <p className="text-xs text-emerald-700">
                {relationship.elder.name} has {labReportsCount} blood test/scan report{labReportsCount === 1 ? "" : "s"} logged.
              </p>
            </div>
          </div>
          <Link
            href="/child/lab-reports"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shrink-0"
          >
            View Test Reports →
          </Link>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {prescriptions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 text-2xl">
              📄
            </div>
            <h3 className="text-lg font-bold text-slate-900">No prescriptions found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">Upload doctor prescriptions or consultation notes for safekeeping.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-xs">
                <tr>
                  <th className="p-4 px-6">Document Name</th>
                  <th className="p-4 px-6">Type</th>
                  <th className="p-4 px-6">Date Added</th>
                  <th className="p-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptions.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
