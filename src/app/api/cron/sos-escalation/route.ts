import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { sendPushNotification } from "@/lib/push"

// This route should be called periodically by Vercel Cron (e.g. every 1-5 minutes)
export async function GET(req: Request) {
  try {
    // 1. Find all ACTIVE emergencies
    const activeEmergencies = await prisma.emergencyEvent.findMany({
      where: { status: "ACTIVE" },
      include: { elder: { include: { careProviders: true } } }
    })

    const now = new Date()
    let escalatedCount = 0

    for (const emergency of activeEmergencies) {
      // Calculate how many minutes it has been active
      const diffMs = now.getTime() - new Date(emergency.timestamp).getTime()
      const diffMins = Math.floor(diffMs / 1000 / 60)

      // Escalation Rule: Every 5 minutes, increment the escalation level up to level 3
      const expectedLevel = Math.min(3, 1 + Math.floor(diffMins / 5))

      if (expectedLevel > emergency.escalationLevel) {
        // Escalate!
        await prisma.emergencyEvent.update({
          where: { id: emergency.id },
          data: { escalationLevel: expectedLevel }
        })
        
        escalatedCount++
        
        // Notify Care Providers
        const relationship = await prisma.caregiverRelationship.findMany({
          where: { elderId: emergency.elderId, status: "ACTIVE" }
        })

        for (const rel of relationship) {
          await sendPushNotification(rel.childId, {
            title: `URGENT: SOS Escalation Level ${expectedLevel}`,
            body: `${emergency.elder.name}'s SOS alarm is unacknowledged!`,
            url: "/child/dashboard"
          })
        }

        console.log(`[SOS Cron] Escalated emergency ${emergency.id} to level ${expectedLevel}`)
      }
    }

    return NextResponse.json({ 
      message: "SOS Escalation check complete", 
      activeChecked: activeEmergencies.length,
      escalated: escalatedCount 
    }, { status: 200 })

  } catch (error) {
    console.error("[SOS Cron] Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
