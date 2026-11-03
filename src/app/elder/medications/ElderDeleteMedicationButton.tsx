"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function ElderDeleteMedicationButton({ medicationId, medicationName }: { medicationId: string, medicationName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${medicationName}?`)) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/medications?id=${medicationId}`, { method: "DELETE" })
      if (res.ok) {
        if (typeof (window as any).__syncElderAlarms === "function") {
          (window as any).__syncElderAlarms()
        }
        window.dispatchEvent(new Event("eldersaath:refresh-medications"))
        router.refresh()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition"
    >
      {loading ? "..." : "Delete"}
    </button>
  )
}
