import { prisma } from "@/lib/prisma"
import { NoticeForm } from "./NoticeForm"
import { NoticeList } from "./NoticeList"

export default async function AdminNoticesPage() {
  const notices = await prisma.notice.findMany({
    where: {
      NOT: {
        title: { startsWith: "__SYSTEM_" }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Global Notices</h2>
        <p className="text-slate-500 mt-2">Broadcast messages to all users across the platform.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <NoticeForm />
        </div>
        <div className="md:col-span-2">
          <NoticeList initialNotices={notices} />
        </div>
      </div>
    </div>
  )
}
