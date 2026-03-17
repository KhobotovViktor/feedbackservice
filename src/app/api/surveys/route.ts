import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySurveyToken } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const { token, answers, comment, averageScore } = await req.json();

    const payload = await verifySurveyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { clientId, dealId } = payload;

    // Check 6-month constraint
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
        { error: "Вы уже проходили опрос недавно. Спасибо!" },
        { status: 429 }
      );
    }

    // Save response
    await prisma.surveyResponse.create({
      data: {
        clientId,
        dealId,
        averageScore,
        answers,
        comment,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
