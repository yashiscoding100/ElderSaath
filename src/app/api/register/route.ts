import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ELDER", "CHILD"]),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password, role } = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    })

    // If role is elder, create an elder profile automatically
    if (role === "ELDER") {
      await prisma.elderProfile.create({
        data: {
          userId: user.id,
        },
      })
    }

    return NextResponse.json(
      { message: "User registered successfully" },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Registration error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json(
      { message: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
