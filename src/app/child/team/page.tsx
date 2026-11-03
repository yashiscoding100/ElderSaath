import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import { Phone, Mail, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { AddProviderForm } from "./AddProviderForm"
import { DeleteProviderButton } from "./DeleteProviderButton"

export const dynamic = "force-dynamic"

export default async function CareTeamPage() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)
  if (!relationship) redirect("/child/dashboard")

  const providers = await prisma.careProvider.findMany({
    where: { elderId: relationship.elderId },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <Link 
          href="/child/dashboard" 
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Care Team</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Doctors, nurses, physiotherapists, caretakers, and household helpers for {relationship.elder.name}.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <AddProviderForm elderId={relationship.elderId} />
      </div>

      <div className="space-y-4">
        {providers.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-3">
              👥
            </div>
            <h3 className="font-bold text-slate-900 text-lg">No Team Members Added</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Add primary doctors, attending nurses, caretakers, or emergency helpers above.
            </p>
          </div>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-900">{provider.name}</h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {provider.role}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {provider.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{provider.phone}</span>
                    </p>
                  )}
                  {provider.email && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{provider.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {provider.phone && (
                  <a 
                    href={`tel:${provider.phone}`}
                    className="w-10 h-10 bg-green-50 hover:bg-green-100 rounded-xl flex items-center justify-center text-green-600 transition shadow-sm"
                    title={`Call ${provider.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {provider.email && (
                  <a 
                    href={`mailto:${provider.email}`}
                    className="w-10 h-10 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 transition shadow-sm"
                    title={`Email ${provider.name}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                <DeleteProviderButton providerId={provider.id} providerName={provider.name} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
