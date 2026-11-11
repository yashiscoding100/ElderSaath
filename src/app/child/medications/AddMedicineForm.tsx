"use client"
import { convertTo12Hour } from "@/lib/timeUtils"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { SpecialNoticeEditor, SpecialNoticeState } from "@/components/child/SpecialNoticeEditor"

const DEFAULT_NOTICE_STATE: SpecialNoticeState = {
  enabled: false,
  type: "TEXT",
  text: "",
  audioUrl: "",
  audioName: "",
  maxCount: 5
}

export function AddMedicineForm({ elderId }: { elderId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "0,1,2,3,4,5,6",
    time: "08:00",
    instructions: ""
  })

  // Optional prescribed course duration
  const [hasDuration, setHasDuration] = useState(false)
  const [durationValue, setDurationValue] = useState("8")
  const [durationUnit, setDurationUnit] = useState<"DAYS" | "WEEKS" | "MONTHS">("WEEKS")

  // Optional post-alarm special notice
  const [specialNotice, setSpecialNotice] = useState<SpecialNoticeState>(DEFAULT_NOTICE_STATE)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (specialNotice.enabled) {
      if (specialNotice.type === "TEXT" && !specialNotice.text.trim()) {
        alert("Please enter the special notice text or switch to Voice Notice.")
        return
      }
      if (specialNotice.type === "VOICE" && !specialNotice.audioUrl) {
        alert("Please upload an audio file or record a voice notice.")
        return
      }
    }

    setLoading(true)
    
    try {
      const payload = {
        elderId,
        ...formData,
        time: convertTo12Hour(formData.time),
        durationValue: hasDuration && durationValue ? Number(durationValue) : null,
        durationUnit: hasDuration && durationValue ? durationUnit : null,
        specialNoticeEnabled: specialNotice.enabled,
        specialNoticeType: specialNotice.type,
        specialNoticeText: specialNotice.text,
        specialNoticeAudioUrl: specialNotice.audioUrl,
        specialNoticeAudioName: specialNotice.audioName,
        specialNoticeMaxCount: specialNotice.maxCount
      }

      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg =
          res.status === 413
            ? "Audio attachment is too large to save (max 2.8 MB). Please use a shorter audio clip."
            : err.message || `Failed to save medicine (HTTP ${res.status})`
        alert(msg)
        return
      }

      setIsOpen(false)
      setFormData({ name: "", dosage: "", frequency: "0,1,2,3,4,5,6", time: "08:00", instructions: "" })
      setHasDuration(false)
      setDurationValue("8")
      setDurationUnit("WEEKS")
      setSpecialNotice(DEFAULT_NOTICE_STATE)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Network error while saving medicine")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
      >
        + Add Medicine
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full relative max-h-[92vh] overflow-y-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-6 tracking-tight">Add New Medicine</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Medicine Name</label>
            <input required type="text" className="text-gray-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Dosage</label>
              <input required type="text" placeholder="e.g. 500mg" className="text-gray-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition" value={formData.dosage} onChange={e => setFormData({...formData, dosage: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Time</label>
              <input required type="time" className="text-gray-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">Days of the Week</label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: "1", label: "Mon" },
                { val: "2", label: "Tue" },
                { val: "3", label: "Wed" },
                { val: "4", label: "Thu" },
                { val: "5", label: "Fri" },
                { val: "6", label: "Sat" },
                { val: "0", label: "Sun" },
              ].map(day => {
                const isSelected = formData.frequency.includes(day.val);
                return (
                  <button
                    key={day.val}
                    type="button"
                    onClick={() => {
                      let arr = formData.frequency ? formData.frequency.split(',').filter(d => d) : [];
                      if (isSelected) arr = arr.filter(d => d !== day.val);
                      else arr.push(day.val);
                      setFormData({...formData, frequency: arr.join(',')});
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${isSelected ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
            {formData.frequency.length === 0 && <p className="text-xs text-red-500 mt-1">Please select at least one day.</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Instructions (Optional)</label>
            <input type="text" placeholder="e.g. After meals" className="text-gray-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition" value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} />
          </div>

          {/* Prescribed Course Duration (Optional) */}
          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
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
                    onChange={e => setDurationUnit(e.target.value as "DAYS" | "WEEKS" | "MONTHS")}
                  >
                    <option value="DAYS">Days</option>
                    <option value="WEEKS">Weeks</option>
                    <option value="MONTHS">Months</option>
                  </select>
                </div>
                <div className="col-span-2 text-[11px] text-purple-800 bg-purple-100/70 p-2 rounded-lg font-medium">
                  ℹ️ Alarms will ring daily for {durationValue || "8"} {durationUnit.toLowerCase()}. When finished, the daily alarm turns off and notifies both elder and family members.
                </div>
              </div>
            )}
          </div>

          {/* Post-Alarm Special Notice (Text or Voice for N times) */}
          <SpecialNoticeEditor value={specialNotice} onChange={setSpecialNotice} />
          
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 font-bold text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-md">Confirm & Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
