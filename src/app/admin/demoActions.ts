"use server"

import { auth } from "@/auth"
import { setDemoEnabled, isDemoEnabled, ensureDemoAccountsExist } from "@/lib/demoConfig"
import { revalidatePath } from "next/navigation"

export async function toggleDemoMode(enabled: boolean) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    if (enabled) {
      await ensureDemoAccountsExist()
    }
    await setDemoEnabled(enabled)
    revalidatePath("/admin")
    revalidatePath("/login")
    revalidatePath("/demo")
    return {
      success: true,
      message: enabled
        ? "Recruiter demo mode has been ENABLED. The 'Explore Live Demo' button is now visible on the Sign-In page."
        : "Recruiter demo mode has been DISABLED. The demo button has been hidden from the Sign-In page."
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update demo mode" }
  }
}

export async function getDemoStatus() {
  try {
    const enabled = await isDemoEnabled()
    return { enabled }
  } catch {
    return { enabled: true }
  }
}
