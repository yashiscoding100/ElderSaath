import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { uploadDocument, deleteDocument } from "@/lib/storage"
import { encodeLabReportTitle, parseLabReport, isLabReport } from "@/lib/labReportUtils"
import { LabReportCategory } from "@/lib/labReportTypes"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { 
      elderId, 
      testName, 
      category, 
      testDate, 
      labName, 
      resultSummary, 
      fileType, 
      fileData 
    } = await req.json()

    if (!elderId || !testName || !fileData) {
      return NextResponse.json({ message: "Missing required fields (elderId, testName, fileData)" }, { status: 400 })
    }

    // Authorization check
    if (session.user.role === "CHILD") {
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId, childId: session.user.id } }
      })
      if (!relationship || relationship.status !== "ACTIVE") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (session.user.role === "ELDER") {
      if (session.user.id !== elderId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const safeFilename = `lab-${elderId}-${Date.now()}`
    const fileUrl = await uploadDocument(fileData, safeFilename)

    const encodedTitle = encodeLabReportTitle({
      testName,
      category: (category as LabReportCategory) || "General Lab Test",
      testDate: testDate || new Date().toISOString().split("T")[0],
      labName: labName || "",
      resultSummary: resultSummary || ""
    })

    const document = await prisma.medicalDocument.create({
      data: {
        elderId,
        uploaderId: session.user.id,
        title: encodedTitle,
        fileType: fileType || "application/pdf",
        fileUrl
      }
    })

    const item = parseLabReport(document)

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (error: any) {
    console.error("[POST /api/lab-reports] Error:", error)
    return NextResponse.json({ message: "Failed to upload test report", error: error.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const elderId = searchParams.get("elderId")

    if (!elderId) {
      return NextResponse.json({ message: "Missing elderId" }, { status: 400 })
    }

    // Authorization check
    if (session.user.role === "CHILD") {
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId, childId: session.user.id } }
      })
      if (!relationship || relationship.status !== "ACTIVE") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (session.user.role === "ELDER") {
      if (session.user.id !== elderId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    }

    const docs = await prisma.medicalDocument.findMany({
      where: { elderId },
      orderBy: { uploadedAt: "desc" }
    })

    const reports = docs
      .filter(d => isLabReport(d.title))
      .map(d => parseLabReport(d)!)
      .filter(Boolean)
      .sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""))

    return NextResponse.json({ reports }, { status: 200 })
  } catch (error: any) {
    console.error("[GET /api/lab-reports] Error:", error)
    return NextResponse.json({ message: "Failed to fetch test reports", error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const clearAll = searchParams.get("clearAll") === "true"
    const elderId = searchParams.get("elderId")

    // Handle Bulk Clear of All Lab Reports for an Elder
    if (clearAll && elderId) {
      if (session.user.role === "CHILD") {
        const relationship = await prisma.caregiverRelationship.findUnique({
          where: { elderId_childId: { elderId, childId: session.user.id } }
        })
        if (!relationship || relationship.status !== "ACTIVE") {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }
      } else if (session.user.role === "ELDER") {
        if (session.user.id !== elderId) {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }
      } else {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }

      const allDocs = await prisma.medicalDocument.findMany({
        where: { elderId }
      })
      const labDocs = allDocs.filter(d => isLabReport(d.title))

      for (const d of labDocs) {
        await deleteDocument(d.fileUrl).catch(() => {})
        await prisma.medicalDocument.delete({ where: { id: d.id } })
      }

      return NextResponse.json({ success: true, count: labDocs.length, message: `Deleted ${labDocs.length} test reports.` }, { status: 200 })
    }

    if (!id) {
      return NextResponse.json({ message: "Missing test report id" }, { status: 400 })
    }

    const document = await prisma.medicalDocument.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json({ message: "Report not found" }, { status: 404 })
    }

    // Authorization check
    if (session.user.role === "CHILD") {
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: document.elderId, childId: session.user.id } }
      })
      if (!relationship || relationship.status !== "ACTIVE") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (session.user.role === "ELDER") {
      if (session.user.id !== document.elderId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await deleteDocument(document.fileUrl)
    await prisma.medicalDocument.delete({ where: { id } })

    return NextResponse.json({ success: true, message: "Test report deleted" }, { status: 200 })
  } catch (error: any) {
    console.error("[DELETE /api/lab-reports] Error:", error)
    return NextResponse.json({ message: "Failed to delete test report", error: error.message }, { status: 500 })
  }
}
