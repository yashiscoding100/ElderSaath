"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Image as ImageIcon, Trash2, Eye, Loader2 } from "lucide-react"
import { MedicalDocumentViewerModal, MedicalDocItem, detectDocumentFormat } from "@/components/MedicalDocumentViewerModal"

type MedicalDocument = {
  id: string
  title: string
  fileType: string
  fileUrl: string
  uploadedAt: Date
}

export function DocumentRow({ doc }: { doc: MedicalDocument }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isViewing, setIsViewing] = useState(false)

  const format = detectDocumentFormat(doc.fileUrl, doc.fileType)

  const docItem: MedicalDocItem = {
    id: doc.id,
    title: doc.title,
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
    date: new Date(doc.uploadedAt).toLocaleDateString(),
    subtitle: "Medical Vault Prescription",
    icon: format.isPdf ? "📄" : "💊"
  }

  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm(`Are you sure you want to delete "${doc.title}"?\n\nThis cannot be undone and will permanently free up storage.`)) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?id=${doc.id}`, { method: "DELETE" })
      if (res.ok) {
        setIsViewing(false)
        router.refresh()
      } else {
        alert("Failed to delete document")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <tr 
        className="hover:bg-slate-50 transition cursor-pointer" 
        onClick={() => setIsViewing(true)}
      >
        <td className="p-4 px-6 font-bold text-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shrink-0">
            {format.isPdf ? <FileText className="w-5 h-5 text-red-500" /> : <ImageIcon className="w-5 h-5 text-purple-600" />}
          </div>
          <span className="truncate max-w-xs">{doc.title}</span>
        </td>
        <td className="p-4 px-6 text-slate-500 font-semibold uppercase text-xs tracking-wider">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {format.extension.toUpperCase()}
          </span>
        </td>
        <td className="p-4 px-6 text-slate-600 font-medium">
          {new Date(doc.uploadedAt).toLocaleDateString()}
        </td>
        <td className="p-4 px-6 text-right space-x-2">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsViewing(true)
            }} 
            className="text-blue-700 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl transition inline-flex items-center gap-1.5 text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>

          <button 
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="text-red-600 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition disabled:opacity-50 inline-flex items-center gap-1"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Delete</span>
          </button>
        </td>
      </tr>

      {/* Full-Featured Modal Viewer with Zoom, Pan, Working Download, and In-Viewer Delete */}
      {isViewing && (
        <MedicalDocumentViewerModal
          doc={docItem}
          onClose={() => setIsViewing(false)}
          onDelete={async (id) => {
            const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete document")
            setIsViewing(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
