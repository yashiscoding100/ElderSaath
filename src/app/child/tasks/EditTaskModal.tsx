"use client"
import { convertTo12Hour, convertTo24Hour } from "@/lib/timeUtils"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Loader2, Pencil } from "lucide-react"

export type Task = {
  id: string
  title: string
  description?: string | null
  time?: string | null
  triggerAlarm?: boolean
  frequency?: string
}

export function EditTaskModal({ task, variant = "default" }: { task: Task; variant?: "default" | "compact" | "elder" }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || "",
    time: task.time ? convertTo24Hour(task.time) : "",
    triggerAlarm: task.triggerAlarm === true,
    frequency: task.frequency?.toLowerCase() === "daily" ? "0,1,2,3,4,5,6" : (task.frequency || "0,1,2,3,4,5,6")
  })

  // Re-sync form state when task prop changes or modal opens
  const handleOpen = () => {
    setFormData({
      title: task.title,
      description: task.description || "",
      time: task.time ? convertTo24Hour(task.time) : "",
      triggerAlarm: task.triggerAlarm === true,
      frequency: task.frequency?.toLowerCase() === "daily" ? "0,1,2,3,4,5,6" : (task.frequency || "0,1,2,3,4,5,6")
    })
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      const formattedTime = formData.time ? convertTo12Hour(formData.time) : null
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          time: formattedTime,
          triggerAlarm: formData.triggerAlarm,
          frequency: formData.frequency
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "Failed to update task")
      }

      setIsOpen(false)
      // Broadcast hardware alarm re-sync on device
      window.dispatchEvent(new CustomEvent("eldersaath:refresh-tasks"))
      router.refresh()
    } catch (error: any) {
      alert("Error updating task: " + error.message)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const days = [
    { val: "1", label: "Mon" },
    { val: "2", label: "Tue" },
    { val: "3", label: "Wed" },
    { val: "4", label: "Thu" },
    { val: "5", label: "Fri" },
    { val: "6", label: "Sat" },
    { val: "0", label: "Sun" },
  ]

  return (
    <>
      {variant === "elder" ? (
        <button
          type="button"
          onClick={handleOpen}
          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          title="Edit task & time"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="text-purple-600 hover:text-purple-900 font-medium bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-md text-xs transition inline-flex items-center gap-1"
          title="Edit task & time"
        >
          <Pencil className="w-3 h-3" />
          <span>Edit</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in text-left">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Edit Task & Time</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update schedule, alarms, or task details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Call your grandson, Drink herbal tea"
                  className="text-slate-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition text-sm"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Any helpful instructions or notes..."
                  className="text-slate-800 w-full border-2 border-slate-200 p-2.5 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition text-sm"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Scheduled Time (Optional)
                </label>
                <input
                  type="time"
                  className="text-slate-900 font-bold w-full border-2 border-slate-200 p-2.5 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition text-sm"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-1">Leave empty if this task doesn&apos;t have a strict time.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Days of the Week
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {days.map(day => {
                    const isSelected = formData.frequency.includes(day.val)
                    return (
                      <button
                        key={day.val}
                        type="button"
                        onClick={() => {
                          let arr = formData.frequency ? formData.frequency.split(",").filter(d => d) : []
                          if (isSelected) arr = arr.filter(d => d !== day.val)
                          else arr.push(day.val)
                          setFormData({ ...formData, frequency: arr.join(",") })
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                          isSelected
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
                {formData.frequency.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Please select at least one day.</p>
                )}
              </div>

              {/* Trigger Alarm Toggle Switch */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${formData.triggerAlarm ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Full-Screen Loud Alarm</p>
                    <p className="text-[11px] text-slate-500">
                      Rings an aggressive alarm on elder&apos;s phone at scheduled time.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, triggerAlarm: !formData.triggerAlarm })}
                  className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                    formData.triggerAlarm ? "bg-red-500" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                      formData.triggerAlarm ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formData.frequency.length === 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
