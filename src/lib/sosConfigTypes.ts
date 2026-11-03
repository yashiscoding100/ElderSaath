export interface SosConfig {
  // Calling
  ambulanceNumber: string
  sosCallAmbulance: boolean
  sosCallTarget: "AMBULANCE" | "FAMILY" | "CUSTOM"
  sosCustomPhone: string

  // Alerts & Siren
  sosAlertFamily: boolean
  sosLocalSiren: boolean
  sosSirenMode: "LOUD" | "SILENT"
  sosStrobeFlashlight: boolean

  // Telemetry & Info
  sosShareLocation: boolean
  sosShareBattery: boolean
  sosIncludeMedicalId: boolean

  // False Alarm Prevention
  sosCountdownSeconds: number
}

export const DEFAULT_SOS_CONFIG: SosConfig = {
  ambulanceNumber: "108",
  sosCallAmbulance: true,
  sosCallTarget: "AMBULANCE",
  sosCustomPhone: "",

  sosAlertFamily: true,
  sosLocalSiren: true,
  sosSirenMode: "LOUD",
  sosStrobeFlashlight: true,

  sosShareLocation: true,
  sosShareBattery: true,
  sosIncludeMedicalId: true,

  sosCountdownSeconds: 3
}
