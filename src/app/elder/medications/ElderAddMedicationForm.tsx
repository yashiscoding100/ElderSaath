"use client"
import { convertTo12Hour } from "@/lib/timeUtils"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"

export function ElderAddMedicationForm() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [time, setTime] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !dosage || !time) return
    
    setLoading(true)
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          dosage, 
          frequency: "Daily", // Default for simplicity in elder view
          time, 
          instructions: "" 
        })
      })

      if (res.ok) {
        setIsOpen(false)
        setName("")
        setDosage("")
        setTime("")
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

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full mb-6 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition text-lg"
      >
        <Plus className="w-6 h-6" />
        Add New Medicine
      </button>
    )
  }

  return (
    <div className="w-full mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-xl text-slate-900">New Medicine</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 font-medium">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">Medicine Name</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Paracetamol" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">Dosage</label>
          <input required type="text" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g. 1 Pill" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">Time to Take</label>
          <input required type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900" />
        </div>

        <button disabled={loading || !name || !dosage || !time} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Save Medicine"}
        </button>
      </form>
    </div>
  )
}
