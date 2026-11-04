import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { put } from "@vercel/blob"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ message: "No audio file provided" }, { status: 400 })
    }

    // 4.5 MB serverless upload limit check
    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json({ message: "File exceeds 4.5 MB limit. Please choose a shorter alarm ring tone." }, { status: 400 })
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `alarm-tone-${Date.now()}-${cleanName}`

    // 1. If Vercel Blob is configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: file.type || "audio/mpeg"
        })
        return NextResponse.json({
          url: blob.url,
          filename: cleanName,
          size: file.size,
          storage: "Vercel Blob CDN"
        }, { status: 200 })
      } catch (blobErr: any) {
        console.warn("Vercel Blob upload failed, falling back to Data URL:", blobErr.message)
      }
    }

    // 2. Direct Base64 Data URL fallback
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const mimeType = file.type || (cleanName.endsWith(".wav") ? "audio/wav" : cleanName.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg")
    const dataUrl = `data:${mimeType};base64,${base64}`

    return NextResponse.json({
      url: dataUrl,
      filename: cleanName,
      size: file.size,
      storage: "Database Base64 Storage"
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/admin/alarm-tone/upload] Error:", error)
    return NextResponse.json({ message: "Upload failed: " + error.message }, { status: 500 })
  }
}
