import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, city, yandexUrl, dgisUrl, googleUrl, externalId, templateId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const branch = await (prisma as any).branch.update({
      where: { id },
      data: {
        name,
        city,
        yandexUrl,
        dgisUrl,
        googleUrl,
        externalId,
        templateId: templateId || null
      }
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await (prisma as any).branch.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
