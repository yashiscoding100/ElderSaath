"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function MedicationsPageRefresher() {
  const router = useRouter()

  useEffect(() => {
    const handleFocus = () => router.refresh()
    const handleCustom = () => router.refresh()

    window.addEventListener("focus", handleFocus)
    window.addEventListener("eldersaath:refresh-medications", handleCustom)
    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("eldersaath:refresh-medications", handleCustom)
    }
  }, [router])

  return null
}
