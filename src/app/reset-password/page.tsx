"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    if (!token) {
      setError("Invalid or missing reset token")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password")
      }
      
      setMessage("Password successfully reset! You can now log in.")
      setTimeout(() => router.push("/login"), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-500 font-bold mb-4">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="text-blue-600 font-bold">Request a new link</Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold">{error}</div>}
      {message && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold">{message}</div>}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">New Password</label>
        <input
          type="password"
          required
          className="text-gray-900 font-bold w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-black text-xl p-4 rounded-xl hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6">
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative">
        <Link href="/login" className="absolute left-6 top-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition" title="Back to Login">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-3xl font-black text-gray-900 text-center mb-2">Set New Password</h2>
        <p className="text-gray-500 text-center mb-8">Please enter your new password</p>
        
        <Suspense fallback={<div>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
