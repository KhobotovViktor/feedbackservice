import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId");

    const questions = await prisma.question.findMany({
      where: templateId ? { templateId } : {},
      orderBy: { order: "asc" },
    });
    return NextResponse.json(questions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, templateId } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const lastQuestion = await prisma.question.findFirst({
      where: templateId ? { templateId } : {},
      orderBy: { order: "desc" },
    });
    const order = lastQuestion ? lastQuestion.order + 1 : 1;

    const question = await prisma.question.create({
      data: { text, order, templateId: templateId || null },
    });
    return NextResponse.json(question);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Mode 1: reorder — body { reorder: [id, id, …] }. Assigns order by the
    // array index in one transaction so the list can't end up half-moved.
    if (Array.isArray(body.reorder)) {
      const ids = body.reorder.filter((x: unknown): x is string => typeof x === "string");
      await prisma.$transaction(
        ids.map((id: string, idx: number) =>
          prisma.question.update({ where: { id }, data: { order: idx + 1 } })
        )
      );
      return NextResponse.json({ success: true, reordered: ids.length });
    }

    // Mode 2: edit one question — body { id, text?, type?, options?, showIf? }.
    // Only provided keys are touched (partial update).
    const { id, text, type, options, showIf } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const data: { text?: string; type?: string; options?: string[]; showIf?: string | null } = {};
    if (typeof text === "string" && text.trim()) data.text = text.trim();
    if (typeof type === "string") {
      const VALID_TYPES = ["RATING", "NPS", "CHOICE", "YESNO", "TEXT"];
      data.type = VALID_TYPES.includes(type) ? type : "RATING";
    }
    if (Array.isArray(options)) {
      data.options = options.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 12);
    }
    if (showIf !== undefined) {
      data.showIf = showIf === "negative" || showIf === "positive" ? showIf : null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const updated = await prisma.question.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "No ID" }, { status: 400 });

    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
