import { Bell } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ElderAddTaskForm } from "./ElderAddTaskForm"
import { DeleteTaskButton } from "@/app/child/tasks/DeleteTaskButton"
import { EditTaskModal } from "@/app/child/tasks/EditTaskModal"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function ElderThingsToDo() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  const tasks = await prisma.task.findMany({
    where: { elderId: session.user.id },
    include: {
      logs: {
        where: {
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }
    }
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-sm mb-6 text-center relative">
        <Link href="/elder/home" className="absolute left-4 top-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Things to Do</h1>
        <p className="text-gray-500 mt-2">Here are the things you need to do today.</p>
      </div>
      
      <div className="w-full max-w-md">
        <ElderAddTaskForm />
      </div>

      <div className="w-full max-w-md space-y-4 flex-1">
        {tasks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
             <p className="text-xl text-gray-600">No specific notes for today. Have a wonderful day!</p>
          </div>
        ) : (
          tasks.map(task => {
            const isCompleted = task.logs.some(l => l.status === "COMPLETED")
            return (
              <div key={task.id} className={`p-6 rounded-2xl shadow-sm border flex items-center justify-between transition-colors ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                <div>

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {(task as any).time && (
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-bold text-sm">
                          {(task as any).time}
                        </span>
                      )}
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-sm">
                        {formatFreq(task.frequency)}
                      </span>
                      {(task as any).triggerAlarm && <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md"><Bell className="w-3 h-3" /> ALARM</span>}
                      <EditTaskModal task={task} variant="elder" />
                      <DeleteTaskButton id={task.id} />
                    </div>
                  <h2 className={`text-2xl font-bold ${isCompleted ? 'text-green-800 line-through opacity-70' : 'text-gray-900'}`}>
                    {task.title}
                  </h2>
                  {task.description && <p className="text-lg text-gray-500 mt-1">{task.description}</p>}
                </div>
                {!isCompleted && (
                  <form action={async () => {
                    "use server"
                    await prisma.taskLog.create({ data: { taskId: task.id, elderId: session.user.id } })
                  }}>
                    <button type="submit" className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                      ◯
                    </button>
                  </form>
                )}
                {isCompleted && (
                  <div className="w-12 h-12 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-2xl font-bold">
                    ✓
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      
      <div className="w-full max-w-md pt-6">
        <a href="/elder/home" className="block w-full py-4 text-center bg-gray-200 text-gray-800 font-bold rounded-2xl text-xl hover:bg-gray-300 transition-colors">
          Back Home
        </a>
      </div>
    </div>
  )
}
