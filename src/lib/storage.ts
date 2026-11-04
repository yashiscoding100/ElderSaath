import { put, del } from '@vercel/blob'

// Storage abstraction for Medical Documents
export async function uploadDocument(base64Data: string, filename: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Vercel Blob requires a Buffer or Blob object, not a raw base64 string
      // Extract the actual base64 content if it has a data URI prefix
      const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
      const buffer = Buffer.from(base64Content, 'base64')
      
      const { url } = await put(filename, buffer, { access: 'public' })
      return url
    } catch (e) {
      console.warn("Blob upload failed, falling back to direct database base64 storage:", e)
      return base64Data
    }
  }

  // MVP Fallback: Return the base64 string to be stored in the database.
  // WARNING: This will crash the database in production if many large files are uploaded.
  return base64Data
}

export async function deleteDocument(fileUrl: string) {
  if (fileUrl.startsWith("http") && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(fileUrl)
    } catch (e) {
      console.error("Failed to delete blob:", e)
    }
  }
}