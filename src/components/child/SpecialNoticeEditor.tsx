"use client"

import { useState, useRef, useEffect } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { Mic, Square, Upload, Volume2, FileText, RotateCcw, Loader2, Trash2, Settings } from "lucide-react"

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

interface MicPermissionResult {
  granted?: boolean
  declared?: boolean
  status?: string
}

interface AppPermissionsPlugin {
  requestMicrophonePermission?: () => Promise<MicPermissionResult>
  openAppSettings?: () => Promise<void>
}

const AppPermissions = registerPlugin<AppPermissionsPlugin>("AppPermissions")

// Stay safely below Vercel's 4.5 MB limit even when base64-encoded inside JSON (~1.34x overhead)
const MAX_RAW_AUDIO_BYTES = Math.floor(2.8 * 1024 * 1024)
const MAX_CLIENT_DECODE_BYTES = 25 * 1024 * 1024

function encodeWavFromFloat32(samples: Float32Array, sourceSampleRate: number): Uint8Array {
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

  return new Uint8Array(buffer)
}

function normalizeAudioMime(rawMime: string | undefined, filename: string): string {
  const clean = (rawMime || "").split(";")[0].trim().toLowerCase()
  if (clean.startsWith("audio/")) {
    if (clean === "audio/mp3") return "audio/mpeg"
    if (clean === "audio/x-wav" || clean === "audio/wave") return "audio/wav"
    if (clean === "audio/x-m4a") return "audio/mp4"
    return clean
  }
  const lower = filename.toLowerCase()
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "audio/ogg"
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4"
  if (lower.endsWith(".aac")) return "audio/aac"
  if (lower.endsWith(".webm")) return "audio/webm"
  if (lower.endsWith(".3gp")) return "audio/3gpp"
  if (lower.endsWith(".amr")) return "audio/amr"
  if (lower.endsWith(".flac")) return "audio/flac"
  return "audio/mpeg"
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().catch(() => {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(reader.result)
          else reject(new Error("Could not read audio bytes"))
        }
        reader.onerror = () => reject(reader.error || new Error("Failed to read audio file"))
        reader.readAsArrayBuffer(file)
      })
    })
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new Error("Could not read audio bytes"))
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio file"))
    reader.readAsArrayBuffer(file)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Could not encode audio file"))
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to encode audio data"))
    reader.readAsDataURL(blob)
  })
}

async function compactAudioToWavIfPossible(rawBuffer: ArrayBuffer, originalName: string): Promise<{ bytes: Uint8Array; filename: string; mimeType: string } | null> {
  if (rawBuffer.byteLength > MAX_CLIENT_DECODE_BYTES) return null
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  const ctx = new AudioCtx()
  try {
    const decoded = await ctx.decodeAudioData(rawBuffer.slice(0))
    const length = decoded.length
    const channelCount = Math.max(1, decoded.numberOfChannels)
    const mono = new Float32Array(length)
    for (let ch = 0; ch < channelCount; ch++) {
      const chData = decoded.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        mono[i] += chData[i] / channelCount
      }
    }
    const wavBytes = encodeWavFromFloat32(mono, decoded.sampleRate)
    const baseName = originalName.replace(/\.[^/.]+$/, "") || "voice-notice"
    return {
      bytes: wavBytes,
      filename: `${baseName}.wav`,
      mimeType: "audio/wav"
    }
  } catch {
    return null
  } finally {
    try {
      await ctx.close()
    } catch {}
  }
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
  const [showOpenSettings, setShowOpenSettings] = useState(false)

  const recordCleanupRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const latestValueRef = useRef(value)
  const latestOnChangeRef = useRef(onChange)
  useEffect(() => {
    latestValueRef.current = value
    latestOnChangeRef.current = onChange
  }, [value, onChange])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recordCleanupRef.current) recordCleanupRef.current()
    }
  }, [])

  const uploadAudioBytes = async (rawBytes: Uint8Array, filename: string, mimeType: string) => {
    setUploading(true)
    setErrorMsg(null)
    setShowOpenSettings(false)
    try {
      if (rawBytes.byteLength === 0) {
        throw new Error("Selected audio file is empty (0 bytes).")
      }

      const safeMime = normalizeAudioMime(mimeType, filename)
      const safeName = filename || "voice-notice.wav"
      const arrayBuf = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength) as ArrayBuffer
      const dataUrl = await blobToDataUrl(new Blob([arrayBuf], { type: safeMime }))

      const res = await fetch("/api/medications/notice-upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: safeName,
          mimeType: safeMime,
          dataUrl
        })
      })

      const rawText = await res.text()
      let data: { url?: string; filename?: string; message?: string } = {}
      try {
        data = JSON.parse(rawText) as { url?: string; filename?: string; message?: string }
      } catch {}

      if (!res.ok || !data.url) {
        if (res.status === 413) {
          throw new Error("Audio file is too large for upload (max 2.8 MB). Please choose or record a shorter voice note.")
        }
        const detail = data.message || (rawText && !rawText.startsWith("<") ? rawText.slice(0, 140) : `HTTP ${res.status}`)
        throw new Error(detail || "Audio upload failed")
      }

      latestOnChangeRef.current({
        ...latestValueRef.current,
        type: "VOICE",
        audioUrl: data.url,
        audioName: data.filename || safeName
      })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload audio")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setErrorMsg(null)
    setShowOpenSettings(false)

    try {
      // Read bytes BEFORE resetting the file input so Android WebView content:// URIs never get invalidated
      const rawBuffer = await readFileBytes(file)
      if (rawBuffer.byteLength === 0) {
        throw new Error("Could not read audio file (0 bytes). Try saving the file to Downloads and selecting it again.")
      }

      let uploadBytes: Uint8Array = new Uint8Array(rawBuffer)
      let uploadName = file.name || "voice-notice.mp3"
      let uploadMime = normalizeAudioMime(file.type, uploadName)

      if (uploadBytes.byteLength > MAX_RAW_AUDIO_BYTES) {
        const compacted = await compactAudioToWavIfPossible(rawBuffer, uploadName)
        if (compacted && compacted.bytes.byteLength <= MAX_RAW_AUDIO_BYTES) {
          uploadBytes = compacted.bytes
          uploadName = compacted.filename
          uploadMime = compacted.mimeType
        } else {
          const mb = (rawBuffer.byteLength / (1024 * 1024)).toFixed(1)
          throw new Error(`Audio file is ${mb} MB (max 2.8 MB / ~90s). Please upload a shorter clip or use Record Voice.`)
        }
      }

      await uploadAudioBytes(uploadBytes, uploadName, uploadMime)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to read or upload audio file")
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleOpenSettings = async () => {
    try {
      await AppPermissions.openAppSettings?.()
    } catch {}
  }

  const startRecording = async () => {
    setErrorMsg(null)
    setShowOpenSettings(false)

    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      try {
        if (typeof AppPermissions.requestMicrophonePermission === "function") {
          const perm = await AppPermissions.requestMicrophonePermission()
          if (perm && perm.declared === false) {
            setErrorMsg(
              "Microphone permission is not enabled in this installed Android APK. Please install the updated ElderSaath APK or use Upload Audio."
            )
            return
          }
          if (perm && perm.granted === false) {
            setShowOpenSettings(true)
            setErrorMsg(
              "Microphone permission was denied. Tap 'Open App Settings' below, allow Microphone access, and try again."
            )
            return
          }
        }
      } catch (permErr: unknown) {
        const permMsg = permErr instanceof Error ? permErr.message : String(permErr)
        if (!/not implemented|unimplemented/i.test(permMsg)) {
          console.warn("[SpecialNoticeEditor] requestMicrophonePermission warning:", permMsg)
        }
      }
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMsg("Microphone recording is not available in this browser. Please use Upload Audio instead.")
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
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {})
      }

      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      const zeroGain = audioCtx.createGain()
      zeroGain.gain.value = 0

      const chunks: Float32Array[] = []
      let totalLength = 0

      processor.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0)
        const copy = new Float32Array(input.length)
        copy.set(input)
        chunks.push(copy)
        totalLength += copy.length
        const out = ev.outputBuffer.getChannelData(0)
        out.fill(0)
      }

      source.connect(processor)
      processor.connect(zeroGain)
      zeroGain.connect(audioCtx.destination)

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
        try { zeroGain.disconnect() } catch {}
        try { source.disconnect() } catch {}
        try { stream.getTracks().forEach(t => t.stop()) } catch {}
        const sampleRate = audioCtx.sampleRate || 44100
        try { audioCtx.close() } catch {}

        if (totalLength === 0) {
          setErrorMsg("No audio captured. Please hold for at least 1 second and ensure Microphone access is allowed.")
          return
        }

        const merged = new Float32Array(totalLength)
        let pos = 0
        for (const c of chunks) {
          merged.set(c, pos)
          pos += c.length
        }
        const wavBytes = encodeWavFromFloat32(merged, sampleRate)
        if (wavBytes.byteLength > MAX_RAW_AUDIO_BYTES) {
          setErrorMsg("Recorded clip is longer than ~90 seconds (max 2.8 MB). Please record a shorter voice notice.")
          return
        }
        void uploadAudioBytes(wavBytes, `voice-notice-${Date.now()}.wav`, "audio/wav")
      }
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : ""
      const errText = err instanceof Error ? err.message : String(err)
      const isDenied =
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError" ||
        /permission denied|not allowed/i.test(errText)

      if (isDenied) {
        if (isNative) {
          setShowOpenSettings(true)
          setErrorMsg(
            "Microphone permission denied on this device. Tap 'Open App Settings' to enable Microphone (or update the ElderSaath APK if Microphone is not listed)."
          )
        } else {
          setErrorMsg(
            "Microphone permission denied in browser. Allow Microphone permission in site settings or upload an audio file instead."
          )
        }
      } else {
        setErrorMsg(
          errText || "Could not access microphone. Please allow microphone permission or upload an audio file."
        )
      }
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
                onClick={() => {
                  setErrorMsg(null)
                  setShowOpenSettings(false)
                  onChange({ ...value, type: "TEXT" })
                }}
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
                onClick={() => {
                  setErrorMsg(null)
                  setShowOpenSettings(false)
                  onChange({ ...value, type: "VOICE" })
                }}
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
                accept="audio/*,.mp3,.wav,.ogg,.opus,.m4a,.aac,.3gp,.amr,.webm,.flac"
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
                <div className="text-[11px] text-rose-700 font-semibold bg-rose-50 border border-rose-200 p-2.5 rounded-lg space-y-2">
                  <p>{errorMsg}</p>
                  {showOpenSettings && (
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-[11px] transition"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Open App Settings</span>
                    </button>
                  )}
                </div>
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
                  Please upload an audio file (MP3, WAV, M4A, OGG — max 2.8 MB) or record a voice notice above.
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
