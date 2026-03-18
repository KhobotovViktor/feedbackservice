import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const branchesRaw = await prisma.branch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { questions: true, surveyResponses: true }
        },
        surveyResponses: {
          select: { averageScore: true }
        },
        template: {
          select: { id: true, name: true }
        }
      }
    });

    const branches = branchesRaw.map(branch => {
      const scores = branch.surveyResponses.map(r => r.averageScore);
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0.0";
      
      const { surveyResponses, ...rest } = branch;
      return { ...rest, averageScore: avg };
    });

    return NextResponse.json(branches);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, city, yandexUrl, dgisUrl, googleUrl, externalId, templateId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        city,
        yandexUrl,
        dgisUrl,
        googleUrl,
        externalId,
        templateId
      }
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
