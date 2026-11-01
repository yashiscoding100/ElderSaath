"use client"

import { useState } from "react"
import { Film, Image as ImageIcon, FileText, Eye, Check, Sparkles, AlertCircle, PlayCircle } from "lucide-react"
import { StartupPopupConfig, StartupPopupType } from "@/lib/startupPopup"

export function StartupPopupManager({ initialConfig }: { initialConfig: StartupPopupConfig }) {
  const [config, setConfig] = useState<StartupPopupConfig>(initialConfig)
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSaveSuccess(false)

    try {
      const res = await fetch("/api/admin/startup-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        const data = await res.json()
        alert("Failed to save: " + (data.message || "Unknown error"))
      }
    } catch (err: any) {
      alert("Network error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (type: StartupPopupType) => {
    if (type === "VIDEO") {
      setConfig({
        ...config,
        type: "VIDEO",
        title: "How ElderSaath Keeps Loved Ones Safe",
        message: "Watch this short guide on how SOS alerts and smart medication reminders work.",
        mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        buttonText: "Got It, Continue",
        buttonLink: ""
      })
    } else if (type === "IMAGE") {
      setConfig({
        ...config,
        type: "IMAGE",
        title: "Diwali Wishes from ElderSaath!",
        message: "Wishing all our elders and families good health, happiness, and safety this festive season.",
        mediaUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop",
        buttonText: "Open App",
        buttonLink: ""
      })
    } else {
      setConfig({
        ...config,
        type: "TEXT",
        title: "Important App Update",
        message: "Our servers have moved to Mumbai for ultra-fast performance. If you have any questions, our support team is available 24/7.",
        mediaUrl: "",
        buttonText: "Continue to Dashboard",
        buttonLink: ""
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              App & Website Startup
            </span>
          </div>
          <h3 className="text-xl font-black tracking-tight text-white">Startup Announcement & Media Modal</h3>
          <p className="text-xs text-slate-300 mt-1">
            Display a video, photo, or important announcement popup every time someone launches the app or website.
          </p>
        </div>

        {/* Master Active Switch */}
        <div className="flex items-center gap-3 bg-white/10 p-2 px-4 rounded-xl backdrop-blur-sm border border-white/10">
          <span className="text-xs font-bold text-white">
            {config.enabled ? "STATUS: ACTIVE" : "STATUS: OFF"}
          </span>
          <button
            type="button"
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${
              config.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                config.enabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {/* Type Selector */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Startup Content Type</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: "TEXT" as StartupPopupType, label: "Text Notice", icon: FileText, desc: "Announcement card" },
              { type: "IMAGE" as StartupPopupType, label: "Photo / Image", icon: ImageIcon, desc: "Banner, poster, greeting" },
              { type: "VIDEO" as StartupPopupType, label: "Video", icon: Film, desc: "YouTube or MP4 video" }
            ].map(item => {
              const isSelected = config.type === item.type
              const Icon = item.icon
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setConfig({ ...config, type: item.type })}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-500"}`} />
                    <span className="font-bold text-sm">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Announcement Title</label>
              <button
                type="button"
                onClick={() => loadExample(config.type)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Load Sample Template
              </button>
            </div>
            <input
              type="text"
              required
              value={config.title}
              onChange={e => setConfig({ ...config, title: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm"
              placeholder="e.g. Welcome to ElderSaath"
            />
          </div>

          {/* Media URL (for IMAGE and VIDEO) */}
          {config.type !== "TEXT" && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {config.type === "VIDEO" ? "Video URL (YouTube link or .mp4 link)" : "Photo / Image URL"}
              </label>
              <input
                type="url"
                required
                value={config.mediaUrl}
                onChange={e => setConfig({ ...config, mediaUrl: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm font-mono"
                placeholder={
                  config.type === "VIDEO"
                    ? "https://www.youtube.com/watch?v=... or https://mysite.com/video.mp4"
                    : "https://images.unsplash.com/... or https://..."
                }
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {config.type === "VIDEO"
                  ? "Paste any standard YouTube watch link or direct MP4 URL. It will autoplay inside the app popup."
                  : "Paste any publicly accessible image link (JPG, PNG, WebP)."}
              </p>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description / Message (Optional)</label>
            <textarea
              rows={3}
              value={config.message}
              onChange={e => setConfig({ ...config, message: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm resize-none"
              placeholder="Enter message details or description..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Button Text</label>
            <input
              type="text"
              value={config.buttonText}
              onChange={e => setConfig({ ...config, buttonText: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm"
              placeholder="e.g. Continue to App"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Button Action Link (Optional)</label>
            <input
              type="text"
              value={config.buttonLink}
              onChange={e => setConfig({ ...config, buttonLink: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm"
              placeholder="Leave empty to just close modal, or e.g. /elder/medications"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition flex items-center gap-2 shadow-sm"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              {previewOpen ? "Hide Preview" : "Live Preview"}
            </button>
            {saveSuccess && (
              <span className="text-emerald-600 text-xs font-bold inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved and live across app & website!
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition shadow-md disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save & Publish"}
          </button>
        </div>
      </form>

      {/* Live Preview Box */}
      {previewOpen && (
        <div className="p-6 bg-slate-950 border-t border-slate-800 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Preview: How Users Will See It On App Launch
          </div>
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 text-left shadow-2xl space-y-3">
            {config.type === "VIDEO" && config.mediaUrl && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-white/50" />
              </div>
            )}
            {config.type === "IMAGE" && config.mediaUrl && (
              <img src={config.mediaUrl} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
            )}
            <h4 className="text-lg font-bold text-white">{config.title || "Announcement Title"}</h4>
            {config.message && <p className="text-xs text-slate-300">{config.message}</p>}
            <button type="button" className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs">
              {config.buttonText || "Continue to App"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
