"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [googleError, setGoogleError] = useState("")
  const [loading, setLoading] = useState(false)
  const [autoLoggingIn, setAutoLoggingIn] = useState(true)
  const [demoActive, setDemoActive] = useState(true)

  // Fetch whether demo mode is enabled by Admin
  useEffect(() => {
    fetch("/api/demo/status")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.enabled === "boolean") {
          setDemoActive(data.enabled)
        }
      })
      .catch(() => {})
  }, [])

  // Auto-login logic for Capacitor persistent sessions
  useEffect(() => {
    // Only attempt auto-login if URL doesn't have ?fresh=true or ?logout=true
    if (typeof window !== "undefined" && window.location.search.includes("fresh=true")) {
      localStorage.removeItem("es_persistent_email")
      localStorage.removeItem("es_persistent_password")
      setAutoLoggingIn(false)
      return
    }

    const savedEmail = localStorage.getItem("es_persistent_email")
    const savedPassword = localStorage.getItem("es_persistent_password")
    
    if (savedEmail && savedPassword) {
      setLoading(true)
      signIn("credentials", {
        redirect: false,
        email: savedEmail,
        password: savedPassword,
      }).then((res) => {
        if (!res?.error) {
          router.push("/dashboard")
          router.refresh()
        } else {
          // If credentials became invalid (e.g. database migration or wiped account), clear them
          localStorage.removeItem("es_persistent_email")
          localStorage.removeItem("es_persistent_password")
          setAutoLoggingIn(false)
          setLoading(false)
        }
      }).catch(() => {
        localStorage.removeItem("es_persistent_email")
        localStorage.removeItem("es_persistent_password")
        setAutoLoggingIn(false)
        setLoading(false)
      })
    } else {
      setAutoLoggingIn(false)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: formData.email,
        password: formData.password,
      })

      if (res?.error) {
        setError("Invalid email or password")
        setLoading(false)
        return
      }

      // Save for native app persistence
      localStorage.setItem("es_persistent_email", formData.email)
      localStorage.setItem("es_persistent_password", formData.password)

      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  if (autoLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">ES</span>
          </div>
          <p className="text-slate-500 font-bold">Restoring your session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Column: Visual/Brand (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 opacity-90 z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center z-0 opacity-40 mix-blend-overlay" />
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSLCAyNTUsIDAuMSkiLz48L3N2Zz4=')] z-10" />

        <div className="relative z-20 p-12 text-white max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">ES</span>
            </div>
            <span className="text-2xl font-black tracking-tight">ElderSaath</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
            Because distance shouldn&apos;t mean less care.
          </h1>
          <p className="text-lg text-blue-100 font-medium leading-relaxed">
            Stay instantly connected to your elderly loved ones. Monitor health vitals, manage medications, and coordinate a secure care network—all in one place.
          </p>
          
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-slate-50 relative">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 relative z-10">
          
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ES</span>
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">ElderSaath</span>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 mt-2 font-medium text-sm">Please enter your details to sign in.</p>
          </div>

          {/* RECRUITER / EVALUATOR DEMO LINK */}
          {demoActive && (
            <div className="mb-6">
              <Link
                href="/demo"
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-900 font-bold">Viewing as an Evaluator or Recruiter?</span>
                </div>
                <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Launch Demo <span aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50/50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-semibold flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter your email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-sm text-blue-600 font-bold hover:text-blue-700 transition">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-600/20 active:scale-[0.98] mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 relative flex items-center justify-center">
            <hr className="w-full border-slate-200" />
            <span className="absolute px-4 bg-white text-slate-400 font-bold text-xs uppercase tracking-wider">Or continue with</span>
          </div>

          <button
            type="button"
            onClick={() => setGoogleError("Continue with Google is under maintenance right now.")}
            className="w-full mt-8 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          {googleError && (
            <p className="text-red-500 text-sm font-semibold mt-2 text-center">
              {googleError}
            </p>
          )}

          <p className="text-center mt-8 text-slate-600 text-sm font-medium">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 hover:underline font-bold transition">
              Create one for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
