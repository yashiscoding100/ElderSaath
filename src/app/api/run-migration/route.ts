import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Add columns manually to bypass the need for npx prisma db push on Vercel
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sosEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageMeds" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "autoSnoozeEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "autoSnoozeAfterSeconds" INTEGER NOT NULL DEFAULT 60;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alarmButtonOrder" TEXT NOT NULL DEFAULT 'TAKE_FIRST';`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alarmTakeBtnColor" TEXT NOT NULL DEFAULT '#10B981';`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alarmSnoozeBtnColor" TEXT NOT NULL DEFAULT '#334155';`)
    
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

    // Add Medication Special Post-Alarm Notice columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeType" TEXT DEFAULT 'TEXT';`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeText" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeAudioUrl" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeAudioName" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeMaxCount" INTEGER NOT NULL DEFAULT 5;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeShownCount" INTEGER NOT NULL DEFAULT 0;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "specialNoticeVersion" TEXT;`)

    // Create MedicationNote notepad table (separate from alarms)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MedicationNote" (
        "id" TEXT NOT NULL,
        "elderId" TEXT NOT NULL,
        "authorId" TEXT,
        "authorName" TEXT,
        "authorRole" TEXT,
        "medicineName" TEXT,
        "timingText" TEXT,
        "doctorName" TEXT,
        "durationText" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MedicationNote_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "MedicationNote_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "MedicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MedicationNote_elderId_updatedAt_idx" ON "MedicationNote"("elderId", "updatedAt");`)

    return NextResponse.json({ 
      success: true, 
      message: "Database updated successfully! All schema changes applied." 
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error(error)
    return NextResponse.json({ 
      success: false, 
      message: "Migration failed.", 
      error: msg 
    }, { status: 500 })
  }
}
