import { AddTaskForm } from "./AddTaskForm"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveElder } from "@/lib/activeElder"
import { redirect } from "next/navigation"
import { Bell, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { DeleteTaskButton } from "./DeleteTaskButton"
import { EditTaskModal } from "./EditTaskModal"

export default async function ChildThingsToDo() {
  const session = await auth()
  
  if (!session || session.user.role !== "CHILD") {
    redirect("/login")
  }

  const relationship = await getActiveElder(session.user.id)

  if (!relationship) {
  return (
      <div className="min-h-screen p-6 flex justify-center items-center">
        <p className="text-gray-500">Please link an elder account first.</p>
      </div>
    )
  }

  const tasks = await prisma.task.findMany({
    where: { elderId: relationship.elderId },
    orderBy: { createdAt: 'desc' }
  })


  const formatFreq = (f: string) => {
    if (!f || f.toUpperCase() === "DAILY" || f === "0,1,2,3,4,5,6") return "Every Day";
    if (f.toUpperCase() === "WEEKLY") return "Weekly";
    if (f.toUpperCase() === "MONTHLY") return "Monthly";
    if (f.toUpperCase() === "ONCE") return "Once";
    const map: any = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat" };
    return f.split(",").map(d => map[d.trim()]).filter(Boolean).join(", ");
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/child/dashboard" 
            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Care Tasks</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage reminders and things to do for {relationship.elder.name}</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <AddTaskForm elderId={relationship.elderId} />
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active tasks</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">Add a new thing to do to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-xs">
                <tr>
                  <th className="p-4 px-6">Title</th>
                  <th className="p-4 px-6">Description</th>
                  <th className="p-4 px-6">Time</th>
                  <th className="p-4 px-6">Frequency</th>
                  <th className="p-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50 transition group">
                    <td className="p-4 px-6 font-bold text-slate-900">{task.title}</td>
                    <td className="p-4 px-6 text-slate-600">{task.description || "-"}</td>
                    
                      <td className="p-4 px-6">
                        {task.time ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-600">{task.time}</span>
                            {task.triggerAlarm && <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded"><Bell className="w-3 h-3" /> ALARM</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 px-6 text-slate-500 uppercase tracking-wider text-xs font-semibold">{formatFreq(task.frequency)}</td>
                      <td className="p-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditTaskModal task={task} />
                          <DeleteTaskButton id={task.id} />
                        </div>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
