import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, login as setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // Auto-seed admin if database is empty or user missing
    const adminUsername = "Хоботов Виктор";
    const adminPassword = "hymp512U64cp8";
    
    let user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      // Auto-seed original admin if it's the one trying to log in but missing
      const adminUsername = "Хоботов Виктор";
      if (username === adminUsername) {
        const adminPassword = "hymp512U64cp8";
        const hashedPassword = await hashPassword(adminPassword);
        user = await prisma.user.create({
          data: {
            username: adminUsername,
            password: hashedPassword,
          }
        });
        console.log("Admin user seeded successfully");
      } else {
        return NextResponse.json({ error: "Неверное имя пользователя" }, { status: 401 });
      }
    }

    // Verify credentials
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
    }

    // Set session
    await setSession(username);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
