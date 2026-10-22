"use client"

import { useState } from "react"
import { toggleDemoMode } from "./demoActions"

export function AdminDemoToggleCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleToggle = async () => {
    const nextState = !enabled
    setLoading(true)
    setMessage(null)
    try {
      const res = await toggleDemoMode(nextState)
      if (res.success) {
        setEnabled(nextState)
        setMessage(res.message)
      } else {
        alert(res.message)
      }
    } catch (e: any) {
      alert("Error updating demo status: " + (e.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-xl font-bold text-slate-900">Recruiter Demo Mode</h3>
            <span
              className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {enabled ? "Active on Login Page" : "Disabled / Hidden"}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Controls whether the <strong>&quot;Explore Live Demo (Recruiters)&quot;</strong> button appears on the sign-in page. When active, recruiters can experience the Parent or Child interface with one click.
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 min-w-[140px] disabled:opacity-50 ${
            enabled
              ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
          }`}
        >
          {loading ? (
            "Updating..."
          ) : enabled ? (
            <>
              <span>🚫</span> Disable Demo
            </>
          ) : (
            <>
              <span>✅</span> Enable Demo
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-900">
          {message}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-slate-800">Linked Permanent Demo Accounts:</span>
          <div className="mt-1 space-x-4">
            <span>
              👴 <strong>Parent (Elder):</strong> parent.demo@eldersaath.com
            </span>
            <span>
              👨‍👧 <strong>Child (Caregiver):</strong> child.demo@eldersaath.com
            </span>
          </div>
        </div>
        <div className="text-slate-400 font-medium">
          Both demo accounts are visible and manageable in the normal Users list.
        </div>
      </div>
    </div>
  )
}
