export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { LinkRow } from "./LinkRow"
import { CreateLinkModal } from "./CreateLinkModal"

export default async function AdminLinksPage() {
  let links: any[] = []
  try {
    links = await prisma.caregiverRelationship.findMany({
      include: {
        elder: { select: { name: true, email: true } },
        child: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  } catch (error) {
    console.error("AdminLinksPage error:", error)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Connection Management</h2>
          <p className="text-slate-500 mt-2">View and manage links between Elders and Family Members.</p>
        </div>
        <CreateLinkModal />
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Elder</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Family Member</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Status</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Created</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map(link => (
                <LinkRow key={link.id} link={link} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
