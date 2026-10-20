import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { UploadDocumentForm } from "@/app/child/documents/UploadDocumentForm"
import { DocumentRow } from "@/app/child/documents/DocumentRow"
import { ClearAllDocumentsButton } from "./ClearAllDocumentsButton"

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

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/elder/home" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medical Vault</h1>
            <p className="text-sm text-slate-500 mt-1">Manage documents & prescriptions for {session.user.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <ClearAllDocumentsButton documentCount={documents.length} />
          <UploadDocumentForm elderId={session.user.id} />
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No documents found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">Upload prescriptions, lab reports, or medical records for safekeeping.</p>
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
                {documents.map(doc => (
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
