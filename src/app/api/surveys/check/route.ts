import { NextRequest, NextResponse } from "next/server";
import { verifySurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = await verifySurveyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Недействительная ссылка" }, { status: 401 });
  }

  const { clientId, branchId, isTest, templateId } = payload;

  // We only return a narrow projection of the branch to the survey page —
  // declare it once and keep the rest of this handler within that shape.
  type Question = { id: string; text: string; order: number };
  type Template = { id: string; name: string; questions: Question[] };
  type BranchInfo = {
    id?: string;
    yandexUrl?: string | null;
    dgisUrl?: string | null;
    googleUrl?: string | null;
    template: Template | null;
  };

  let branchInfo: BranchInfo | null = null;
  if (branchId) {
    const b = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        template: {
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (b) {
      branchInfo = {
        id: b.id,
        yandexUrl: b.yandexUrl,
        dgisUrl: b.dgisUrl,
        googleUrl: b.googleUrl,
        template: b.template
          ? { id: b.template.id, name: b.template.name, questions: b.template.questions }
          : null,
      };
    }
  }

  // If no branch template, but templateId is in token (e.g. from B24 setting)
  if ((!branchInfo || !branchInfo.template) && templateId) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: templateId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (template) {
      const tpl: Template = {
        id: template.id,
        name: template.name,
        questions: template.questions,
      };
      if (!branchInfo) {
        branchInfo = { template: tpl };
      } else {
        branchInfo.template = tpl;
      }
    }
  }

  // Skip frequency check for tests
  if (isTest) {
    return NextResponse.json({ 
      success: true,
      branchId: branchId || null,
      branch: branchInfo || null,
      isTest: true
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentSurvey = await prisma.surveyResponse.findFirst({
    where: {
      clientId,
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
  });

  if (recentSurvey) {
    return NextResponse.json(
      { error: "Вы уже проходили опрос в последние 6 месяцев. Спасибо!" },
      { status: 429 }
    );
  }

  return NextResponse.json({ 
    success: true,
    branchId: branchId || null,
    branch: branchInfo || null
  });
}
