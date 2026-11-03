"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Mail, Phone } from "lucide-react"

export function AddProviderForm({ elderId }: { elderId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !role) return
    
    setLoading(true)
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          elderId, 
          name, 
          role, 
          phone, 
          email 
        })
      })

      if (res.ok) {
        setIsOpen(false)
        setName("")
        setRole("")
        setPhone("")
        setEmail("")
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.message || "Failed to add team member")
      }
    } catch (error) {
      console.error(error)
      alert("Error adding team member")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full py-3.5 flex items-center justify-center gap-2 text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 rounded-2xl transition cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        Add Team Member
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-slate-900">New Care Team Member</h3>
        <button 
          type="button" 
          onClick={() => setIsOpen(false)} 
          className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input 
          required 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="e.g. Dr. Sharma or Maria"
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 font-medium transition"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Role / Job Title <span className="text-red-500">*</span>
        </label>
        <input 
          required 
          type="text" 
          value={role} 
          onChange={e => setRole(e.target.value)} 
          placeholder="e.g. Doctor, Nurse, Caretaker, Physiotherapist"
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 font-medium transition"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            Phone (Optional)
          </label>
          <input 
            type="tel" 
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            placeholder="+91 98765 43210"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 font-medium transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            Email (Optional)
          </label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="doctor@clinic.com"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 font-medium transition"
          />
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading || !name || !role}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm hover:shadow"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Team Member"}
      </button>
    </form>
  )
}
