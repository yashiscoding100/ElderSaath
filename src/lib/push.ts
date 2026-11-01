import webpush from "web-push"
import { prisma } from "./prisma"
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import fs from 'fs'
import path from 'path'

// 1. Setup Web Push (VAPID)
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
const privateKey = process.env.VAPID_PRIVATE_KEY || ""

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(
      "mailto:support@eldersaath.com",
      publicKey,
      privateKey
    )
  } catch (e) {
    console.error("VAPID init error:", e)
  }
}

// 2. Setup Firebase Admin (FCM)
export let firebaseInitialized = false
export let firebaseInitError = ""

export function ensureFirebaseInit(): boolean {
  if (getApps().length > 0) {
    firebaseInitialized = true
    return true
  }

  try {
    let serviceAccount = null
    
    // First try env vars (for Vercel)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      let rawKey = process.env.FIREBASE_PRIVATE_KEY
      
      // Clean up key format
      rawKey = rawKey.replace(/"/g, '')
      rawKey = rawKey.replace(/\\n/g, '').replace(/\\r/g, '')
      rawKey = rawKey.replace(/\s+/g, '')
      
      const base64Match = rawKey.match(/-----BEGINPRIVATEKEY-----(.+)-----ENDPRIVATEKEY-----/)
      if (base64Match && base64Match[1]) {
        rawKey = '-----BEGIN PRIVATE KEY-----\n' + base64Match[1] + '\n-----END PRIVATE KEY-----\n'
      }
      
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: rawKey,
      }
    } 
    // Fallback to local file
    else {
      const keyPath = path.join(process.cwd(), 'firebase-admin-key.json')
      if (fs.existsSync(keyPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
      } else {
        firebaseInitError = "Missing FIREBASE env vars on Vercel"
      }
    }

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount)
      })
      firebaseInitialized = true
      return true
    }
  } catch (e: any) {
    firebaseInitError = e.message || "Unknown init error"
    console.error("Firebase admin init error:", e)
  }

  firebaseInitialized = getApps().length > 0
  return firebaseInitialized
}

export async function sendPushNotification(userId: string, payload: Record<string, unknown>) {
  // Force an in-app database notification for the Bell icon
  const alertTitle = (payload.title as string) || (payload.label as string) || "Notification"
  const alertBody = (payload.body as string) || ""

  try {
    await prisma.appNotification.create({
      data: {
        userId,
        title: alertTitle,
        message: alertBody,
        type: payload.type === "ALARM" || payload.type === "EMERGENCY" ? "ALERT" : "INFO",
        link: (payload.url as string) || null
      }
    })
  } catch (dbErr) {
    console.error("Failed to save AppNotification", dbErr)
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  })

  console.log(`[Push] Found ${subscriptions.length} subscriptions for user ${userId}`)

  const isFcmReady = ensureFirebaseInit()

  const notifications = subscriptions.map(async sub => {
    // Check if it's an FCM native token (Android and iOS via Firebase APNs)
    if (sub.endpoint.startsWith("fcm:")) {
      if (!isFcmReady) {
        console.error("FIREBASE INIT FAILED: " + firebaseInitError)
        return
      }
      
      const token = sub.endpoint.replace("fcm:", "")
      const isAlarm = payload.type === 'ALARM'
      
      const message: any = {
        ...(isAlarm ? {} : {
          notification: {
            title: alertTitle,
            body: alertBody,
          }
        }),
        data: payload as Record<string, string>,
        token: token,
        android: {
          priority: "high" as const,
          ...(isAlarm ? {} : {
            notification: {
              channelId: "sos_alarms",
              sound: "default"
            }
          })
        },
        // Apple Push Notification Service (iOS)
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert"
          },
          payload: {
            aps: {
              alert: {
                title: alertTitle,
                body: alertBody
              },
              sound: "default",
              badge: 1,
              interruptionLevel: isAlarm ? "time-sensitive" : "active",
              contentAvailable: true
            }
          }
        }
      }
      
      try {
        const response = await getMessaging().send(message)
        console.log(`[Push] Successfully sent FCM message to user ${userId}, response: ${response}`)
        return response
      } catch (error: any) {
        console.error("Firebase push error:", error)
        if (error.code === 'messaging/registration-token-not-registered') {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
        throw error
      }
    } 
    
    // Otherwise, handle as standard Web Push
    else {
      if (!publicKey || !privateKey) return
      
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }
      
      try {
        return await webpush.sendNotification(
          pushSubscription as any,
          JSON.stringify(payload)
        )
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
      }
    }
  })

  return Promise.allSettled(notifications)
}

export async function broadcastPushNotification(payload: Record<string, unknown>) {
  const users = await prisma.user.findMany({ select: { id: true } })
  const promises = users.map(u => sendPushNotification(u.id, payload))
  return Promise.allSettled(promises)
}
