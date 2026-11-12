
"use client"
import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { LocalNotifications } from "@capacitor/local-notifications"
import { useRouter } from "next/navigation"

export function PushSubscriptionManager() {
  const router = useRouter();
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      
      const registerDevice = async () => {
        try {
          const permStatus = await PushNotifications.checkPermissions()
          if (permStatus.receive === "granted") {
            // ALWAYS register on boot if granted to keep FCM token fresh
            await PushNotifications.register()
            setIsSubscribed(true)
          }
        } catch(e) { console.error(e) }
      }

      PushNotifications.addListener("registration", async (token) => {
         try {
           await fetch("/api/push", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               endpoint: "fcm:" + token.value,
               keys: { p256dh: "fcm", auth: "fcm" }
             })
           })
         } catch(e) { console.error("Failed to sync FCM token", e) }
      })

      registerDevice()
      
      const handleNotification = (data: Record<string, unknown> | undefined, title: string, bodyText: string) => {
        if (data?.type === "ALARM") {
          const params = new URLSearchParams({
            label: String(data.label || title || "Alarm"),
            snooze: String(data.snoozeDuration || "10"),
            body: String(data.body || ""),
            snoozeText: String(data.snoozeText || "")
          })
          if (data.alarmButtonOrder) params.set("buttonOrder", String(data.alarmButtonOrder))
          if (data.alarmTakeBtnColor) params.set("takeBtnColor", String(data.alarmTakeBtnColor))
          if (data.alarmSnoozeBtnColor) params.set("snoozeBtnColor", String(data.alarmSnoozeBtnColor))
          router.push(`/alarm?${params.toString()}`)
        } else {
          alert(`NOTIFICATION: ${title}\n${bodyText}`)
        }
      }

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        handleNotification(notification.data, notification.title || "", notification.body || "");
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        handleNotification(action.notification.data, action.notification.title || "", action.notification.body || "");
      });

      LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        handleNotification(action.notification.extra, action.notification.title || "", action.notification.body || "");
      });
    } else {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setSupported(false)
        return
      }
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setIsSubscribed(true)
        })
      })
    }
  }, [])

  const subscribe = async () => {
    setLoading(true)
    try {
      if (Capacitor.isNativePlatform()) {
        let permStatus = await PushNotifications.checkPermissions()
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions()
        }
        if (permStatus.receive !== "granted") {
          throw new Error("User denied permissions!")
        }
        
        await PushNotifications.createChannel({
          id: "sos_alarms",
          name: "Emergency Alarms",
          description: "High priority SOS alarms",
          importance: 5,
          visibility: 1,
          vibration: true
        });
        
        await PushNotifications.register()
        setIsSubscribed(true)
        alert("Native App Notifications enabled successfully!")
      } else {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })
        
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub)
        })
        setIsSubscribed(true)
        alert("Web Notifications enabled successfully!")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to enable notifications. Please ensure you have granted permission.")
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return <div className="text-xs text-slate-400">Push not supported on this device.</div>

  if (isSubscribed) return <div className="text-sm font-bold text-green-600 flex items-center gap-1">? Notifications Enabled</div>

  return (
    <button 
      onClick={subscribe}
      disabled={loading}
      className="text-sm bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-200 transition"
    >
      {loading ? "Enabling..." : "Enable Push Notifications"}
    </button>
  )
}
