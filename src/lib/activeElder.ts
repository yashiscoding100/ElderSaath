import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function getActiveElder(childId: string, elderIdOverride?: string) {
  const cookieStore = await cookies()
  const activeElderId = elderIdOverride || cookieStore.get("activeElderId")?.value

  if (activeElderId) {
    const rel = await prisma.caregiverRelationship.findUnique({
      where: { elderId_childId: { elderId: activeElderId, childId: childId } },
      include: { elder: { include: { elderProfile: true } } }
    })
    if (rel && rel.status === "ACTIVE") return rel
  }

  // Fallback to first active relationship
  return await prisma.caregiverRelationship.findFirst({
    where: { childId, status: "ACTIVE" },
    include: { elder: { include: { elderProfile: true } } }
  })
}
