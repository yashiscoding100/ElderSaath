"use client"

import { SessionProvider } from "next-auth/react"
import { ServiceWorkerRegister } from "./ServiceWorkerRegister"
import { MedicationAlarmSync } from "./MedicationAlarmSync"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <MedicationAlarmSync />
      {children}
    </SessionProvider>
  )
}
