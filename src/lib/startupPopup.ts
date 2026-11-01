import { prisma } from "@/lib/prisma"

export const STARTUP_POPUP_NOTICE_TITLE = "__SYSTEM_STARTUP_POPUP__"

export type StartupPopupType = "TEXT" | "IMAGE" | "VIDEO"

export interface StartupPopupConfig {
  enabled: boolean
  type: StartupPopupType
  title: string
  message: string
  mediaUrl: string
  buttonText: string
  buttonLink: string
  updatedAt?: string
}

export const DEFAULT_STARTUP_POPUP: StartupPopupConfig = {
  enabled: false,
  type: "TEXT",
  title: "Welcome to ElderSaath",
  message: "We are committed to providing the highest quality care and peace of mind for your loved ones.",
  mediaUrl: "",
  buttonText: "Continue to App",
  buttonLink: ""
}

export async function getStartupPopupConfig(): Promise<StartupPopupConfig> {
  try {
    const notice = await prisma.notice.findFirst({
      where: { title: STARTUP_POPUP_NOTICE_TITLE }
    })

    if (!notice) {
      return DEFAULT_STARTUP_POPUP
    }

    try {
      const parsed = JSON.parse(notice.content) as Partial<StartupPopupConfig>
      return {
        enabled: notice.isActive,
        type: parsed.type || "TEXT",
        title: parsed.title || "Announcement",
        message: parsed.message || "",
        mediaUrl: parsed.mediaUrl || "",
        buttonText: parsed.buttonText || "Continue to App",
        buttonLink: parsed.buttonLink || "",
        updatedAt: notice.createdAt.toISOString()
      }
    } catch {
      return {
        ...DEFAULT_STARTUP_POPUP,
        enabled: notice.isActive,
        message: notice.content
      }
    }
  } catch (error) {
    console.error("[getStartupPopupConfig] Error:", error)
    return DEFAULT_STARTUP_POPUP
  }
}

export async function saveStartupPopupConfig(config: StartupPopupConfig): Promise<boolean> {
  try {
    const existing = await prisma.notice.findFirst({
      where: { title: STARTUP_POPUP_NOTICE_TITLE }
    })

    const contentPayload = JSON.stringify({
      type: config.type,
      title: config.title,
      message: config.message,
      mediaUrl: config.mediaUrl,
      buttonText: config.buttonText,
      buttonLink: config.buttonLink
    })

    if (existing) {
      await prisma.notice.update({
        where: { id: existing.id },
        data: {
          content: contentPayload,
          isActive: config.enabled
        }
      })
    } else {
      await prisma.notice.create({
        data: {
          title: STARTUP_POPUP_NOTICE_TITLE,
          content: contentPayload,
          isActive: config.enabled
        }
      })
    }

    return true
  } catch (error) {
    console.error("[saveStartupPopupConfig] Error:", error)
    return false
  }
}
