"use client"

import { useState } from "react"
import { clearAllElderDocuments } from "./actions"
import { Trash2 } from "lucide-react"

export function ClearAllDocumentsButton({ documentCount }: { documentCount: number }) {
  const [loading, setLoading] = useState(false)

  if (documentCount === 0) return null

  const handleClearAll = async () => {
    if (
      !confirm(
        `Are you sure you want to delete all ${documentCount} prescriptions and medical documents from your Medical Vault?\n\nThis cannot be undone and will permanently free up storage space.`
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const res = await clearAllElderDocuments()
      if (res.success) {
        alert(res.message)
      } else {
        alert(`Failed to delete: ${res.message}`)
      }
    } catch (e: any) {
      alert(`Error: ${e.message || "An error occurred"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClearAll}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold text-sm transition disabled:opacity-50"
      title="Delete all prescriptions and documents to free up storage"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? "Deleting all..." : "Delete All Documents"}
    </button>
  )
}
