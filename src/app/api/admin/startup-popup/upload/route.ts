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
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `startup-media-${Date.now()}-${cleanName}`

    // 1. If Vercel Blob is configured with BLOB_READ_WRITE_TOKEN
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: file.type
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

    // 2. Direct Base64 Data URL fallback (stored in Supabase Notice table)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const mimeType = file.type || (cleanName.endsWith(".mp4") ? "video/mp4" : "image/jpeg")
    const dataUrl = `data:${mimeType};base64,${base64}`

    return NextResponse.json({
      url: dataUrl,
      filename: cleanName,
      size: file.size,
      storage: "Supabase Database"
    }, { status: 200 })
  } catch (error: any) {
    console.error("[api/admin/startup-popup/upload] Error:", error)
    return NextResponse.json({ message: "Upload failed: " + error.message }, { status: 500 })
  }
}
