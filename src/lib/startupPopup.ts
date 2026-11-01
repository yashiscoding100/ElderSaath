import { prisma } from "@/lib/prisma"

export const STARTUP_POPUP_NOTICE_TITLE = "__SYSTEM_STARTUP_POPUP__"

export type StartupPopupType = "TEXT" | "IMAGE" | "VIDEO"

export type DismissMode = "IMMEDIATE" | "TIMER_REQUIRED" | "FULL_VIDEO_REQUIRED"

export interface StartupPopupConfig {
  enabled: boolean
  type: StartupPopupType
  title: string
  message: string
  mediaUrl: string
  buttonText: string
  buttonLink: string

  // Dismissal & Close Button Power Controls
  showCloseButton: boolean
  dismissMode: DismissMode
  lockDurationSeconds: number
  autoCloseOnComplete: boolean

  updatedAt?: string
}

export const DEFAULT_STARTUP_POPUP: StartupPopupConfig = {
  enabled: false,
  type: "TEXT",
  title: "Welcome to ElderSaath",
  message: "We are committed to providing the highest quality care and peace of mind for your loved ones.",
  mediaUrl: "",
  buttonText: "Continue to App",
  buttonLink: "",

  showCloseButton: true,
  dismissMode: "IMMEDIATE",
  lockDurationSeconds: 10,
  autoCloseOnComplete: false
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

        showCloseButton: parsed.showCloseButton !== undefined ? parsed.showCloseButton : true,
        dismissMode: parsed.dismissMode || "IMMEDIATE",
        lockDurationSeconds: typeof parsed.lockDurationSeconds === "number" ? parsed.lockDurationSeconds : 10,
        autoCloseOnComplete: Boolean(parsed.autoCloseOnComplete),

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

export async function saveStartupPopupConfig(config: Partial<StartupPopupConfig>): Promise<boolean> {
  try {
    const current = await getStartupPopupConfig()
    const merged: StartupPopupConfig = {
      ...current,
      ...config
    }

    const existing = await prisma.notice.findFirst({
      where: { title: STARTUP_POPUP_NOTICE_TITLE }
    })

    const contentPayload = JSON.stringify({
      type: merged.type,
      title: merged.title,
      message: merged.message,
      mediaUrl: merged.mediaUrl,
      buttonText: merged.buttonText,
      buttonLink: merged.buttonLink,
      showCloseButton: merged.showCloseButton,
      dismissMode: merged.dismissMode,
      lockDurationSeconds: merged.lockDurationSeconds,
      autoCloseOnComplete: merged.autoCloseOnComplete
    })

    const newIsActive = typeof config.enabled === "boolean" ? config.enabled : merged.enabled

    if (existing) {
      await prisma.notice.update({
        where: { id: existing.id },
        data: {
          content: contentPayload,
          isActive: newIsActive
        }
      })
    } else {
      await prisma.notice.create({
        data: {
          title: STARTUP_POPUP_NOTICE_TITLE,
          content: contentPayload,
          isActive: newIsActive
        }
      })
    }

    return true
  } catch (error) {
    console.error("[saveStartupPopupConfig] Error:", error)
    return false
  }
}
