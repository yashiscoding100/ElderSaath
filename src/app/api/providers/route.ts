import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { elderId, name, role, phone, email } = await req.json()

    if (!elderId || !name || !role) {
      return NextResponse.json({ message: "Missing required fields (elderId, name, role)" }, { status: 400 })
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

    // Create provider with optional phone and email
    const provider = await prisma.careProvider.create({
      data: {
        elderId,
        name: name.trim(),
        role: role.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null
      }
    })
    
    return NextResponse.json(provider, { status: 201 })
  } catch (error: any) {
    console.error("[POST /api/providers] Error:", error)
    return NextResponse.json({ message: "Failed to create provider", error: error.message }, { status: 500 })
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

    if (!id) {
      return NextResponse.json({ message: "Missing provider id" }, { status: 400 })
    }

    const provider = await prisma.careProvider.findUnique({
      where: { id }
    })

    if (!provider) {
      return NextResponse.json({ message: "Provider not found" }, { status: 404 })
    }

    // Authorization check
    if (session.user.role === "CHILD") {
      const relationship = await prisma.caregiverRelationship.findUnique({
        where: { elderId_childId: { elderId: provider.elderId, childId: session.user.id } }
      })
      if (!relationship || relationship.status !== "ACTIVE") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (session.user.role === "ELDER") {
      if (session.user.id !== provider.elderId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    }

    await prisma.careProvider.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: "Provider deleted" }, { status: 200 })
  } catch (error: any) {
    console.error("[DELETE /api/providers] Error:", error)
    return NextResponse.json({ message: "Failed to delete provider", error: error.message }, { status: 500 })
  }
}
