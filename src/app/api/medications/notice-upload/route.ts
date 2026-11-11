import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { put } from "@vercel/blob"

export const dynamic = "force-dynamic"

const MAX_BINARY_BYTES = 4.5 * 1024 * 1024

function detectAudioMime(rawMime: string | null | undefined, filename: string): string {
  const lowerMime = (rawMime || "").split(";")[0].trim().toLowerCase()
  const lowerName = filename.toLowerCase()

  if (lowerMime.startsWith("audio/")) {
    if (lowerMime === "audio/mp3") return "audio/mpeg"
    if (lowerMime === "audio/x-wav" || lowerMime === "audio/wave") return "audio/wav"
    if (lowerMime === "audio/x-m4a") return "audio/mp4"
    return lowerMime
  }

  if (lowerName.endsWith(".wav")) return "audio/wav"
  if (lowerName.endsWith(".ogg") || lowerName.endsWith(".opus")) return "audio/ogg"
  if (lowerName.endsWith(".m4a") || lowerName.endsWith(".mp4")) return "audio/mp4"
  if (lowerName.endsWith(".aac")) return "audio/aac"
  if (lowerName.endsWith(".webm")) return "audio/webm"
  if (lowerName.endsWith(".3gp")) return "audio/3gpp"
  if (lowerName.endsWith(".amr")) return "audio/amr"
  if (lowerName.endsWith(".flac")) return "audio/flac"
  return "audio/mpeg"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user.role !== "CHILD" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ message: "Unauthorized - Caregiver account required" }, { status: 401 })
  }

  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase()

    let buffer: Buffer
    let rawFilename = "voice-notice.wav"
    let rawMime = ""

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        filename?: unknown
        mimeType?: unknown
        dataUrl?: unknown
        base64?: unknown
      }

      rawFilename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : "voice-notice.wav"
      rawMime = typeof body.mimeType === "string" ? body.mimeType : ""

      let base64Payload = ""
      if (typeof body.dataUrl === "string" && body.dataUrl.trim()) {
        const match = body.dataUrl.trim().match(/^data:([^;,]*)(?:;[^,]*)?;base64,(.+)$/)
        if (match) {
          if (!rawMime && match[1]) rawMime = match[1]
          base64Payload = match[2]
        } else {
          const commaIdx = body.dataUrl.indexOf(",")
          base64Payload = commaIdx >= 0 ? body.dataUrl.slice(commaIdx + 1) : body.dataUrl
        }
      } else if (typeof body.base64 === "string" && body.base64.trim()) {
        base64Payload = body.base64.trim()
      }

      if (!base64Payload) {
        return NextResponse.json({ message: "No audio data provided" }, { status: 400 })
      }

      buffer = Buffer.from(base64Payload, "base64")
    } else {
      const formData = await req.formData()
      const file = formData.get("file")

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ message: "No audio file provided" }, { status: 400 })
      }

      rawFilename = "name" in file && typeof file.name === "string" && file.name ? file.name : "voice-notice.wav"
      rawMime = file.type || ""

      if (file.size > MAX_BINARY_BYTES) {
        return NextResponse.json(
          { message: "Audio file exceeds 4.5 MB limit. Please upload or record a shorter voice notice." },
          { status: 400 }
        )
      }

      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    if (buffer.length === 0) {
      return NextResponse.json({ message: "Uploaded audio file is empty (0 bytes)." }, { status: 400 })
    }

    if (buffer.length > MAX_BINARY_BYTES) {
      return NextResponse.json(
        { message: "Audio file exceeds 4.5 MB limit. Please upload or record a shorter voice notice." },
        { status: 400 }
      )
    }

    const cleanName = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `med-notice-${Date.now()}-${cleanName}`
    const detectedMime = detectAudioMime(rawMime, cleanName)

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: detectedMime
        })
        return NextResponse.json(
          {
            url: blob.url,
            filename: cleanName,
            size: buffer.length,
            storage: "Vercel Blob CDN"
          },
          { status: 200 }
        )
      } catch (blobErr: unknown) {
        const msg = blobErr instanceof Error ? blobErr.message : String(blobErr)
        console.warn("[notice-upload] Vercel Blob upload failed, falling back to Data URL:", msg)
      }
    }

    const base64 = buffer.toString("base64")
    const dataUrl = `data:${detectedMime};base64,${base64}`

    return NextResponse.json(
      {
        url: dataUrl,
        filename: cleanName,
        size: buffer.length,
        storage: "Database Base64 Storage"
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/medications/notice-upload] Error:", error)
    return NextResponse.json({ message: "Upload failed: " + msg }, { status: 500 })
  }
}
