import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

// User management — ADMIN only. Path is session-gated by proxy.ts; we add an
// explicit role check here so a logged-in MANAGER can't manage accounts.
async function requireAdmin() {
  const me = await getCurrentUser();
  return me?.role === "ADMIN" ? me : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      branches: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = body.role === "MANAGER" ? "MANAGER" : "ADMIN";
    const branchIds: string[] = Array.isArray(body.branchIds)
      ? body.branchIds.filter((x: unknown): x is string => typeof x === "string")
      : [];

    if (username.length < 2) {
      return NextResponse.json({ error: "Имя пользователя слишком короткое" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь с таким именем уже существует" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        username,
        password: await hashPassword(password),
        role,
        // MANAGER without branches sees nothing useful, but that's a valid
        // intermediate state right after creation; the admin assigns branches.
        branches: role === "MANAGER" ? { connect: branchIds.map((id) => ({ id })) } : undefined,
      },
      select: { id: true, username: true, role: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Не удалось создать пользователя" }, { status: 500 });
  }
}
