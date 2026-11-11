import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AddVitalsModal } from "@/app/child/health/AddVitalsModal"
import { HealthHistoryClient } from "@/components/health/HealthHistoryClient"

export const dynamic = "force-dynamic"

export default async function ElderHealthHistory() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  const [measurements, elderProfile] = await Promise.all([
    prisma.healthMeasurement.findMany({
      where: { elderId: session.user.id },
      orderBy: { timestamp: "desc" },
    }),
    prisma.elderProfile.findUnique({
      where: { userId: session.user.id },
      select: { requiredVitals: true },
    }),
  ])

  const serializedMeasurements = measurements.map((m) => ({
    id: m.id,
    elderId: m.elderId,
    type: m.type,
    value: m.value,
    unit: m.unit,
    source: m.source,
    timestamp: m.timestamp.toISOString(),
    notes: m.notes,
  }))

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-2">
          <div className="flex items-center gap-4">
            <Link
              href="/elder/home"
              className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
              title="Back to Home"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Health History Timeline
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Historical vitals &amp; check-in records for {session.user.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AddVitalsModal elderId={session.user.id} />
          </div>
        </header>

        <HealthHistoryClient
          initialMeasurements={serializedMeasurements}
          elderId={session.user.id}
          variant="elder"
          requiredVitals={elderProfile?.requiredVitals || undefined}
        />
      </div>
    </div>
  )
}
