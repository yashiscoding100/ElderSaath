"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, Square, Upload, Volume2, FileText, RotateCcw, Loader2, Trash2 } from "lucide-react"

export interface SpecialNoticeState {
  enabled: boolean
  type: "TEXT" | "VOICE"
  text: string
  audioUrl: string
  audioName: string
  maxCount: number
  shownCount?: number
  resetCount?: boolean
}

function encodeWavFromFloat32(samples: Float32Array, sourceSampleRate: number): Blob {
  // Downsample to 16 kHz mono PCM for compact size (~32 KB/sec) & universal Android MediaPlayer support
  const targetSampleRate = 16000
  const ratio = sourceSampleRate / targetSampleRate
  const newLength = Math.max(1, Math.round(samples.length / ratio))
  const pcm = new Int16Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIdx = Math.min(samples.length - 1, Math.floor(i * ratio))
    const clamped = Math.max(-1, Math.min(1, samples[srcIdx]))
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + pcm.length * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true) // NumChannels (1 = Mono)
  view.setUint32(24, targetSampleRate, true)
  view.setUint32(28, targetSampleRate * 2, true) // ByteRate
  view.setUint16(32, 2, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample
  writeString(36, "data")
  view.setUint32(40, pcm.length * 2, true)

  let offset = 44
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true)
  }

  return new Blob([view], { type: "audio/wav" })
}

export function SpecialNoticeEditor({
  value,
  onChange,
  isEdit = false
}: {
  value: SpecialNoticeState
  onChange: (next: SpecialNoticeState) => void
  isEdit?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const recordCleanupRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recordCleanupRef.current) recordCleanupRef.current()
    }
  }, [])

  const uploadAudioBlob = async (file: File) => {
    setUploading(true)
    setErrorMsg(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/medications/notice-upload", {
        method: "POST",
        body: fd
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        throw new Error(data.message || "Audio upload failed")
      }
      onChange({
        ...value,
        type: "VOICE",
        audioUrl: data.url,
        audioName: data.filename || file.name
      })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload audio")
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) {
      uploadAudioBlob(file)
    }
  }

  const startRecording = async () => {
    setErrorMsg(null)
    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMsg("Microphone recording is not available in this browser. Please upload an audio file instead.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) {
        setErrorMsg("Audio recording is not supported on this browser.")
        stream.getTracks().forEach(t => t.stop())
        return
      }
      const audioCtx = new AudioCtx()
      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []
      let totalLength = 0

      processor.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0)
        const copy = new Float32Array(input.length)
        copy.set(input)
        chunks.push(copy)
        totalLength += copy.length
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)

      setRecording(true)
      setRecordSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1)
      }, 1000)

      recordCleanupRef.current = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        try { processor.disconnect() } catch {}
        try { source.disconnect() } catch {}
        try { stream.getTracks().forEach(t => t.stop()) } catch {}
        const sampleRate = audioCtx.sampleRate || 44100
        try { audioCtx.close() } catch {}

        if (totalLength > 0) {
          const merged = new Float32Array(totalLength)
          let pos = 0
          for (const c of chunks) {
            merged.set(c, pos)
            pos += c.length
          }
          const wavBlob = encodeWavFromFloat32(merged, sampleRate)
          const wavFile = new File([wavBlob], `voice-notice-${Date.now()}.wav`, { type: "audio/wav" })
          uploadAudioBlob(wavFile)
        }
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not access microphone. Please allow microphone permission or upload an audio file."
      )
    }
  }

  const stopRecording = () => {
    setRecording(false)
    if (recordCleanupRef.current) {
      const fn = recordCleanupRef.current
      recordCleanupRef.current = null
      fn()
    }
  }

  const shownCount = value.shownCount ?? 0
  const maxCount = value.maxCount || 5
  const completed = isEdit && value.enabled && shownCount >= maxCount && !value.resetCount

  return (
    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📢</span>
          <div>
            <label className="block text-xs font-bold text-slate-900">
              Special Post-Alarm Notice (Optional)
            </label>
            <p className="text-[11px] text-slate-600 leading-snug">
              Shows text or plays a voice note right after pressing &quot;Take Medicine&quot; for a set number of times.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
            value.enabled ? "bg-amber-600" : "bg-slate-300"
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
              value.enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {value.enabled && (
        <div className="pt-2.5 border-t border-amber-200/70 space-y-3">
          {/* Edit progress indicator */}
          {isEdit && (
            <div className="flex items-center justify-between gap-2 bg-white/90 px-3 py-2 rounded-lg border border-amber-200">
              <div className="text-xs font-bold text-slate-800">
                {completed ? (
                  <span className="text-emerald-700">✓ Completed ({shownCount}/{maxCount} times shown — auto-stopped)</span>
                ) : (
                  <span>Progress: <span className="text-amber-700">{value.resetCount ? 0 : shownCount} / {maxCount}</span> times shown</span>
                )}
              </div>
              {shownCount > 0 && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(value.resetCount)}
                    onChange={(e) => onChange({ ...value, resetCount: e.target.checked })}
                    className="rounded border-amber-400 text-amber-600"
                  />
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to 0</span>
                </label>
              )}
            </div>
          )}

          {/* Mode Selector: TEXT or VOICE */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notice Type (Choose One)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, type: "TEXT" })}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition ${
                  value.type === "TEXT"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Text Notice</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, type: "VOICE" })}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition ${
                  value.type === "VOICE"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice / Audio Notice</span>
              </button>
            </div>
          </div>

          {/* Text Notice Input */}
          {value.type === "TEXT" ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Notice Text Shown After Stopping Alarm
              </label>
              <textarea
                rows={3}
                required={value.enabled && value.type === "TEXT"}
                placeholder="e.g. Remember that Coegmenlin has both 5mg and 10mg medicine. Right now you have to take the 5mg tablet after breakfast."
                className="w-full bg-white border border-amber-300 p-2.5 rounded-lg text-slate-900 font-medium text-xs outline-none focus:ring-2 focus:ring-amber-400"
                value={value.text}
                onChange={(e) => onChange({ ...value, text: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Upload Audio File or Record Voice Message
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={uploading || recording}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg text-xs font-bold text-slate-800 transition disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Upload className="w-3.5 h-3.5 text-amber-600" />}
                  <span>{uploading ? "Uploading..." : "Upload Audio"}</span>
                </button>

                {!recording ? (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={startRecording}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold text-rose-700 transition disabled:opacity-50"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Record Voice</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600 text-white rounded-lg text-xs font-bold animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop ({recordSeconds}s)</span>
                  </button>
                )}
              </div>

              {errorMsg && (
                <p className="text-[11px] text-rose-700 font-semibold bg-rose-50 border border-rose-200 p-2 rounded-lg">
                  {errorMsg}
                </p>
              )}

              {value.audioUrl && (
                <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-emerald-800 truncate">
                      🎙️ {value.audioName || "Uploaded Voice Notice"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, audioUrl: "", audioName: "" })}
                      className="text-rose-600 hover:text-rose-800 p-1 rounded"
                      title="Remove audio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <audio controls src={value.audioUrl} className="w-full h-8" />
                </div>
              )}
              {value.enabled && value.type === "VOICE" && !value.audioUrl && !uploading && (
                <p className="text-[11px] text-amber-800 font-medium">
                  Please upload an audio file (MP3, WAV, M4A, OGG) or record a voice notice above.
                </p>
              )}
            </div>
          )}

          {/* Repeat Count */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Show For How Many Alarm Responses?
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={500}
                required={value.enabled}
                value={value.maxCount}
                onChange={(e) => onChange({ ...value, maxCount: Math.max(1, Number(e.target.value) || 1) })}
                className="w-24 bg-white border border-amber-300 p-2 rounded-lg text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {[3, 5, 7, 10].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onChange({ ...value, maxCount: cnt })}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                      value.maxCount === cnt
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-amber-900/90 mt-1.5 font-medium leading-relaxed">
              This notice will show after pressing &quot;Take Medicine&quot; <strong>{value.maxCount} time{value.maxCount === 1 ? "" : "s"}</strong>, then automatically stop so future alarms work normally. Stored in phone memory.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
