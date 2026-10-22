import { prisma } from "@/lib/prisma"

export async function GlobalNotice() {
  try {
    const activeNotices = await prisma.notice.findMany({
      where: { 
        isActive: true,
        NOT: {
          title: { startsWith: "__SYSTEM_" }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    if (!activeNotices || activeNotices.length === 0) return null

    return (
      <div className="w-full space-y-3 mb-6">
        {activeNotices.map(notice => (
          <div key={notice.id} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl transform translate-x-2 -translate-y-2">
              📢
            </div>
            <h3 className="font-bold text-lg mb-1 relative z-10">{notice.title}</h3>
            <p className="opacity-90 relative z-10 font-medium">{notice.content}</p>
          </div>
        ))}
      </div>
    )
  } catch (error) {
    console.error("GlobalNotice error (e.g. database quota or offline):", error)
    return null
  }
}

