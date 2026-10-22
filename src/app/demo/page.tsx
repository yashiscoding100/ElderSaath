"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, User, Heart, Shield, Activity, Bell, FileText, CheckCircle2 } from "lucide-react"

export default function DemoSelectionPage() {
  const router = useRouter()
  const [loadingRole, setLoadingRole] = useState<"PARENT" | "CHILD" | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLaunchDemo = async (role: "PARENT" | "CHILD") => {
    setLoadingRole(role)
    setErrorMessage(null)

    try {
      // 1. Request demo account credentials from server API
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to initialize demo session")
      }

      // 2. Sign in seamlessly via NextAuth
      const signInRes = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password
      })

      if (signInRes?.error) {
        throw new Error(signInRes.error)
      }

      // 3. Clear any conflicting local persistence credentials from demo
      localStorage.removeItem("es_persistent_email")
      localStorage.removeItem("es_persistent_password")

      // 4. Redirect to the designated Parent or Child UI
      router.push(data.redirectUrl)
      router.refresh()
    } catch (err: any) {
      console.error("Demo launch error:", err)
      setErrorMessage(err.message || "Failed to enter demo mode. Please try again.")
      setLoadingRole(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
              <span className="text-white font-black text-xl">ES</span>
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight">ElderSaath</span>
              <span className="ml-2 text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Interactive Recruiter Demo
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <span>✨</span> No Sign-Up or Password Required
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Choose an Experience to Explore
          </h1>
          <p className="text-slate-600 text-base sm:text-lg mt-3 leading-relaxed">
            Experience ElderSaath through either the senior elder interface or the remote caregiver dashboard. Both accounts are actively linked with pre-loaded vitals and medication schedules.
          </p>
        </div>

        {errorMessage && (
          <div className="max-w-md mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Dual Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
          {/* PARENT (ELDER) CARD */}
          <div className="bg-white rounded-3xl p-8 border-2 border-slate-200 hover:border-blue-500 shadow-xl shadow-slate-200/50 hover:shadow-blue-500/10 transition-all flex flex-col justify-between relative group">
            <div className="absolute top-6 right-6">
              <span className="text-xs font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                Elder View
              </span>
            </div>

            <div>
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:scale-110 transition-transform">
                👴
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Parent / Elder Interface</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Designed specifically for aging seniors with high-contrast UI, larger touch targets, and simplified navigation.
              </p>

              <div className="mt-6 space-y-3 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Interactive Audio-Visual Medication Alarms & Snooze</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>One-Touch Daily Vitals Logging (BP, Sugar, Pulse)</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Medical Vault with Prescription Management</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Emergency SOS Dispatch to Linked Caregiver</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6">
              <button
                onClick={() => handleLaunchDemo("PARENT")}
                disabled={loadingRole !== null}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-base"
              >
                {loadingRole === "PARENT" ? (
                  <span>Entering Parent Demo...</span>
                ) : (
                  <>
                    <span>Enter Parent (Elder) Demo</span>
                    <span>→</span>
                  </>
                )}
              </button>
              <p className="text-center text-[11px] font-semibold text-slate-400 mt-2">
                Logs in as demo account: <strong>parent.demo@eldersaath.com</strong>
              </p>
            </div>
          </div>

          {/* CHILD (CAREGIVER) CARD */}
          <div className="bg-white rounded-3xl p-8 border-2 border-slate-200 hover:border-emerald-500 shadow-xl shadow-slate-200/50 hover:shadow-emerald-500/10 transition-all flex flex-col justify-between relative group">
            <div className="absolute top-6 right-6">
              <span className="text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                Caregiver View
              </span>
            </div>

            <div>
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:scale-110 transition-transform">
                👨‍👧
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Child / Caregiver Interface</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Comprehensive remote monitoring dashboard for adult children to track parents&apos; adherence, emergency alerts, and health trends.
              </p>

              <div className="mt-6 space-y-3 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Real-Time Health Vitals Graphs & Analytical Trends</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Remote Medication & Prescription Scheduling</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Care Network & Doctor Contact Management</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Multi-Elder Profile Switching & Activity Feeds</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6">
              <button
                onClick={() => handleLaunchDemo("CHILD")}
                disabled={loadingRole !== null}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-base"
              >
                {loadingRole === "CHILD" ? (
                  <span>Entering Child Demo...</span>
                ) : (
                  <>
                    <span>Enter Child (Caregiver) Demo</span>
                    <span>→</span>
                  </>
                )}
              </button>
              <p className="text-center text-[11px] font-semibold text-slate-400 mt-2">
                Logs in as demo account: <strong>child.demo@eldersaath.com</strong>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        ElderSaath Demo Environment • Permanent demo accounts pre-configured for evaluator & recruiter walkthroughs.
      </footer>
    </div>
  )
}
