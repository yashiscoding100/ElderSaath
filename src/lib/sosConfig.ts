import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export interface SosConfig {
  ambulanceNumber: string
  sosCallAmbulance: boolean
  sosAlertFamily: boolean
  sosLocalSiren: boolean
  sosCustomPhone: string
}

export const DEFAULT_SOS_CONFIG: SosConfig = {
  ambulanceNumber: "108",
  sosCallAmbulance: true,
  sosAlertFamily: true,
  sosLocalSiren: true,
  sosCustomPhone: ""
}

function getNoticeTitle(elderId: string): string {
  return `__SYSTEM_SOS_CONFIG_${elderId}__`
}

export async function getSosConfig(elderId: string): Promise<SosConfig> {
  if (!elderId) return DEFAULT_SOS_CONFIG

  try {
    // Check new system title or legacy title and auto-migrate
    let notice = await prisma.notice.findFirst({
      where: { title: getNoticeTitle(elderId) }
    })

    if (!notice) {
      const legacyNotice = await prisma.notice.findFirst({
        where: { title: `__SOS_CONFIG_${elderId}__` }
      })
      if (legacyNotice) {
        notice = await prisma.notice.update({
          where: { id: legacyNotice.id },
          data: { title: getNoticeTitle(elderId), isActive: false }
        }).catch(() => legacyNotice)
      }
    } else if (notice.isActive) {
      await prisma.notice.update({
        where: { id: notice.id },
        data: { isActive: false }
      }).catch(() => {})
    }

    if (!notice || !notice.content) {
      return DEFAULT_SOS_CONFIG
    }

    const parsed = JSON.parse(notice.content)
    return {
      ambulanceNumber: parsed.ambulanceNumber || DEFAULT_SOS_CONFIG.ambulanceNumber,
      sosCallAmbulance: parsed.sosCallAmbulance !== false,
      sosAlertFamily: parsed.sosAlertFamily !== false,
      sosLocalSiren: parsed.sosLocalSiren !== false,
      sosCustomPhone: parsed.sosCustomPhone || ""
    }
  } catch (err) {
    console.error("[getSosConfig] Error:", err)
    return DEFAULT_SOS_CONFIG
  }
}

export async function saveSosConfig(elderId: string, partial: Partial<SosConfig>): Promise<SosConfig> {
  if (!elderId) throw new Error("Missing elderId")

  const current = await getSosConfig(elderId)
  const merged: SosConfig = {
    ambulanceNumber: partial.ambulanceNumber !== undefined ? partial.ambulanceNumber : current.ambulanceNumber,
    sosCallAmbulance: partial.sosCallAmbulance !== undefined ? Boolean(partial.sosCallAmbulance) : current.sosCallAmbulance,
    sosAlertFamily: partial.sosAlertFamily !== undefined ? Boolean(partial.sosAlertFamily) : current.sosAlertFamily,
    sosLocalSiren: partial.sosLocalSiren !== undefined ? Boolean(partial.sosLocalSiren) : current.sosLocalSiren,
    sosCustomPhone: partial.sosCustomPhone !== undefined ? partial.sosCustomPhone : current.sosCustomPhone
  }

  const title = getNoticeTitle(elderId)
  const content = JSON.stringify(merged)

  try {
    const existing = await prisma.notice.findFirst({ where: { title } })
    if (existing) {
      await prisma.notice.update({
        where: { id: existing.id },
        data: { content, isActive: false }
      })
    } else {
      await prisma.notice.create({
        data: {
          title,
          content,
          isActive: false
        }
      })
    }
  } catch (dbErr) {
    console.error("[saveSosConfig] DB Error:", dbErr)
  }

  // Send silent sync push to the elder's phone so the Android Widget SharedPreferences update immediately
  try {
    await sendPushNotification(elderId, {
      type: "SYNC_SETTINGS",
      ambulanceNumber: merged.ambulanceNumber,
      sosCallAmbulance: String(merged.sosCallAmbulance),
      sosAlertFamily: String(merged.sosAlertFamily),
      sosLocalSiren: String(merged.sosLocalSiren),
      elderId
    })
  } catch (pushErr) {
    console.warn("[saveSosConfig] Silent sync push error:", pushErr)
  }

  return merged
}
