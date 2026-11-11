"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/admin", label: "📊 Overview", exact: true },
  { href: "/admin/users", label: "👥 Users", exact: false },
  { href: "/admin/user-management", label: "🛠️ User Management", exact: false },
  { href: "/admin/links", label: "🔗 Connections", exact: false },
  { href: "/admin/notices", label: "📢 Notices & Startup Media", exact: false }
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-4 py-4 space-y-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-3 rounded-lg transition font-medium ${
              isActive
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
