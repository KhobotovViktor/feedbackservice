import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("templateId");

  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  try {
    const questions = await prisma.question.findMany({
      where: { templateId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(questions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch template questions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, order, templateId } = body;

    if (!text || !templateId) {
      return NextResponse.json({ error: "Text and templateId are required" }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: {
        text,
        order: order || 0,
        templateId
      }
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create template question" }, { status: 500 });
  }
}
