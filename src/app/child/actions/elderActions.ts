"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function setActiveElderAction(elderId: string, pathname: string) {
  const cookieStore = await cookies()
  cookieStore.set("activeElderId", elderId, {
    path: "/",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 // 30 days
  })
  
  // Revalidate the layout and the current path to clear router cache
  revalidatePath("/", "layout")
  if (pathname) revalidatePath(pathname)
}
