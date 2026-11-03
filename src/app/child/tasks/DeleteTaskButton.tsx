"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function DeleteTaskButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this?")) return
    setLoading(true)
    try {
      await fetch("/api/tasks?id=" + id, { method: "DELETE" })
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("eldersaath:refresh-tasks"))
      }
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-medium">
      {loading ? "..." : "Delete"}
    </button>
  )
}