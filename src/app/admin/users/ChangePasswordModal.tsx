"use client"

import { useState } from "react"
import { KeyRound, Eye, EyeOff, Sparkles, Copy, Check, BellRing } from "lucide-react"

type User = {
  id: string
  name: string | null
  email: string | null
  role: string
}

export function ChangePasswordModal({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const generateEasyPassword = () => {
    const prefixes = ["Care", "Elder", "Safe", "Health", "Saath", "Family"]
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const randomNum = Math.floor(100 + Math.random() * 900)
    const generated = `${randomPrefix}@${randomNum}`
    setNewPassword(generated)
  }

  const handleCopy = () => {
    if (!newPassword) return
    navigator.clipboard.writeText(newPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setStatusMessage(null)

    try {
      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          newPassword
        })
      })

      const data = await res.json()

      if (res.ok) {
        setStatusMessage({
          text: `Success! Password changed. A notification has been sent to ${user.name || user.email}'s phone!`,
          type: "success"
        })
      } else {
        setStatusMessage({
          text: data.message || "Failed to change password",
          type: "error"
        })
      }
    } catch (err: any) {
      setStatusMessage({
        text: "Network error: " + err.message,
        type: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          setStatusMessage(null)
          if (!newPassword) generateEasyPassword()
        }}
        className="inline-flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-md transition text-purple-700 bg-purple-50 hover:bg-purple-100"
        title="Admin Password Reset & Phone Alert"
      >
        <KeyRound className="w-3.5 h-3.5" />
        Password
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Change Password</h3>
                  <p className="text-xs text-slate-500">{user.name || "User"} ({user.email})</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Notice to Admin */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <BellRing className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Automatic Phone Notification:</span>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    Changing this password will immediately update the database and send a push notification to this user&apos;s phone stating their password was updated and to call the admin to receive it.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-slate-700">New Password</label>
                  <button
                    type="button"
                    onClick={generateEasyPassword}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate Easy
                  </button>
                </div>
                
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-slate-900 font-bold tracking-wide"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Copy to clipboard"
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {copied && <span className="text-[11px] text-emerald-600 font-semibold block mt-1">Copied to clipboard! Ready to tell the elder over call.</span>}
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  statusMessage.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {statusMessage.text}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 font-bold text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition shadow-md disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update & Notify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
