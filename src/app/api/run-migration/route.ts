import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    // Add columns manually to bypass the need for npx prisma db push on Vercel
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sosEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageMeds" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "autoSnoozeEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "autoSnoozeAfterSeconds" INTEGER NOT NULL DEFAULT 60;`)
    
    // Add Task columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "time" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "triggerAlarm" BOOLEAN NOT NULL DEFAULT false;`)

    // Add ElderProfile column
    await prisma.$executeRawUnsafe(`ALTER TABLE "ElderProfile" ADD COLUMN IF NOT EXISTS "askSymptoms" BOOLEAN NOT NULL DEFAULT true;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ElderProfile" ADD COLUMN IF NOT EXISTS "stickyAlarmNotification" BOOLEAN NOT NULL DEFAULT true;`)

    // Add Medication Duration columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "durationValue" INTEGER;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "durationUnit" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "durationNotified" BOOLEAN NOT NULL DEFAULT false;`)

    return NextResponse.json({ 
      success: true, 
      message: "Database updated successfully! All schema changes applied." 
    })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ 
      success: false, 
      message: "Migration failed.", 
      error: error?.message 
    }, { status: 500 })
  }
}
