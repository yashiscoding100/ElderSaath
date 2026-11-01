"use client"

import { useState } from "react"
import { Film, Image as ImageIcon, FileText, Eye, Check, Sparkles, AlertCircle, PlayCircle, Power, Loader2 } from "lucide-react"
import { StartupPopupConfig, StartupPopupType } from "@/lib/startupPopup"

export function StartupPopupManager({ initialConfig }: { initialConfig: StartupPopupConfig }) {
  const [config, setConfig] = useState<StartupPopupConfig>(initialConfig)
  const [loading, setLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toggleNotice, setToggleNotice] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Instant 1-Click Power Toggle (persists directly to server)
  const handleTogglePower = async (forcedState?: boolean) => {
    const nextState = typeof forcedState === "boolean" ? forcedState : !config.enabled
    setToggleLoading(true)
    setToggleNotice(null)

    try {
      const res = await fetch("/api/admin/startup-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState })
      })

      if (res.ok) {
        const data = await res.json()
        setConfig(prev => ({ ...prev, enabled: nextState }))
        setToggleNotice(
          nextState
            ? "🟢 Startup Announcement is now ENABLED! It will play/display every time users open the app or website."
            : "⚪ Startup Announcement is now DISABLED (OFF). App and website open directly without any popups."
        )
        setTimeout(() => setToggleNotice(null), 5000)
      } else {
        const data = await res.json()
        alert("Failed to toggle status: " + (data.message || "Unknown error"))
      }
    } catch (err: any) {
      alert("Network error: " + err.message)
    } finally {
      setToggleLoading(false)
    }
  }

  // Save Content Details (Title, Media URL, Message, Buttons)
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
        setTimeout(() => setSaveSuccess(false), 4000)
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
      setConfig(prev => ({
        ...prev,
        type: "VIDEO",
        title: "How ElderSaath Keeps Loved Ones Safe",
        message: "Watch this short guide on how SOS alerts and smart medication reminders work.",
        mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        buttonText: "Got It, Continue",
        buttonLink: ""
      }))
    } else if (type === "IMAGE") {
      setConfig(prev => ({
        ...prev,
        type: "IMAGE",
        title: "Diwali Wishes from ElderSaath!",
        message: "Wishing all our elders and families good health, happiness, and safety this festive season.",
        mediaUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop",
        buttonText: "Open App",
        buttonLink: ""
      }))
    } else {
      setConfig(prev => ({
        ...prev,
        type: "TEXT",
        title: "Important App Update",
        message: "Our servers have moved to Mumbai for ultra-fast performance. If you have any questions, our support team is available 24/7.",
        mediaUrl: "",
        buttonText: "Continue to Dashboard",
        buttonLink: ""
      }))
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              Admin Control Center
            </span>
          </div>
          <h3 className="text-xl font-black tracking-tight text-white">Startup Announcement & Media Modal</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Admin has master power to enable or disable this popup at any time. When enabled, your chosen video, photo, or notice pops up on every launch.
          </p>
        </div>

        {/* Master Quick Switch in Header */}
        <div className="flex items-center gap-3 bg-white/10 p-2.5 px-4 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Power Switch</div>
            <div className={`text-xs font-black ${config.enabled ? "text-emerald-300" : "text-slate-400"}`}>
              {config.enabled ? "LIVE & ACTIVE" : "DISABLED (OFF)"}
            </div>
          </div>
          <button
            type="button"
            disabled={toggleLoading}
            onClick={() => handleTogglePower()}
            title={config.enabled ? "Click to Disable Startup Popup" : "Click to Enable Startup Popup"}
            className={`w-14 h-7 rounded-full relative transition-colors focus:outline-none disabled:opacity-50 ${
              config.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md flex items-center justify-center transition-transform ${
                config.enabled ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {toggleLoading ? (
                <Loader2 className="w-3 h-3 text-slate-700 animate-spin" />
              ) : (
                <Power className={`w-3 h-3 ${config.enabled ? "text-emerald-600" : "text-slate-400"}`} />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Prominent High-Visibility Status & Power Banner */}
      <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
        config.enabled
          ? "bg-emerald-50/70 border-emerald-200"
          : "bg-slate-100/70 border-slate-200"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
            config.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}>
            <Power className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                config.enabled ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              }`} />
              <h4 className={`text-sm font-black tracking-tight ${
                config.enabled ? "text-emerald-950" : "text-slate-900"
              }`}>
                {config.enabled
                  ? "POPUP STATUS: ENABLED & ACTIVE ON ALL DEVICES"
                  : "POPUP STATUS: CURRENTLY DISABLED (OFF)"}
              </h4>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {config.enabled
                ? "Every time any elder, child, or visitor opens the Android app, iOS app, or website, this popup will appear."
                : "The app and website will open directly without showing any startup announcement, photo, or video."}
            </p>
          </div>
        </div>

        {/* Big 1-Click Toggle Button */}
        <button
          type="button"
          disabled={toggleLoading}
          onClick={() => handleTogglePower()}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 self-start md:self-auto shrink-0 disabled:opacity-50 ${
            config.enabled
              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
          }`}
        >
          {toggleLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating Status...</span>
            </>
          ) : config.enabled ? (
            <>
              <Power className="w-4 h-4" />
              <span>Turn OFF / Disable Popup</span>
            </>
          ) : (
            <>
              <Power className="w-4 h-4" />
              <span>Turn ON / Enable Popup</span>
            </>
          )}
        </button>
      </div>

      {toggleNotice && (
        <div className={`p-4 border-b text-xs font-bold ${
          config.enabled
            ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
            : "bg-slate-200/80 border-slate-300 text-slate-800"
        }`}>
          {toggleNotice}
        </div>
      )}

      {/* Content Customization Form */}
      <form onSubmit={handleSave} className="p-6 space-y-6">
        {/* Type Selector */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Startup Media Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: "TEXT" as StartupPopupType, label: "Text Notice", icon: FileText, desc: "Announcement card" },
              { type: "IMAGE" as StartupPopupType, label: "Photo / Poster", icon: ImageIcon, desc: "Banner, poster, greeting image" },
              { type: "VIDEO" as StartupPopupType, label: "Video", icon: Film, desc: "YouTube link or direct MP4 video" }
            ].map(item => {
              const isSelected = config.type === item.type
              const Icon = item.icon
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, type: item.type }))}
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
              onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
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
                onChange={e => setConfig(prev => ({ ...prev, mediaUrl: e.target.value }))}
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
              onChange={e => setConfig(prev => ({ ...prev, message: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-900 text-sm resize-none"
              placeholder="Enter message details or description..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Button Text</label>
            <input
              type="text"
              value={config.buttonText}
              onChange={e => setConfig(prev => ({ ...prev, buttonText: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm"
              placeholder="e.g. Continue to App"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Button Action Link (Optional)</label>
            <input
              type="text"
              value={config.buttonLink}
              onChange={e => setConfig(prev => ({ ...prev, buttonLink: e.target.value }))}
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
                <Check className="w-4 h-4" /> Content updated and saved successfully!
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Saving Content..." : "Save & Publish Content"}
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
