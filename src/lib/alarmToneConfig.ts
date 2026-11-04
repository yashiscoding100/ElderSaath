import { prisma } from "@/lib/prisma"

export const ALARM_TONE_NOTICE_TITLE = "__SYSTEM_ALARM_TONE__"

export interface AlarmTonePreset {
  id: string
  name: string
  category: string
  url: string
}

export const PRESET_ALARM_TONES: AlarmTonePreset[] = [
  {
    id: "PRESET_BELLS",
    name: "Gentle Morning Chimes",
    category: "Peaceful",
    url: "/sounds/gentle_morning_chimes.ogg"
  },
  {
    id: "PRESET_MEDITATION",
    name: "Tibetan Singing Bowl",
    category: "Calm",
    url: "/sounds/tibetan_singing_bowl.ogg"
  },
  {
    id: "PRESET_FLUTE",
    name: "Serene Morning Melody",
    category: "Melodic",
    url: "/sounds/mechanical_clock.ogg"
  },
  {
    id: "PRESET_GENTLE_ALARM",
    name: "Classic Digital Gentle Ring",
    category: "Classic",
    url: "/sounds/digital_watch.ogg"
  }
]

export interface AlarmToneConfig {
  enabled: boolean // true = use custom tone, false = use phone system default tone
  toneTitle: string
  toneUrl: string
  tonePreset: string // preset ID or "CUSTOM_UPLOAD"
  updatedAt?: string
}

export const DEFAULT_ALARM_TONE_CONFIG: AlarmToneConfig = {
  enabled: false,
  toneTitle: "Phone System Default Alarm",
  toneUrl: "",
  tonePreset: "SYSTEM_DEFAULT"
}

export async function getAlarmToneConfig(): Promise<AlarmToneConfig> {
  try {
    const notice = await prisma.notice.findFirst({
      where: { title: ALARM_TONE_NOTICE_TITLE }
    })

    if (!notice) {
      return DEFAULT_ALARM_TONE_CONFIG
    }

    try {
      const parsed = JSON.parse(notice.content) as Partial<AlarmToneConfig>
      let toneUrl = parsed.toneUrl || ""
      const matchedPreset = PRESET_ALARM_TONES.find(p => p.id === parsed.tonePreset)
      if (matchedPreset) {
        toneUrl = matchedPreset.url
      } else if (toneUrl.includes("tibetan_singing_bowl.ogg")) {
        toneUrl = "/sounds/tibetan_singing_bowl.ogg"
      }

      return {
        enabled: notice.isActive,
        toneTitle: parsed.toneTitle || (notice.isActive ? "Custom Alarm Tone" : "Phone System Default Alarm"),
        toneUrl,
        tonePreset: parsed.tonePreset || "CUSTOM_UPLOAD",
        updatedAt: notice.createdAt.toISOString()
      }
    } catch {
      return {
        ...DEFAULT_ALARM_TONE_CONFIG,
        enabled: notice.isActive
      }
    }
  } catch (error) {
    console.warn("[getAlarmToneConfig] Error reading tone config (falling back to default):", error)
    return DEFAULT_ALARM_TONE_CONFIG
  }
}

export async function saveAlarmToneConfig(updates: Partial<AlarmToneConfig>): Promise<AlarmToneConfig> {
  const current = await getAlarmToneConfig()
  const merged: AlarmToneConfig = {
    ...current,
    ...updates
  }

  const payloadString = JSON.stringify({
    toneTitle: merged.toneTitle,
    toneUrl: merged.toneUrl,
    tonePreset: merged.tonePreset
  })

  const existing = await prisma.notice.findFirst({
    where: { title: ALARM_TONE_NOTICE_TITLE }
  })

  if (existing) {
    await prisma.notice.update({
      where: { id: existing.id },
      data: {
        content: payloadString,
        isActive: merged.enabled
      }
    })
  } else {
    await prisma.notice.create({
      data: {
        title: ALARM_TONE_NOTICE_TITLE,
        content: payloadString,
        isActive: merged.enabled
      }
    })
  }

  return merged
}
