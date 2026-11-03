import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Phone, Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ElderTeamPage() {
  const session = await auth()
  
  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  const providers = await prisma.careProvider.findMany({
    where: { elderId: session.user.id },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col items-center">
      <div className="w-full max-w-md bg-white shadow-sm border border-slate-200 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-4 pb-2">
          <Link 
            href="/elder/home" 
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700"
            title="Back to Home"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Helpers & Team</h1>
            <p className="text-sm text-slate-500">Call doctors, nurses, drivers, or maids</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        {providers.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-slate-200">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-lg font-bold text-slate-800">No helpers added yet</p>
            <p className="text-slate-500 text-sm mt-1">Your family can add your doctors and helpers here.</p>
          </div>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-xl text-slate-900 truncate">{provider.name}</h3>
                <p className="font-semibold text-sm text-blue-600 mt-0.5">{provider.role}</p>
                {provider.phone && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{provider.phone}</p>
                )}
                {provider.email && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{provider.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {provider.phone && (
                  <a 
                    href={`tel:${provider.phone}`}
                    className="w-14 h-14 bg-green-50 hover:bg-green-100 active:scale-95 rounded-2xl flex items-center justify-center text-green-600 transition shadow-sm"
                    title={`Call ${provider.name}`}
                  >
                    <Phone className="w-6 h-6" />
                  </a>
                )}
                {provider.email && (
                  <a 
                    href={`mailto:${provider.email}`}
                    className="w-14 h-14 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-2xl flex items-center justify-center text-blue-600 transition shadow-sm"
                    title={`Email ${provider.name}`}
                  >
                    <Mail className="w-6 h-6" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
