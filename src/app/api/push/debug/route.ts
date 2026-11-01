export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApps } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"
import { firebaseInitError, firebaseInitialized } from "@/lib/push"

export async function GET() {
  try {
    const fcmSubs = await prisma.pushSubscription.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    })
    
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    })

    const allMeds = await prisma.medication.findMany({
      include: {
        elder: { select: { id: true, name: true, email: true } },
        logs: { take: 5, orderBy: { timestamp: "desc" } }
      }
    })

    const hasFirebaseEnv = !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_CLIENT_EMAIL && !!process.env.FIREBASE_PRIVATE_KEY
    const isFirebaseInit = getApps().length > 0
    
    const testResults: any[] = []
    
    if (isFirebaseInit) {
      for (const sub of fcmSubs) {
        if (sub.endpoint.startsWith("fcm:")) {
          try {
            const token = sub.endpoint.replace("fcm:", "")
            const message = {
              data: { type: "DEBUG_PING" },
              token: token
            }
            const response = await getMessaging().send(message)
            testResults.push({ id: sub.id, userId: sub.userId, userName: sub.user?.name, status: "SUCCESS", response })
          } catch (e: any) {
            testResults.push({ id: sub.id, userId: sub.userId, userName: sub.user?.name, status: "ERROR", error: e.message })
          }
        }
      }
    }
    
    return NextResponse.json({
      allUsers,
      fcmSubs: fcmSubs.map(s => ({ id: s.id, userId: s.userId, userEmail: s.user?.email, userRole: s.user?.role, endpoint: s.endpoint.substring(0, 30) + "..." })),
      allMeds: allMeds.map(m => ({
        id: m.id,
        name: m.name,
        time: m.time,
        frequency: m.frequency,
        elderName: m.elder?.name,
        elderEmail: m.elder?.email,
        elderId: m.elderId,
        recentLogs: m.logs
      })),
      firebaseInitialized: isFirebaseInit,
      testResults
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
