import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AddVitalsModal } from "./AddVitalsModal"
import { HealthHistoryClient } from "@/components/health/HealthHistoryClient"

export const dynamic = "force-dynamic"

export default async function ChildHealthHistory() {
  const session = await auth()

  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
    return (
      <div className="min-h-screen p-6 flex justify-center items-center">
        <p className="text-gray-500 font-bold">
          Please link an elder account first.
        </p>
      </div>
    )
  }

  const measurements = await prisma.healthMeasurement.findMany({
    where: { elderId: relationship.elderId },
    orderBy: { timestamp: "desc" },
  })

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
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/child/dashboard"
            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Health History Timeline
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Historical vitals &amp; check-in records for{" "}
              {relationship.elder.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AddVitalsModal elderId={relationship.elderId} />
        </div>
      </header>

      <HealthHistoryClient
        initialMeasurements={serializedMeasurements}
        elderId={relationship.elderId}
        variant="child"
      />
    </div>
  )
}
