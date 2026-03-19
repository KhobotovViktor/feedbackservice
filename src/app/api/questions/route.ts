import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("templateId");

  const questions = await prisma.question.findMany({
    where: templateId ? { templateId } : {},
    orderBy: { order: "asc" },
  });
  return NextResponse.json(questions);
}

export async function POST(req: NextRequest) {
  const { text, templateId } = await req.json();
  
  const lastQuestion = await prisma.question.findFirst({
    where: templateId ? { templateId } : {},
    orderBy: { order: "desc" },
  });
  const order = lastQuestion ? lastQuestion.order + 1 : 1;
  
  const question = await prisma.question.create({
    data: { text, order, templateId: templateId || null },
  });
  return NextResponse.json(question);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No ID" }, { status: 400 });
  
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
