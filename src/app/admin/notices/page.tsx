import { prisma } from "@/lib/prisma"
import { NoticeForm } from "./NoticeForm"
import { NoticeList } from "./NoticeList"
import { getStartupPopupConfig } from "@/lib/startupPopup"
import { StartupPopupManager } from "./StartupPopupManager"

export const dynamic = "force-dynamic"

export default async function AdminNoticesPage() {
  const [notices, startupConfig] = await Promise.all([
    prisma.notice.findMany({
      where: {
        NOT: {
          title: { startsWith: "__SYSTEM_" }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    getStartupPopupConfig()
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Global Notices & Startup Media</h2>
        <p className="text-slate-500 mt-2">Manage startup popup videos, photos, and announcement banners across the app & website.</p>
      </header>

      {/* App & Website Startup Media Manager */}
      <StartupPopupManager initialConfig={startupConfig} />

      {/* Persistent Banners Section */}
      <div className="border-t border-slate-200 pt-8">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Persistent Dashboard Banner Notices</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <NoticeForm />
          </div>
          <div className="md:col-span-2">
            <NoticeList initialNotices={notices} />
          </div>
        </div>
      </div>
    </div>
  )
}
