export const dynamic = 'force-dynamic';
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { UserRow } from "./UserRow"
import { CreateUserModal } from "./CreateUserModal"
import { BroadcastButton } from "./BroadcastButton"
import { CreateFamilyModal } from "./CreateFamilyModal"

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Users</h2>
          <p className="text-slate-500 mt-2">
            View accounts, create users, reset passwords, or block/delete users. Configure Auto-Snooze and per-account settings in{" "}
            <Link href="/admin/user-management" className="text-violet-600 font-bold hover:underline">
              User Management
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-3">
          <BroadcastButton />
          <CreateFamilyModal allUsers={users} />
          <CreateUserModal />
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Name</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Email</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Role</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase">Joined</th>
                <th className="p-4 font-bold text-slate-600 text-sm uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
