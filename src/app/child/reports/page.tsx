import { redirect } from "next/navigation"

export default function ChildReportsRedirect() {
  redirect("/child/health")
}
