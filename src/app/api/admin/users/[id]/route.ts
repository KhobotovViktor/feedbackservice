import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const me = await getCurrentUser();
  return me?.role === "ADMIN" ? me : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Owner ("Хоботов Виктор") = the first account created OR a name match.
    // Locked: always ADMIN and password unchangeable from this panel.
    const first = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const protectedOwner =
      target.id === first?.id || /хоботов|hobotov/i.test(target.username);

    const data: {
      role?: "ADMIN" | "MANAGER";
      password?: string;
      branches?: { set: { id: string }[] };
    } = {};

    if (body.role === "ADMIN" || body.role === "MANAGER") {
      if (protectedOwner) {
        if (body.role !== "ADMIN") {
          return NextResponse.json(
            { error: "Владелец всегда администратор — роль изменить нельзя." },
            { status: 400 }
          );
        }
        // role === ADMIN for the owner is a no-op; leave data.role unset.
      } else {
        data.role = body.role;
      }
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      if (protectedOwner) {
        return NextResponse.json(
          { error: "Пароль владельца нельзя изменить в этой панели." },
          { status: 400 }
        );
      }
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: "Пароль должен быть не короче 6 символов" },
          { status: 400 }
        );
      }
      data.password = await hashPassword(body.password);
    }

    if (Array.isArray(body.branchIds)) {
      const ids = body.branchIds.filter((x: unknown): x is string => typeof x === "string");
      data.branches = { set: ids.map((bid: string) => ({ id: bid })) };
    }

    // Guard: don't let the last ADMIN demote themselves and lock everyone out.
    if (data.role === "MANAGER" && target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Нельзя понизить последнего администратора" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        branches: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    if (me.userId && id === me.userId) {
      return NextResponse.json({ error: "Нельзя удалить самого себя" }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Нельзя удалить последнего администратора" },
          { status: 400 }
        );
      }
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Не удалось удалить" }, { status: 500 });
  }
}
