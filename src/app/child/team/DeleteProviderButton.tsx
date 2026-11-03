"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"

export function DeleteProviderButton({ 
  providerId, 
  providerName 
}: { 
  providerId: string
  providerName: string 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to remove "${providerName}" from the care team?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/providers?id=${providerId}`, {
        method: "DELETE"
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert("Failed to delete team member")
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      alert("Error deleting team member")
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
      title={`Remove ${providerName}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-600" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
