import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: { name?: string; branchId?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    // branchId may be set, changed, or cleared (null).
    if (body.branchId !== undefined) {
      data.branchId = body.branchId || null;
    }

    const city = await prisma.city.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(city);
  } catch (error) {
    console.error("UPDATE_CITY_ERROR:", error);
    return NextResponse.json({ error: "Failed to update city" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.city.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE_CITY_ERROR:", error);
    return NextResponse.json({ error: "Failed to delete city" }, { status: 500 });
  }
}
