import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ScheduleSettings } from "./ScheduleSettings"
import { EditProfileForm } from "@/app/child/settings/EditProfileForm"
import { ElderPushSettings } from "./ElderPushSettings"
import { ElderAlarmPreferences } from "./ElderAlarmPreferences"
import { ElderUiStyleSettings } from "./ElderUiStyleSettings"
import { SosSettingsCard } from "@/components/SosSettingsCard"
import { parseElderUiStyle } from "@/lib/elderUiPreferences"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function ElderSettings() {
  const session = await auth()
  
  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  const profile = await prisma.elderProfile.findUnique({
    where: { userId: session.user.id }
  })

  const currentUiStyle = parseElderUiStyle(profile?.notes)

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <Link href="/elder/home" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Settings</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your profile and emergency preferences.</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <ElderUiStyleSettings initialStyle={currentUiStyle} />
          <div className="p-6">
            <SosSettingsCard />
          </div>
          <EditProfileForm 
            initialName={session.user.name || ""} 
            initialEmail={session.user.email || ""} 
          />
          <ElderPushSettings />
          <ElderAlarmPreferences initialSticky={profile?.stickyAlarmNotification ?? true} />
          <div className="p-6">
            <h4 className="font-bold text-slate-900 mb-4">Vitals Check Schedule</h4>
            <ScheduleSettings 
              initialDays={profile?.vitalCheckDays || "0,1,2,3,4,5,6"} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
