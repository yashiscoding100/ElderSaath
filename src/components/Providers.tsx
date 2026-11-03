"use client"

import { SessionProvider } from "next-auth/react"
import { ServiceWorkerRegister } from "./ServiceWorkerRegister"
import { SilentMedicationPoller } from "./SilentMedicationPoller"
import { MedicationAlarmSync } from "./MedicationAlarmSync"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <SilentMedicationPoller />
      <MedicationAlarmSync />
      {children}
    </SessionProvider>
  )
}
