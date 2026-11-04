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
  const [hasDuration, setHasDuration] = useState(false)
  const [durationValue, setDurationValue] = useState("8")
  const [durationUnit, setDurationUnit] = useState<"DAYS" | "WEEKS" | "MONTHS">("WEEKS")
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
          instructions: "",
          durationValue: hasDuration && durationValue ? parseInt(durationValue) : null,
          durationUnit: hasDuration ? durationUnit : null
        })
      })

      if (res.ok) {
        setIsOpen(false)
        setName("")
        setDosage("")
        setTime("")
        setHasDuration(false)
        setDurationValue("8")
        setDurationUnit("WEEKS")
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
        className="w-full mb-6 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition text-lg shadow-sm"
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
          <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Paracetamol" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">Dosage</label>
          <input required type="text" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g. 1 Pill" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">Time to Take</label>
          <input required type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium" />
        </div>

        {/* Optional Course Duration */}
        <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <div>
                <label className="block text-xs font-bold text-slate-900">Course Duration (Optional)</label>
                <p className="text-[11px] text-slate-500">e.g. Doctor prescribed for 8 weeks or 10 days.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHasDuration(!hasDuration)}
              className={`w-11 h-6 rounded-full relative transition-colors ${hasDuration ? 'bg-purple-600' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${hasDuration ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {hasDuration && (
            <div className="pt-2 border-t border-purple-200/60 grid grid-cols-2 gap-2 animate-fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Take for</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="e.g. 8"
                  className="w-full bg-white border border-purple-300 p-2 rounded-lg text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400"
                  value={durationValue}
                  onChange={e => setDurationValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Unit</label>
                <select
                  className="w-full bg-white border border-purple-300 p-2 rounded-lg text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400"
                  value={durationUnit}
                  onChange={e => setDurationUnit(e.target.value as any)}
                >
                  <option value="DAYS">Days</option>
                  <option value="WEEKS">Weeks</option>
                  <option value="MONTHS">Months</option>
                </select>
              </div>
              <div className="col-span-2 text-[11px] text-purple-800 bg-purple-100/70 p-2 rounded-lg font-medium">
                ℹ️ Alarms will ring daily for {durationValue || "8"} {durationUnit.toLowerCase()}. Daily alarms turn off once completed.
              </div>
            </div>
          )}
        </div>

        <button disabled={loading || !name || !dosage || !time} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50 transition shadow-sm">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Save Medicine"}
        </button>
      </form>
    </div>
  )
}
