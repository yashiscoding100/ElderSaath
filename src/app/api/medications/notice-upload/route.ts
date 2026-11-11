import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { put } from "@vercel/blob"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user.role !== "CHILD" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ message: "Unauthorized - Caregiver account required" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ message: "No audio file provided" }, { status: 400 })
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { message: "Audio file exceeds 4.5 MB limit. Please upload or record a shorter voice notice." },
        { status: 400 }
      )
    }

    const cleanName = (file.name || "voice-notice.wav").replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `med-notice-${Date.now()}-${cleanName}`
    const detectedMime =
      file.type && file.type.startsWith("audio/")
        ? file.type
        : cleanName.toLowerCase().endsWith(".wav")
          ? "audio/wav"
          : cleanName.toLowerCase().endsWith(".ogg")
            ? "audio/ogg"
            : cleanName.toLowerCase().endsWith(".m4a")
              ? "audio/mp4"
              : cleanName.toLowerCase().endsWith(".webm")
                ? "audio/webm"
                : "audio/mpeg"

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: detectedMime
        })
        return NextResponse.json(
          {
            url: blob.url,
            filename: cleanName,
            size: file.size,
            storage: "Vercel Blob CDN"
          },
          { status: 200 }
        )
      } catch (blobErr: unknown) {
        const msg = blobErr instanceof Error ? blobErr.message : String(blobErr)
        console.warn("[notice-upload] Vercel Blob upload failed, falling back to Data URL:", msg)
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const dataUrl = `data:${detectedMime};base64,${base64}`

    return NextResponse.json(
      {
        url: dataUrl,
        filename: cleanName,
        size: file.size,
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
