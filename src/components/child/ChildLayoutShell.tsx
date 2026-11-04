"use client"

import { setActiveElderAction } from "@/app/child/actions/elderActions"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Activity, 
  Pill, 
  ListTodo, 
  FileText, 
  Files,
  FlaskConical,
  AlertTriangle, 
  Users, 
  Settings,
  Menu,
  X,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Check
} from "lucide-react"

import { signOut } from "next-auth/react"
import { NotificationBell } from "../NotificationBell"

const NAV_ITEMS = [
  { name: "Dashboard", href: "/child/dashboard", icon: LayoutDashboard },
  { name: "Health Analytics", href: "/child/health", icon: Activity },
  { name: "Medications", href: "/child/medications", icon: Pill },
  { name: "Things to Do", href: "/child/tasks", icon: ListTodo },
  { name: "Documents", href: "/child/documents", icon: Files },
  { name: "Test Reports", href: "/child/lab-reports", icon: FlaskConical },
  { name: "Care Team", href: "/child/team", icon: Users },
  { name: "Settings", href: "/child/settings", icon: Settings },
]

export function ChildLayoutShell({ 
  children, 
  elderName = "Mom", 
  userName = "Family Member",
  parentCount = 0,
  hasEmergency = false,
  elders = [],
  activeElderId = ""
}: { 
  children: React.ReactNode, 
  elderName?: string, 
  userName?: string,
  parentCount?: number,
  hasEmergency?: boolean
  elders?: { id: string, name: string }[]
  activeElderId?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [elderDropdownOpen, setElderDropdownOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Separate refs for mobile and desktop dropdowns to prevent outside-click interference
  const mobileElderDropdownRef = useRef<HTMLDivElement>(null)
  const desktopElderDropdownRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (
        (!mobileElderDropdownRef.current || !mobileElderDropdownRef.current.contains(target)) &&
        (!desktopElderDropdownRef.current || !desktopElderDropdownRef.current.contains(target))
      ) {
        setElderDropdownOpen(false)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [])

  // Robust, Android-compatible elder switcher
  const handleSwitchElder = async (targetElderId: string) => {
    if (targetElderId === activeElderId) {
      setElderDropdownOpen(false)
      setMobileMenuOpen(false)
      return
    }

    setIsSwitching(true)
    try {
      // 1. Immediately set client-side cookie with SameSite=Lax (universal Android WebView compatibility)
      document.cookie = `activeElderId=${targetElderId}; path=/; max-age=2592000; SameSite=Lax`

      // 2. Set in localStorage for instant client fallback
      try {
        localStorage.setItem("activeElderId", targetElderId)
      } catch {}

      // 3. Set native Capacitor cookie if running inside Android Capacitor app
      try {
        const cap = (window as any).Capacitor
        if (cap?.Plugins?.CapacitorCookies?.setCookie) {
          await cap.Plugins.CapacitorCookies.setCookie({
            url: window.location.origin,
            key: "activeElderId",
            value: targetElderId,
            path: "/",
          })
        }
      } catch {}

      // 4. POST to server endpoint to guarantee server-side cookies store is updated
      await fetch("/api/child/active-elder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderId: targetElderId }),
        cache: "no-store",
      })

      // 5. Trigger Next.js Server Action revalidation
      try {
        await setActiveElderAction(targetElderId, pathname)
      } catch {}

      // 6. Hard reload to current route with cache-busting query so server re-renders the new elder
      const cleanPath = pathname.split("?")[0]
      window.location.href = `${cleanPath}?activeElderId=${targetElderId}&_t=${Date.now()}`
    } catch (err) {
      console.error("Error switching care recipient:", err)
      window.location.reload()
    } finally {
      setElderDropdownOpen(false)
      setMobileMenuOpen(false)
    }
  }

  const avatarDropdownNode = (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all outline-none"
      >
        {userName.charAt(0).toUpperCase()}
      </button>
      
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 animate-fade-in">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
          </div>
          <button 
            type="button"
            onClick={() => { setDropdownOpen(false); router.push("/child/settings"); }} 
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
          >
            <Settings className="w-4 h-4" />Account Settings
          </button>
          <button 
            type="button"
            onClick={async () => { 
              localStorage.removeItem("es_persistent_email"); 
              localStorage.removeItem("es_persistent_password"); 
              await signOut({ redirect: false }); 
              window.location.href = "/login"; 
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-3.5 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(true)} 
            className="p-1 -ml-1 text-slate-700 hover:text-slate-900 transition"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight leading-none text-slate-900">ElderSaath</span>
            
            {/* Mobile Care Recipient Dropdown Pill */}
            <div className="relative mt-1" ref={mobileElderDropdownRef}>
              <button 
                type="button"
                onClick={() => setElderDropdownOpen(!elderDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 transition shadow-sm"
              >
                <Users className="w-3 h-3 text-blue-600" />
                <span className="truncate max-w-[120px]">{isSwitching ? "Switching..." : elderName}</span>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${elderDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {elderDropdownOpen && elders && elders.length > 0 && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-fade-in">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Switch Care Recipient</p>
                    <span className="text-[10px] font-semibold text-slate-400">{elders.length} linked</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {elders.map(elder => {
                      const isSelected = elder.id === activeElderId
                      return (
                        <button 
                          key={elder.id}
                          type="button"
                          onClick={() => handleSwitchElder(elder.id)}
                          className={`w-full text-left px-3.5 py-2.5 text-sm font-semibold transition-colors flex justify-between items-center ${
                            isSelected 
                              ? "bg-blue-50 text-blue-700" 
                              : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                          }`}
                        >
                          <span className="truncate">{elder.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {avatarDropdownNode}
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-50 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col
        md:translate-x-0 md:static md:w-64 md:shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <span className="font-black text-xl tracking-tight text-slate-900">ElderSaath</span>
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(false)} 
            className="md:hidden p-1 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
          {/* Mobile Drawer Dedicated Care Recipient Switcher */}
          {elders && elders.length > 0 && (
            <div className="md:hidden mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Care Recipient
                </span>
                <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full">
                  {elders.length} Linked
                </span>
              </div>
              <div className="space-y-1">
                {elders.map(elder => {
                  const isSelected = elder.id === activeElderId
                  return (
                    <button
                      key={elder.id}
                      type="button"
                      onClick={() => handleSwitchElder(elder.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-between transition-all ${
                        isSelected 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "text-slate-700 hover:bg-slate-200/70 active:bg-slate-200 bg-white border border-slate-200/60"
                      }`}
                    >
                      <span className="truncate">{elder.name}</span>
                      {isSelected ? (
                        <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">Switch</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
              <button 
                type="button"
                onClick={async () => { 
                  localStorage.removeItem("es_persistent_email"); 
                  localStorage.removeItem("es_persistent_password"); 
                  await signOut({ redirect: false }); 
                  window.location.href = "/login"; 
                }}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 transition truncate mt-0.5 flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                Care Recipient
                {parentCount > 0 && (
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {parentCount} Linked
                  </span>
                )}
              </span>
              <div className="relative" ref={desktopElderDropdownRef}>
                <button 
                  type="button"
                  onClick={() => setElderDropdownOpen(!elderDropdownOpen)}
                  className="flex items-center gap-1.5 font-bold text-slate-900 hover:text-blue-600 transition-colors mt-0.5"
                >
                  <span>{isSwitching ? "Switching..." : elderName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${elderDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {elderDropdownOpen && elders && elders.length > 0 && (
                  <div className="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in">
                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Care Recipient</p>
                    {elders.map(elder => {
                      const isSelected = elder.id === activeElderId
                      return (
                        <button 
                          key={elder.id}
                          type="button"
                          onClick={() => handleSwitchElder(elder.id)}
                          className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex justify-between items-center ${
                            isSelected 
                              ? "bg-blue-50 text-blue-700" 
                              : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                          }`}
                        >
                          <span>{elder.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all w-64"
              />
            </div>
            <NotificationBell />
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            {avatarDropdownNode}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

    </div>
  )
}
