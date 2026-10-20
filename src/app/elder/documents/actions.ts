"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { deleteDocument } from "@/lib/storage"
import { revalidatePath } from "next/navigation"

export async function clearAllElderDocuments() {
  const session = await auth()
  if (!session || session.user.role !== "ELDER") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    const docs = await prisma.medicalDocument.findMany({
      where: { elderId: session.user.id },
      select: { fileUrl: true }
    })

    for (const doc of docs) {
      if (doc.fileUrl && doc.fileUrl.startsWith("http")) {
        await deleteDocument(doc.fileUrl).catch(() => {})
      }
    }

    const result = await prisma.medicalDocument.deleteMany({
      where: { elderId: session.user.id }
    })

    revalidatePath("/elder/documents")
    return { 
      success: true, 
      message: `Deleted all ${result.count} prescriptions/documents from your account.` 
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to clear documents" }
  }
}
