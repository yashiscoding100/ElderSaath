import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Files, FlaskConical } from "lucide-react"
import { UploadDocumentForm } from "@/app/child/documents/UploadDocumentForm"
import { DocumentRow } from "@/app/child/documents/DocumentRow"
import { ClearAllDocumentsButton } from "./ClearAllDocumentsButton"
import { isLabReport } from "@/lib/labReportUtils"

export const dynamic = "force-dynamic"

export default async function ElderDocuments() {
  const session = await auth()
  
  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  let documents: any[] = []
  try {
    documents = await prisma.medicalDocument.findMany({
      where: { elderId: session.user.id },
      orderBy: { uploadedAt: 'desc' }
    })
  } catch (e) {
    console.error("Elder documents fetch error:", e)
  }

  const prescriptions = documents.filter(doc => !isLabReport(doc.title))
  const labReportsCount = documents.filter(doc => isLabReport(doc.title)).length

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/elder/home" className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">💊</span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Prescriptions Vault</h1>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Manage doctor prescriptions and records for {session.user.name}</p>
            </div>
          </div>

          {/* Tab Switcher: Prescriptions vs Test Reports */}
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center text-sm font-bold shadow-inner">
            <div className="px-4 py-2 rounded-xl bg-white text-slate-900 shadow-sm flex items-center gap-1.5">
              <Files className="w-4 h-4 text-purple-600" />
              <span>Prescriptions ({prescriptions.length})</span>
            </div>
            <Link
              href="/elder/lab-reports"
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5"
            >
              <span>🧪</span>
              <span>Test Reports ({labReportsCount})</span>
            </Link>
          </div>
        </header>

        {/* Action Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
          <p className="text-sm font-semibold text-slate-600">
            {prescriptions.length} Prescription{prescriptions.length === 1 ? "" : "s"} on file
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <ClearAllDocumentsButton documentCount={prescriptions.length} />
            <UploadDocumentForm elderId={session.user.id} />
          </div>
        </div>

        {/* Lab Reports Announcement Banner */}
        {labReportsCount > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0">
                🧪
              </div>
              <div>
                <p className="font-bold text-emerald-950 text-sm">
                  Looking for blood tests, ECGs, or scans?
                </p>
                <p className="text-xs text-emerald-700">
                  You have {labReportsCount} diagnostic test report{labReportsCount === 1 ? "" : "s"} in your dedicated Lab Reports section.
                </p>
              </div>
            </div>
            <Link
              href="/elder/lab-reports"
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
              <h3 className="text-lg font-bold text-slate-900">No prescriptions uploaded yet</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                Upload doctor prescriptions or medical consultation slips for easy safekeeping.
              </p>
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
    </div>
  )
}
