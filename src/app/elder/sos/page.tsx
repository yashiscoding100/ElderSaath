"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PhoneCall, ShieldAlert, ArrowLeft, Settings, Loader2 } from "lucide-react"

export default function SOSPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Press button to send emergency alert")
  const [sending, setSending] = useState(false)
  const [ambulanceNumber, setAmbulanceNumber] = useState("108")
  const [callAmbulance, setCallAmbulance] = useState(true)

  useEffect(() => {
    fetch("/api/sos/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.config?.ambulanceNumber) {
          setAmbulanceNumber(data.config.ambulanceNumber)
        }
        if (data?.config?.sosCallAmbulance !== undefined) {
          setCallAmbulance(data.config.sosCallAmbulance)
        }
      })
      .catch(() => {})
  }, [])

  const executeSos = async (coords?: { latitude: number, longitude: number }) => {
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          source: "IN_APP_BUTTON"
        })
      })

      const data = await res.json()
      setStatus("🚨 Family alerted with emergency alarm!")

      // Automatically launch dialer if configured
      if (callAmbulance) {
        setTimeout(() => {
          window.location.href = `tel:${ambulanceNumber || "108"}`
        }, 1000)
      }
    } catch (e) {
      setStatus("Failed to send online alert. Calling ambulance directly...")
      window.location.href = `tel:${ambulanceNumber || "108"}`
    } finally {
      setSending(false)
    }
  }

  const handleSOS = () => {
    setSending(true)
    setStatus("Getting your GPS location...")

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStatus("Alerting family and opening dialer...")
          executeSos({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        () => {
          setStatus("Could not obtain location. Alerting family anyway...")
          executeSos()
        },
        { timeout: 6000 }
      )
    } else {
      executeSos()
    }
  }

  return (
    <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/elder/home")}
            className="p-3 bg-white border border-red-200 rounded-full text-slate-700 shadow-sm hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-black text-red-700 tracking-tight">EMERGENCY SOS</h1>
          <button
            onClick={() => router.push("/elder/settings")}
            className="p-3 bg-white border border-red-200 rounded-full text-slate-700 shadow-sm hover:bg-slate-100 transition"
            title="SOS Settings"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <button 
          onClick={handleSOS}
          disabled={sending}
          className="w-64 h-64 mx-auto rounded-full bg-red-600 shadow-2xl flex flex-col items-center justify-center border-8 border-red-200 active:scale-95 transition-transform disabled:opacity-80"
        >
          {sending ? (
            <Loader2 className="w-16 h-16 text-white animate-spin mb-2" />
          ) : (
            <>
              <ShieldAlert className="w-12 h-12 text-white/90 mb-1" />
              <span className="text-white text-5xl font-black tracking-widest">SOS</span>
              <span className="text-red-100 text-xs font-bold mt-1 tracking-wider">TAP FOR IMMEDIATE HELP</span>
            </>
          )}
        </button>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-200">
           <p className="text-base font-bold text-slate-800">{status}</p>
           <p className="text-xs text-slate-500 mt-1">
             {callAmbulance ? `Will sound alarm on family phones and call ${ambulanceNumber}` : "Will sound alarm on all family phones"}
           </p>
        </div>

        <div className="grid gap-3 pt-2">
           <a
             href={`tel:${ambulanceNumber || "108"}`}
             className="w-full py-4 bg-white text-red-600 font-bold rounded-2xl text-xl border-2 border-red-600 shadow-sm flex items-center justify-center gap-3 hover:bg-red-50 transition"
           >
             <PhoneCall className="w-5 h-5 text-red-600" />
             <span>Call Ambulance ({ambulanceNumber})</span>
           </a>

           <button 
             onClick={() => router.push("/elder/home")} 
             className="w-full py-3.5 bg-slate-200 text-slate-700 font-bold rounded-2xl text-base hover:bg-slate-300 transition"
           >
             Cancel &amp; Go Back
           </button>
        </div>

      </div>
    </div>
  )
}
