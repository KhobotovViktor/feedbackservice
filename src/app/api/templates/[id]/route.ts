import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.questionTemplate.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" }
        }
      }
    });
    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    const template = await prisma.questionTemplate.update({
      where: { id },
      data: { name }
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.questionTemplate.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
