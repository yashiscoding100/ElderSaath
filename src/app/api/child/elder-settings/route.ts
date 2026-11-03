import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encodeElderUiStyle, ElderUiStyle } from "@/lib/elderUiPreferences"

export async function POST(req: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { 
      elderId, 
      alarmSnoozeText, 
      alarmSnoozeDuration, 
      sosEnabled, 
      canManageMeds, 
      stickyAlarmNotification,
      uiStyle 
    } = await req.json()
    
    // Ensure the child has access to this elder
    const rel = await prisma.caregiverRelationship.findFirst({
      where: { childId: session.user.id, elderId, status: "ACTIVE" }
    })
    
    if (!rel) return NextResponse.json({ message: "Not authorized for this elder" }, { status: 403 })

    await prisma.user.update({
      where: { id: elderId },
      data: {
        alarmSnoozeText,
        alarmSnoozeDuration,
        sosEnabled,
        canManageMeds
      }
    })

    const existingProfile = await prisma.elderProfile.findUnique({
      where: { userId: elderId }
    })

    const updateData: any = {}
    if (stickyAlarmNotification !== undefined) {
      updateData.stickyAlarmNotification = stickyAlarmNotification
    }

    if (uiStyle === "MODERN" || uiStyle === "CLASSIC") {
      updateData.notes = encodeElderUiStyle(existingProfile?.notes, uiStyle as ElderUiStyle)
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.elderProfile.upsert({
        where: { userId: elderId },
        update: updateData,
        create: { 
          userId: elderId, 
          stickyAlarmNotification: stickyAlarmNotification ?? true,
          notes: updateData.notes || ""
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Failed to update elder settings" }, { status: 500 })
  }
}
