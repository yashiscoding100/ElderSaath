import { redirect } from "next/navigation"

export default function ChildEmergencyRedirect() {
  redirect("/child/dashboard")
}
