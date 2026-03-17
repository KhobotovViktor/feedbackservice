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

    // Handle B24 Field Mapping
    try {
      const settings = await prisma.settings.findMany({
        where: { key: { startsWith: "b24_" } }
      });
      const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      if (settingsMap.b24_webhook_url) {
        const cleanBaseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");
        
        const updateData: any = {};
        
        // Map scores
        // We look for specific questions by keywords
        const questionsRes = await fetch(`${req.nextUrl.origin}/api/questions`);
        const questions = await questionsRes.json();
        
        const answersMap = answers as Record<string, number>;
        
        // 1. Quality of service
        if (settingsMap.b24_field_quality) {
          const q = questions.find((q: any) => 
            q.text.toLowerCase().includes("качество обслуживания") || 
            q.text.toLowerCase().includes("аллея мебели")
          );
          if (q && answersMap[q.id]) {
            updateData[settingsMap.b24_field_quality] = answersMap[q.id];
          } else if (questions[0] && answersMap[questions[0].id]) {
            // Fallback to first question
            updateData[settingsMap.b24_field_quality] = answersMap[questions[0].id];
          }
        }

        // 2. Support worker
        if (settingsMap.b24_field_support) {
          const q = questions.find((q: any) => 
            q.text.toLowerCase().includes("работу сотрудника") || 
            q.text.toLowerCase().includes("службы поддержки")
          );
          if (q && answersMap[q.id]) {
            updateData[settingsMap.b24_field_support] = answersMap[q.id];
          } else if (questions[1] && answersMap[questions[1].id]) {
            // Fallback to second question
            updateData[settingsMap.b24_field_support] = answersMap[questions[1].id];
          }
        }

        // 3. Average
        if (settingsMap.b24_field_average) {
          updateData[settingsMap.b24_field_average] = averageScore;
        }

        // 4. Comment (only if negative, e.g. < 4)
        if (settingsMap.b24_field_comment && averageScore < 4 && comment) {
          updateData[settingsMap.b24_field_comment] = comment;
        }

        if (Object.keys(updateData).length > 0) {
          console.log(`Updating Bitrix24 Deal ${dealId} with:`, JSON.stringify(updateData));
          await fetch(`${cleanBaseUrl}/crm.deal.update.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: dealId,
              fields: updateData
            })
          });
        }
      }
    } catch (b24Error) {
      console.error("Failed to update B24 fields:", b24Error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
