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
  
  // Fetch branch info if present
  let branchInfo = null;
  if (branchId) {
    branchInfo = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        template: {
          include: {
            questions: {
              orderBy: { order: "asc" }
            }
          }
        }
      }
    });
  }

  // If no branch template, but templateId is in token (e.g. from B24 setting)
  if ((!branchInfo || !branchInfo.template) && templateId) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: templateId },
      include: {
        questions: {
          orderBy: { order: "asc" }
        }
      }
    });
    if (template) {
      if (!branchInfo) {
        branchInfo = { template } as any;
      } else {
        branchInfo.template = template as any;
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
