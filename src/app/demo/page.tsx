"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, UserCheck, ShieldCheck } from "lucide-react"

export default function DemoSelectionPage() {
  const router = useRouter()
  const [loadingRole, setLoadingRole] = useState<"PARENT" | "CHILD" | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLaunchDemo = async (role: "PARENT" | "CHILD") => {
    setLoadingRole(role)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to initialize demo session")
      }

      const signInRes = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password
      })

      if (signInRes?.error) {
        throw new Error(signInRes.error)
      }

      localStorage.removeItem("es_persistent_email")
      localStorage.removeItem("es_persistent_password")

      router.push(data.redirectUrl)
      router.refresh()
    } catch (err: any) {
      console.error("Demo launch error:", err)
      setErrorMessage(err.message || "Failed to enter demo mode. Please try again.")
      setLoadingRole(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-900">
      {/* Top Minimalist Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 text-base tracking-tight">ElderSaath</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Demo Environment</span>
          </div>

          <Link
            href="/login"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center sm:text-left max-w-xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Select an account to review
          </h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            ElderSaath connects elderly family members with remote adult caregivers. Select either perspective below to preview the platform with pre-populated records.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Elder Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Elder Experience
                </span>
                <span className="text-xs font-medium text-slate-400">parent.demo@eldersaath.com</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Ramesh Sharma (Parent)</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Accessibility-focused layout designed for seniors. Features high-contrast reminders, daily vital logs, and one-tap emergency triggers.
              </p>

              <div className="mt-5 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Audio-visual medication alarm system with snooze</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Simple vital metric check-in (Blood Pressure, Glucose)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Personal prescription vault with self-delete access</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleLaunchDemo("PARENT")}
              disabled={loadingRole !== null}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingRole === "PARENT" ? "Signing in..." : "View Parent Dashboard"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Caregiver Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Caregiver Experience
                </span>
                <span className="text-xs font-medium text-slate-400">child.demo@eldersaath.com</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Aakash Sharma (Child)</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Analytical dashboard for adult children to monitor care recipient vitals, coordinate medication schedules, and review adherence trends.
              </p>

              <div className="mt-5 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Interactive 30-day vitals graphs and trends</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Remote prescription scheduling and task dispatch</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Active caregiver link to Ramesh Sharma</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleLaunchDemo("CHILD")}
              disabled={loadingRole !== null}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingRole === "CHILD" ? "Signing in..." : "View Caregiver Dashboard"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        ElderSaath Demo Environment &bull; Pre-configured test accounts for evaluation.
      </footer>
    </div>
  )
}
