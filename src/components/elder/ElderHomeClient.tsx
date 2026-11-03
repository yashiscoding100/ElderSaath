"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Settings, 
  Activity, 
  Pill, 
  CheckCircle2, 
  ArrowRight, 
  Phone, 
  Calendar, 
  FileText, 
  FlaskConical, 
  Heart, 
  Smile, 
  Layers, 
  Sparkles,
  Clock,
  ChevronRight
} from "lucide-react"
import { LogoutButton } from "@/components/LogoutButton"
import { PushSubscriptionManager } from "@/components/PushSubscriptionManager"
import { GlobalNotice } from "@/components/GlobalNotice"
import { PendingConnections } from "@/app/elder/home/PendingConnections"
import { MedicalProfileCard } from "@/components/MedicalProfileCard"
import { ElderUiStyle } from "@/lib/elderUiPreferences"

interface NextMedication {
  id: string
  name: string
  time: string
  dosage: string
  instructions?: string | null
}

interface ElderHomeClientProps {
  user: {
    id: string
    name?: string | null
    email?: string | null
  }
  initialStyle: ElderUiStyle
  todayData: {
    greeting: string
    dateFormatted: string
    totalMeds: number
    takenMeds: number
    nextMed: NextMedication | null
    healthCheckDone: boolean
    isCheckRequiredToday: boolean
    vitals: {
      bp: string
      sugar: string
      spo2: string
      pulse: string
      temp: string
      weight: string
    }
    pendingRequests: any[]
    profile: any
    tasksCount: number
    completedTasksCount: number
  }
}

export function ElderHomeClient({ user, initialStyle, todayData }: ElderHomeClientProps) {
  const [style, setStyle] = useState<ElderUiStyle>(initialStyle)
  const [switching, setSwitching] = useState(false)
  const [toastMessage, setToastMessage] = useState("")

  // On mount, check localStorage in case it was toggled locally
  useEffect(() => {
    const local = localStorage.getItem("es_elder_ui_style")
    if (local === "MODERN" || local === "CLASSIC") {
      setStyle(local)
    }
  }, [])

  const handleToggleStyle = async (newStyle: ElderUiStyle) => {
    setStyle(newStyle)
    localStorage.setItem("es_elder_ui_style", newStyle)
    setSwitching(true)
    setToastMessage(newStyle === "MODERN" ? "Switched to Modern Friendly View ✨" : "Switched to Classic Easy View 🧸")

    try {
      await fetch("/api/elder/ui-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: newStyle })
      })
    } catch (e) {
      console.warn("Failed to persist style preference:", e)
    } finally {
      setSwitching(false)
      setTimeout(() => setToastMessage(""), 3500)
    }
  }

  const elderFirstName = user.name ? user.name.split(" ")[0] : "Friend"
  const medProgressPercent = todayData.totalMeds > 0 
    ? Math.round((todayData.takenMeds / todayData.totalMeds) * 100) 
    : 100

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center pb-12 font-sans selection:bg-blue-100">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-fade-in flex items-center gap-2 border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top App Header */}
      <header className="w-full bg-white shadow-xs border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          
          {/* Elder Profile Brand Pill */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-sm">
              {elderFirstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                ElderSaath
              </span>
              <span className="text-lg font-bold text-slate-900 tracking-tight block">
                {elderFirstName}
              </span>
            </div>
          </div>

          {/* Controls: Mode Switcher + Push + Settings + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 1-Tap UI Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => handleToggleStyle("MODERN")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  style === "MODERN"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Switch to Modern Friendly View"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Modern</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleStyle("CLASSIC")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  style === "CLASSIC"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Switch to Classic Easy View"
              >
                <span>🧸</span>
                <span className="hidden sm:inline">Classic</span>
              </button>
            </div>

            <PushSubscriptionManager />

            <Link
              href="/elder/settings"
              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700"
              title="Elder Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-4xl px-4 sm:px-6 pt-6 space-y-6 flex-1">
        
        <GlobalNotice />
        <PendingConnections requests={todayData.pendingRequests} />

        {/* ======================================================== */}
        {/* VIEW 1: MODERN ELDER-FRIENDLY UI (DEFAULT)              */}
        {/* ======================================================== */}
        {style === "MODERN" && (
          <div className="space-y-6 animate-fade-in">

            {/* Warm Greeting Hero Banner */}
            <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-100 mb-3 border border-white/20">
                  <Calendar className="w-3.5 h-3.5 text-blue-200" />
                  <span>{todayData.dateFormatted}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {todayData.greeting}, {elderFirstName}! 👋
                </h1>
                <p className="text-blue-100/90 text-sm sm:text-base mt-1.5 max-w-xl font-medium">
                  Wishing you peace, happiness, and good health today. Here is your daily summary.
                </p>

                {/* Quick Switch Banner notice */}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-200">
                  <span>Displaying in <strong>Modern Friendly View</strong></span>
                  <button 
                    onClick={() => handleToggleStyle("CLASSIC")}
                    className="underline text-white font-bold hover:text-blue-100 transition"
                  >
                    Switch to Classic Simple View 🧸
                  </button>
                </div>
              </div>

              {/* Decorative background circle */}
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Next Dose Hero Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-xs shrink-0">
                    💊
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Medication Status
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">
                      {todayData.nextMed ? "Next Medicine Due" : "Daily Medications"}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/70 self-start sm:self-auto">
                  <span className="text-xs font-bold text-slate-600">
                    {todayData.totalMeds > 0 
                      ? `${todayData.takenMeds} of ${todayData.totalMeds} taken (${medProgressPercent}%)`
                      : "No meds scheduled today"}
                  </span>
                </div>
              </div>

              {todayData.nextMed ? (
                <div className="mt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-indigo-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {todayData.nextMed.time}
                      </span>
                      <span className="text-xs font-bold text-indigo-900">Scheduled Next</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mt-1">
                      {todayData.nextMed.name}
                    </h3>
                    <p className="text-sm font-medium text-slate-600">
                      {todayData.nextMed.dosage}
                      {todayData.nextMed.instructions ? ` • ${todayData.nextMed.instructions}` : ""}
                    </p>
                  </div>
                  <Link
                    href="/elder/medications"
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition shrink-0"
                  >
                    <span>View All Medicines</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : todayData.totalMeds > 0 && todayData.takenMeds >= todayData.totalMeds ? (
                <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950 text-base">All caught up for today!</p>
                      <p className="text-xs text-emerald-700 font-medium">You have taken all scheduled medications today.</p>
                    </div>
                  </div>
                  <Link
                    href="/elder/medications"
                    className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3.5 py-2 rounded-xl transition"
                  >
                    Review List
                  </Link>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <p className="text-sm text-slate-600 font-medium">No medicines scheduled for today. Have a restful day!</p>
                  <Link
                    href="/elder/medications"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Open Cabinet
                  </Link>
                </div>
              )}
            </div>

            {/* Health Check-in Card */}
            <div className={`rounded-3xl p-6 border shadow-sm transition hover:shadow-md ${
              todayData.healthCheckDone 
                ? "bg-white border-slate-200"
                : "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-800 shadow-blue-100"
            }`}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-xs ${
                    todayData.healthCheckDone ? "bg-emerald-100 text-emerald-700" : "bg-white/20 text-white"
                  }`}>
                    🩺
                  </div>
                  <div>
                    <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${todayData.healthCheckDone ? "text-slate-900" : "text-white"}`}>
                      Daily Health Check-in
                    </h2>
                    <p className={`text-sm mt-1 font-medium ${todayData.healthCheckDone ? "text-slate-500" : "text-blue-100"}`}>
                      {todayData.healthCheckDone 
                        ? "Completed today! Your blood pressure and vitals were recorded."
                        : (!todayData.isCheckRequiredToday 
                            ? "Optional rest day! You can still log today's vitals if you wish." 
                            : "Takes 2 minutes. Keeps your doctor and family updated on your health.")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/elder/checkin"
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-base transition shadow-sm shrink-0 ${
                    todayData.healthCheckDone
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      : "bg-white text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  <span>{todayData.healthCheckDone ? "Update Vitals" : "Start Check-in"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Primary Action Hub Grid */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  Your Daily Hub
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  Tap any card to open
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1. Medicines */}
                <Link
                  href="/elder/medications"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      💊
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                      {todayData.takenMeds}/{todayData.totalMeds}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Today's Medicines
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Schedule, doses, and mark as taken
                    </p>
                  </div>
                </Link>

                {/* 2. Tasks & Wellbeing */}
                <Link
                  href="/elder/tasks"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      🌸
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full">
                      {todayData.completedTasksCount}/{todayData.tasksCount} done
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                      Things to Do
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Daily routine, water, walks, and notes
                    </p>
                  </div>
                </Link>

                {/* 3. Diagnostic Lab Reports */}
                <Link
                  href="/elder/lab-reports"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      🧪
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                      Lab Tests
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Lab & Test Reports
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Blood tests, ECG, urine, scans
                    </p>
                  </div>
                </Link>

                {/* 4. Prescriptions Vault */}
                <Link
                  href="/elder/documents"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      📄
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
                      Prescriptions
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Prescriptions Vault
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Doctor slips and medical records
                    </p>
                  </div>
                </Link>

                {/* 5. Helpers & Care Team */}
                <Link
                  href="/elder/team"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-400 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      👥
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      1-Tap Call
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Helpers & Care Team
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Call doctors, nurses, drivers, maids
                    </p>
                  </div>
                </Link>

                {/* 6. Brain Games */}
                <Link
                  href="/elder/games"
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      🧩
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">
                      Mind Workout
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      Brain & Wellness Games
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Memory match, trivia, Sudoku
                    </p>
                  </div>
                </Link>

              </div>
            </div>

            {/* Today's Health Vitals Summary */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Today&apos;s Health Metrics
                  </h3>
                </div>
                <Link 
                  href="/elder/health" 
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
                >
                  <span>Full History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Blood Pressure
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                    {todayData.vitals.bp}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    mmHg
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Blood Sugar
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                    {todayData.vitals.sugar}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    mg/dL
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Pulse Rate
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                    {todayData.vitals.pulse}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    BPM
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Oxygen (SpO2)
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                    {todayData.vitals.spo2}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Medical Profile Card */}
            <MedicalProfileCard initialProfile={todayData.profile} />

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: CLASSIC EASY SENIOR UI (ACCESSIBLE LARGE CARDS) */}
        {/* ======================================================== */}
        {style === "CLASSIC" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Simple Mode Active Header Bar */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2.5 py-1 rounded-md inline-block mb-1">
                  🧸 Classic Simple Mode Active
                </span>
                <p className="text-sm font-bold text-amber-950">
                  Extra-large touch buttons with maximum contrast for effortless tapping.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleStyle("MODERN")}
                className="bg-white border-2 border-amber-300 hover:bg-amber-100 text-amber-900 font-extrabold px-5 py-2.5 rounded-2xl text-sm transition shadow-xs shrink-0"
              >
                Switch to Modern View ✨
              </button>
            </div>

            {/* Giant Action 1: Health Check */}
            <Link 
              href="/elder/checkin" 
              className={`block w-full rounded-3xl p-7 text-left transition-all border-2 shadow-sm flex items-center justify-between gap-4 ${
                todayData.healthCheckDone 
                  ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/70" 
                  : "bg-blue-600 border-blue-700 text-white hover:bg-blue-700 shadow-blue-200"
              }`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${
                  todayData.healthCheckDone ? "bg-emerald-200 text-emerald-800" : "bg-blue-500 text-white"
                }`}>
                  🩺
                </div>
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-black ${todayData.healthCheckDone ? "text-emerald-950" : "text-white"}`}>
                    Daily Health Check
                  </h2>
                  <p className={`text-base font-semibold mt-1 ${todayData.healthCheckDone ? "text-emerald-700" : "text-blue-100"}`}>
                    {todayData.healthCheckDone ? "✓ Completed for today" : "Tap here to record your vitals"}
                  </p>
                </div>
              </div>
              <span className={`text-3xl ${todayData.healthCheckDone ? "text-emerald-700" : "text-white"}`}>→</span>
            </Link>

            {/* Giant Action 2: Medicines */}
            <Link 
              href="/elder/medications" 
              className="block w-full bg-white rounded-3xl p-7 text-left shadow-sm hover:shadow-md transition-all border-2 border-slate-200 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                  💊
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Today&apos;s Medicines
                  </h2>
                  <p className="text-base font-semibold text-slate-500 mt-1">
                    {todayData.totalMeds > 0 
                      ? `${todayData.takenMeds} out of ${todayData.totalMeds} taken today` 
                      : "No medicines scheduled today"}
                  </p>
                </div>
              </div>
              <span className="text-3xl text-slate-400">→</span>
            </Link>

            {/* Giant Action 3: Things to Do */}
            <Link 
              href="/elder/tasks" 
              className="block w-full bg-white rounded-3xl p-7 text-left shadow-sm hover:shadow-md transition-all border-2 border-slate-200 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                  🌸
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Things to Do
                  </h2>
                  <p className="text-base font-semibold text-slate-500 mt-1">
                    Daily routine, walks, and reminders
                  </p>
                </div>
              </div>
              <span className="text-3xl text-slate-400">→</span>
            </Link>

            {/* Giant Action 4: Helpers & Team */}
            <Link 
              href="/elder/team" 
              className="block w-full bg-slate-900 text-white rounded-3xl p-7 text-left shadow-md hover:shadow-lg transition-all border-2 border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                  👥
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Helpers & Team
                  </h2>
                  <p className="text-base font-semibold text-slate-300 mt-1">
                    Call doctors, nurses, drivers, maids
                  </p>
                </div>
              </div>
              <span className="text-3xl text-emerald-400">📞</span>
            </Link>

            {/* Giant Action 5: Diagnostic Test Reports */}
            <Link 
              href="/elder/lab-reports" 
              className="block w-full bg-emerald-50 rounded-3xl p-7 text-left shadow-sm hover:shadow-md transition-all border-2 border-emerald-300 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-3xl shrink-0">
                  🧪
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-emerald-950">
                    Lab & Test Reports
                  </h2>
                  <p className="text-base font-semibold text-emerald-700 mt-1">
                    Blood tests, ECG, scans, and results
                  </p>
                </div>
              </div>
              <span className="text-3xl text-emerald-700">→</span>
            </Link>

            {/* Giant Action 6: Prescriptions */}
            <Link 
              href="/elder/documents" 
              className="block w-full bg-white rounded-3xl p-7 text-left shadow-sm hover:shadow-md transition-all border-2 border-slate-200 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                  📄
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Prescriptions Vault
                  </h2>
                  <p className="text-base font-semibold text-slate-500 mt-1">
                    Doctor slips and prescriptions
                  </p>
                </div>
              </div>
              <span className="text-3xl text-slate-400">→</span>
            </Link>

            {/* Giant Action 7: Brain Games */}
            <Link 
              href="/elder/games" 
              className="block w-full bg-white rounded-3xl p-7 text-left shadow-sm hover:shadow-md transition-all border-2 border-slate-200 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                  🧩
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Brain Games
                  </h2>
                  <p className="text-base font-semibold text-slate-500 mt-1">
                    Memory games, puzzles, and fun
                  </p>
                </div>
              </div>
              <span className="text-3xl text-slate-400">→</span>
            </Link>

            {/* Medical Profile Card */}
            <MedicalProfileCard initialProfile={todayData.profile} />
          </div>
        )}

      </main>
    </div>
  )
}
