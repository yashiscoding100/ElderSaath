import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const DEMO_CONFIG_NOTICE_TITLE = "__SYSTEM_DEMO_ENABLED__"
export const DEMO_PARENT_EMAIL = "parent.demo@eldersaath.com"
export const DEMO_CHILD_EMAIL = "child.demo@eldersaath.com"
export const DEMO_PASSWORD = "DemoUser@123"

export async function isDemoEnabled(): Promise<boolean> {
  try {
    const configNotice = await prisma.notice.findFirst({
      where: { title: DEMO_CONFIG_NOTICE_TITLE }
    })
    // If not found, default to true so recruiters can immediately view demo
    if (!configNotice) return true
    return configNotice.isActive
  } catch (err) {
    console.error("Error reading demo config:", err)
    return true
  }
}

export async function setDemoEnabled(enabled: boolean) {
  const existing = await prisma.notice.findFirst({
    where: { title: DEMO_CONFIG_NOTICE_TITLE }
  })

  if (existing) {
    await prisma.notice.update({
      where: { id: existing.id },
      data: { isActive: enabled }
    })
  } else {
    await prisma.notice.create({
      data: {
        title: DEMO_CONFIG_NOTICE_TITLE,
        content: "System configuration flag for recruiter demo button on login page",
        isActive: enabled
      }
    })
  }
}

export async function ensureDemoAccountsExist() {
  try {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10)

    // 1. Ensure Parent (Elder) Demo Account
    let parent = await prisma.user.findUnique({
      where: { email: DEMO_PARENT_EMAIL }
    })

    if (!parent) {
      parent = await prisma.user.create({
        data: {
          name: "Ramesh Sharma (Demo Parent)",
          email: DEMO_PARENT_EMAIL,
          password: hashedPassword,
          role: "ELDER",
          isBlocked: false,
          elderProfile: {
            create: {
              bloodGroup: "O+",
              gender: "MALE",
              medicalConditions: "Hypertension, Mild Diabetes",
              allergies: "Penicillin",
              preferredHospital: "City General Hospital",
              requiredVitals: "BP,SUGAR,SPO2,PULSE,TEMP,WEIGHT",
              vitalCheckDays: "0,1,2,3,4,5,6"
            }
          }
        }
      })
    }

    // 2. Ensure Child (Caregiver) Demo Account
    let child = await prisma.user.findUnique({
      where: { email: DEMO_CHILD_EMAIL }
    })

    if (!child) {
      child = await prisma.user.create({
        data: {
          name: "Aakash Sharma (Demo Child)",
          email: DEMO_CHILD_EMAIL,
          password: hashedPassword,
          role: "CHILD",
          isBlocked: false
        }
      })
    }

    // 3. Ensure Caregiver Relationship Linking Parent and Child
    const existingRel = await prisma.caregiverRelationship.findUnique({
      where: {
        elderId_childId: {
          elderId: parent.id,
          childId: child.id
        }
      }
    })

    if (!existingRel) {
      await prisma.caregiverRelationship.create({
        data: {
          elderId: parent.id,
          childId: child.id,
          status: "ACTIVE",
          priority: 1
        }
      })
    } else if (existingRel.status !== "ACTIVE") {
      await prisma.caregiverRelationship.update({
        where: { id: existingRel.id },
        data: { status: "ACTIVE" }
      })
    }

    // 4. Seed sample health data if parent has no measurements
    const countMeasurements = await prisma.healthMeasurement.count({
      where: { elderId: parent.id }
    })

    if (countMeasurements === 0) {
      const now = new Date()
      await prisma.healthMeasurement.createMany({
        data: [
          { elderId: parent.id, type: "BP", value: "120/80", unit: "mmHg", timestamp: now, notes: "Normal check" },
          { elderId: parent.id, type: "SUGAR", value: "105", unit: "mg/dL", timestamp: now, notes: "Fasting" },
          { elderId: parent.id, type: "SPO2", value: "98", unit: "%", timestamp: now },
          { elderId: parent.id, type: "PULSE", value: "72", unit: "bpm", timestamp: now },
          { elderId: parent.id, type: "TEMP", value: "98.6", unit: "°F", timestamp: now }
        ]
      })
    }

    // 5. Seed sample medications if none exist
    const countMeds = await prisma.medication.count({
      where: { elderId: parent.id }
    })

    if (countMeds === 0) {
      await prisma.medication.createMany({
        data: [
          {
            elderId: parent.id,
            name: "Amlodipine 5mg",
            dosage: "1 Tablet",
            frequency: "DAILY",
            time: "08:00 AM",
            instructions: "Take after breakfast with water"
          },
          {
            elderId: parent.id,
            name: "Metformin 500mg",
            dosage: "1 Tablet",
            frequency: "DAILY",
            time: "08:30 PM",
            instructions: "Take after dinner"
          }
        ]
      })
    }

    return { parent, child }
  } catch (err) {
    console.error("ensureDemoAccountsExist error:", err)
    return null
  }
}
