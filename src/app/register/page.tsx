"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CHILD", // Default
  })
  const [error, setError] = useState("")
  const [googleError, setGoogleError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        let errorMsg = "Registration failed"
        try {
          const data = await res.json()
          errorMsg = data.message || errorMsg
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg)
      }

      router.push("/login")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 relative">
        <Link href="/login" className="absolute left-6 top-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition" title="Back to Login">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Elder Saath</h1>
          <p className="text-gray-700 mt-2 font-medium">Because distance shouldn't mean less care.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-400 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-400 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-400 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">I am signing up as:</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={`py-3 px-4 rounded-lg border-2 flex items-center justify-center transition-colors font-bold ${
                  formData.role === "CHILD"
                    ? "border-blue-600 bg-blue-100 text-blue-900"
                    : "border-gray-400 text-gray-900 hover:bg-gray-100"
                }`}
                onClick={() => setFormData({ ...formData, role: "CHILD" })}
              >
                Family Member
              </button>
              <button
                type="button"
                className={`py-3 px-4 rounded-lg border-2 flex items-center justify-center transition-colors font-bold ${
                  formData.role === "ELDER"
                    ? "border-blue-600 bg-blue-100 text-blue-900"
                    : "border-gray-400 text-gray-900 hover:bg-gray-100"
                }`}
                onClick={() => setFormData({ ...formData, role: "ELDER" })}
              >
                Elder
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition-colors disabled:opacity-50 text-lg"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <hr className="w-full border-gray-300" />
          <span className="px-3 text-gray-500 font-bold text-sm">OR</span>
          <hr className="w-full border-gray-300" />
        </div>

        <button
          type="button"
          onClick={() => setGoogleError("Continue with Google is under maintenance right now.")}
          className="w-full mt-6 bg-white border-2 border-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        {googleError && (
          <p className="text-red-500 text-sm font-semibold mt-2 text-center">
            {googleError}
          </p>
        )}

        <p className="text-center mt-6 text-gray-800 text-base font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
