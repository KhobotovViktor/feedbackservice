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
    const { text, order, templateId, type, options, showIf } = body;

    if (!text || !templateId) {
      return NextResponse.json({ error: "Text and templateId are required" }, { status: 400 });
    }

    // Normalise the new question-type fields. Unknown type → RATING; options
    // only kept for CHOICE; showIf limited to the two conditional values.
    const VALID_TYPES = ["RATING", "NPS", "CHOICE", "YESNO", "TEXT"];
    const qType = VALID_TYPES.includes(type) ? type : "RATING";
    const qOptions =
      qType === "CHOICE" && Array.isArray(options)
        ? options.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 12)
        : [];
    const qShowIf = showIf === "negative" || showIf === "positive" ? showIf : null;

    const question = await prisma.question.create({
      data: {
        text,
        order: order || 0,
        templateId,
        type: qType,
        options: qOptions,
        showIf: qShowIf,
      }
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create template question" }, { status: 500 });
  }
}
