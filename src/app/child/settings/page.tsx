import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EditProfileForm } from "./EditProfileForm"
import { PushNotificationSettings } from "./PushNotificationSettings"
import { HealthParameterSettings } from "./HealthParameterSettings"
import { ElderAlarmSettings } from "./ElderAlarmSettings"
import { SosSettingsCard } from "@/components/SosSettingsCard"
import { PushSubscriptionManager } from "@/components/PushSubscriptionManager"

export default async function ChildSettings() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)
  
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/child/dashboard" 
            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your profile, emergency rules, and notification preferences.</p>
          </div>
        </div>
        <PushSubscriptionManager />
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        <EditProfileForm 
          initialName={session.user.name || ""} 
          initialEmail={session.user.email || ""} 
        />
        <PushNotificationSettings />
        {relationship && (
          <>
            <div className="p-6">
              <SosSettingsCard elderId={relationship.elderId} isChild={true} />
            </div>
            <HealthParameterSettings 
              elderId={relationship.elderId}
              elderName={relationship.elder.name || "Elder"}
              initialVitals={relationship.elder.elderProfile?.requiredVitals || "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT"}
              initialAskSymptoms={relationship.elder.elderProfile?.askSymptoms ?? true}
            />
            <ElderAlarmSettings 
              elderId={relationship.elderId}
              elderName={relationship.elder.name || "Elder"}
              initialSnoozeText={relationship.elder.alarmSnoozeText || "Take later"}
              initialSnoozeDuration={relationship.elder.alarmSnoozeDuration || 10}
              initialCanManageMeds={relationship.elder.canManageMeds || false}
              initialStickyAlarmNotification={relationship.elder.elderProfile?.stickyAlarmNotification ?? true}
            />
          </>
        )}
      </div>
    </div>
  )
}
