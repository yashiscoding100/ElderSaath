"use client"

// Deprecated: Time-based alarms are now scheduled directly on Android hardware AlarmManager.
// Minute-by-minute cloud polling has been removed to eliminate duplicate alarms and server load.
export function SilentMedicationPoller() {
  return null
}
