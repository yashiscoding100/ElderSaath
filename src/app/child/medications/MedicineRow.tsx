"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BellRing, Calendar } from "lucide-react"
import { EditMedicineModal, MedicationItem } from "./EditMedicineModal"
import { formatDurationSummary, isMedicationExpired } from "@/lib/medicationDurationUtils"

export function MedicineRow({ med }: { med: MedicationItem }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const formatFreq = (f: string) => {
    if (!f || f.toLowerCase() === "daily" || f === "0,1,2,3,4,5,6") return "Every Day"
    const map: Record<string, string> = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat" }
    return f.split(",").map(d => map[d.trim()]).filter(Boolean).join(", ")
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${med.name}?`)) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/medications?id=${med.id}`, { method: "DELETE" })
      if (res.ok) router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleTestAlarm = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/medications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medId: med.id })
      })
      const data = await res.json()
      if (res.ok) {
        alert("🔔 Alarm Dispatched!\nCheck your elder's phone right now—it should be ringing full-screen!")
      } else {
        alert("Error dispatching alarm: " + (data.message || "Unknown error"))
      }
    } catch (e: unknown) {
      alert("Network error: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setTesting(false)
    }
  }

  const isExpired = isMedicationExpired(med.endDate)
  const durationText = formatDurationSummary(med.durationValue, med.durationUnit, med.endDate)

  const shownCount = med.specialNoticeShownCount ?? 0
  const maxCount = med.specialNoticeMaxCount ?? 5
  const noticeDone = Boolean(med.specialNoticeEnabled) && shownCount >= maxCount

  return (
    <tr className={`transition group ${isExpired ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50'}`}>
      <td className="p-4 px-6 font-bold text-slate-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>{med.name}</span>
            {isExpired && (
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Completed
              </span>
            )}
          </div>
          {med.specialNoticeEnabled && (
            <span
              className={`inline-flex items-center gap-1 w-fit text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                noticeDone
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
              title={med.specialNoticeType === "VOICE" ? "Post-alarm voice notice" : "Post-alarm text notice"}
            >
              {med.specialNoticeType === "VOICE" ? "🎙️ Voice Notice" : "📝 Text Notice"}: {Math.min(shownCount, maxCount)}/{maxCount}
              {noticeDone ? " (Done)" : ""}
            </span>
          )}
        </div>
      </td>
      <td className="p-4 px-6 text-slate-600 font-medium">{med.dosage}</td>
      <td className="p-4 px-6 text-blue-600 font-bold">{med.time}</td>
      <td className="p-4 px-6 text-slate-600 font-medium">{formatFreq(med.frequency)}</td>
      
      {/* Course Duration Column */}
      <td className="p-4 px-6">
        {med.endDate ? (
          isExpired ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 line-through">
                {durationText}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Alarm Off
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <Calendar className="w-3 h-3 text-purple-500" />
              <span>{durationText}</span>
            </span>
          )
        ) : (
          <span className="text-xs text-slate-400">Ongoing (No end date)</span>
        )}
      </td>

      <td className="p-4 px-6 text-right space-x-2">
        {!isExpired && (
          <button
            onClick={handleTestAlarm}
            disabled={testing}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold text-sm bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-md transition disabled:opacity-50"
            title="Instantly test alarm on elder's phone"
          >
            <BellRing className="w-3.5 h-3.5 text-emerald-600" />
            {testing ? "Ringing..." : "Test Alarm"}
          </button>
        )}
        <div className="inline-block">
          <EditMedicineModal med={med} />
        </div>
        <button 
          onClick={handleDelete}
          disabled={loading}
          className="text-red-600 hover:text-red-700 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition disabled:opacity-50"
        >
          {loading ? "..." : "Delete"}
        </button>
      </td>
    </tr>
  )
}
