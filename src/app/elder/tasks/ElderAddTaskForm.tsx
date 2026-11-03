"use client"
import { convertTo12Hour } from '@/lib/timeUtils'

import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function ElderAddTaskForm() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [time, setTime] = useState("")
  const [triggerAlarm, setTriggerAlarm] = useState(false)
  const [frequency, setFrequency] = useState("0,1,2,3,4,5,6")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return

    setLoading(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, time: convertTo12Hour(time), triggerAlarm, frequency })
      })

      if (res.ok) {
        setTitle("")
        setDescription("")
        setTime("")
        setTriggerAlarm(false)
      setFrequency("0,1,2,3,4,5,6")
        setIsOpen(false)
        window.dispatchEvent(new CustomEvent("eldersaath:refresh-tasks"))
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
        className="w-full mb-6 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition"
      >
        <Plus className="w-5 h-5" />
        Add something to do
      </button>
    )
  }

  return (
    <div className="w-full mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-900">Add a New Thing to Do</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
          <input 
            type="text" 
            required 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="e.g. Call the doctor" 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description (Optional)</label>
          <input 
            type="text" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="Any extra details..." 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900"
          />
        </div>
        
        <div className="mb-2 text-left">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Days of the Week</label>
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
              const isSelected = frequency.includes(day.val);
              return (
                <button
                  key={day.val}
                  type="button"
                  onClick={() => {
                    let arr = frequency ? frequency.split(',').filter(d => d) : [];
                    if (isSelected) arr = arr.filter(d => d !== day.val);
                    else arr.push(day.val);
                    setFrequency(arr.join(','));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${isSelected ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
          {frequency.length === 0 && <p className="text-xs text-red-500 mt-1">Please select at least one day.</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time (Optional)</label>
          <input 
            type="time" 
            value={time} 
            onChange={e => setTime(e.target.value)} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 font-bold"
          />
        </div>
        <div className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => setTriggerAlarm(!triggerAlarm)}
            className={`w-14 h-7 rounded-full relative transition-colors ${triggerAlarm ? 'bg-red-500' : 'bg-slate-300'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all ${triggerAlarm ? 'left-7' : 'left-0.5'}`} />
          </button>
          <div className="flex-1">
            <p className="font-bold text-slate-900">Important Alarm</p>
            <p className="text-sm text-slate-500">Rings loud full-screen alarm.</p>
          </div>
        </div>
        <button 
          type="submit" 
          disabled={loading || !title} 
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}
        </button>
      </form>
    </div>
  )
}
