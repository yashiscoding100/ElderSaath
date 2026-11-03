import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { GameMenu } from "./GameMenu"

export default async function ElderGames() {
  const session = await auth()

  if (!session || session.user.role !== "ELDER") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-sm mb-6 text-center relative">
        <Link href="/elder/home" className="absolute left-4 top-4 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700 shadow-sm" title="Back to Home">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900">Brain & Wellness</h1>
        <p className="text-gray-500 mt-2">Keep your mind active!</p>
      </div>

      <GameMenu />
      
      <div className="w-full max-w-md pt-6 mt-auto">
        <a href="/elder/home" className="block w-full py-4 text-center bg-gray-200 text-gray-800 font-bold rounded-2xl text-xl hover:bg-gray-300 transition-colors">
          Back Home
        </a>
      </div>
    </div>
  )
}
