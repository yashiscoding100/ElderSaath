import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FlaskConical, Files, Plus } from "lucide-react"
import { parseLabReport, isLabReport } from "@/lib/labReportUtils"
import { LabReportsClient } from "@/components/lab-reports/LabReportsClient"

export const dynamic = "force-dynamic"

export default async function ElderLabReportsPage() {
  const session = await auth()
  
  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  let allDocs: any[] = []
  try {
    allDocs = await prisma.medicalDocument.findMany({
      where: { elderId: session.user.id },
      orderBy: { uploadedAt: "desc" }
    })
  } catch (e) {
    console.error("Elder lab reports fetch error:", e)
  }

  const labReports = allDocs
    .filter(doc => isLabReport(doc.title))
    .map(doc => parseLabReport(doc)!)
    .filter(Boolean)
    .sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""))

  const prescriptionCount = allDocs.filter(doc => !isLabReport(doc.title)).length

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/elder/home" 
              className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700"
              title="Back to Elder Home"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🧪</span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Lab & Test Reports
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Keep and review blood tests, scans, ECGs, and lab reports for {session.user.name}
              </p>
            </div>
          </div>

          {/* Tab Switcher: Prescriptions vs Test Reports */}
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center text-sm font-bold shadow-inner">
            <Link
              href="/elder/documents"
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

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Reports</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{labReports.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Saved in digital vault</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latest Test Date</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 truncate">
              {labReports[0]?.testDate || "None Yet"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {labReports[0]?.testName || "Upload your first"}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 col-span-2 sm:col-span-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prescriptions</p>
            <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-1">{prescriptionCount}</p>
            <Link href="/elder/documents" className="text-xs text-blue-600 hover:underline font-bold mt-0.5 inline-block">
              View Prescriptions →
            </Link>
          </div>
        </div>

        {/* Main Lab Reports Client */}
        <LabReportsClient
          initialReports={labReports}
          elderId={session.user.id}
          isElderView={true}
        />
      </div>
    </div>
  )
}
