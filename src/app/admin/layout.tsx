import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LogoutButton } from "@/components/LogoutButton"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6">
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Console</h1>
          <p className="text-slate-400 text-sm mt-1">ElderSaath Management</p>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          <Link href="/admin" className="block px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
            📊 Overview
          </Link>
          <Link href="/admin/users" className="block px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
            👥 Users
          </Link>
          <Link href="/admin/links" className="block px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
            🔗 Connections
          </Link>
          <Link href="/admin/notices" className="block px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
            📢 Notices & Startup Media
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm font-bold text-white">{session.user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}
