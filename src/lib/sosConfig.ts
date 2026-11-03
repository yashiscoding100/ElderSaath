import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import { SosConfig, DEFAULT_SOS_CONFIG } from "./sosConfigTypes"

export * from "./sosConfigTypes"

function getNoticeTitle(elderId: string): string {
  return `__SYSTEM_SOS_CONFIG_${elderId}__`
}

export async function getSosConfig(elderId: string): Promise<SosConfig> {
  if (!elderId) return DEFAULT_SOS_CONFIG

  try {
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
      sosCallTarget: parsed.sosCallTarget || DEFAULT_SOS_CONFIG.sosCallTarget,
      sosCustomPhone: parsed.sosCustomPhone || "",

      sosAlertFamily: parsed.sosAlertFamily !== false,
      sosLocalSiren: parsed.sosLocalSiren !== false,
      sosSirenMode: parsed.sosSirenMode || DEFAULT_SOS_CONFIG.sosSirenMode,
      sosStrobeFlashlight: parsed.sosStrobeFlashlight !== false,

      sosShareLocation: parsed.sosShareLocation !== false,
      sosShareBattery: parsed.sosShareBattery !== false,
      sosIncludeMedicalId: parsed.sosIncludeMedicalId !== false,

      sosCountdownSeconds: typeof parsed.sosCountdownSeconds === "number" ? parsed.sosCountdownSeconds : DEFAULT_SOS_CONFIG.sosCountdownSeconds
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
    sosCallTarget: partial.sosCallTarget !== undefined ? partial.sosCallTarget : current.sosCallTarget,
    sosCustomPhone: partial.sosCustomPhone !== undefined ? partial.sosCustomPhone : current.sosCustomPhone,

    sosAlertFamily: partial.sosAlertFamily !== undefined ? Boolean(partial.sosAlertFamily) : current.sosAlertFamily,
    sosLocalSiren: partial.sosLocalSiren !== undefined ? Boolean(partial.sosLocalSiren) : current.sosLocalSiren,
    sosSirenMode: partial.sosSirenMode !== undefined ? partial.sosSirenMode : current.sosSirenMode,
    sosStrobeFlashlight: partial.sosStrobeFlashlight !== undefined ? Boolean(partial.sosStrobeFlashlight) : current.sosStrobeFlashlight,

    sosShareLocation: partial.sosShareLocation !== undefined ? Boolean(partial.sosShareLocation) : current.sosShareLocation,
    sosShareBattery: partial.sosShareBattery !== undefined ? Boolean(partial.sosShareBattery) : current.sosShareBattery,
    sosIncludeMedicalId: partial.sosIncludeMedicalId !== undefined ? Boolean(partial.sosIncludeMedicalId) : current.sosIncludeMedicalId,

    sosCountdownSeconds: partial.sosCountdownSeconds !== undefined ? Number(partial.sosCountdownSeconds) : current.sosCountdownSeconds
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
      sosCallTarget: merged.sosCallTarget,
      sosCustomPhone: merged.sosCustomPhone,
      sosAlertFamily: String(merged.sosAlertFamily),
      sosLocalSiren: String(merged.sosLocalSiren),
      sosSirenMode: merged.sosSirenMode,
      sosStrobeFlashlight: String(merged.sosStrobeFlashlight),
      sosCountdownSeconds: String(merged.sosCountdownSeconds),
      elderId
    })
  } catch (pushErr) {
    console.warn("[saveSosConfig] Silent sync push error:", pushErr)
  }

  return merged
}
