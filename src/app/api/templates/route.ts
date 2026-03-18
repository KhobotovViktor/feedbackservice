import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.questionTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { questions: true, branches: true }
        }
      }
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await prisma.questionTemplate.create({
      data: { name }
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
