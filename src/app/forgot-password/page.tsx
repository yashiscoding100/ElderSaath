"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to process request")
      }
      
      setMessage(data.message) // In a real app, this says "Email sent". Here, it might contain the link for demo purposes.
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6">
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative">
        <Link href="/login" className="absolute left-6 top-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition" title="Back to Login">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-3xl font-black text-gray-900 text-center mb-2">Reset Password</h2>
        <p className="text-gray-500 text-center mb-8">Enter your email to receive a reset link</p>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold">{error}</div>}
        {message && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-6 font-bold break-all">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              required
              className="text-gray-900 font-bold w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-black text-xl p-4 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-blue-600 font-bold hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
