import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySurveyToken } from "@/lib/auth-utils";
import { getSession } from "@/lib/auth";
import { getAppOrigin } from "@/lib/url";

function isSafeB24Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return false;
    return host.includes("bitrix24.");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, answers, comment } = await req.json();

    const payload = await verifySurveyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { clientId, dealId, isTest } = payload;

    // Validate answers
    const answersMap = (answers ?? {}) as Record<string, number>;
    const scores = Object.values(answersMap).filter(
      (v) => typeof v === "number" && !isNaN(v)
    );
    if (scores.length === 0) {
      return NextResponse.json({ error: "No valid answers provided" }, { status: 400 });
    }

    // Recalculate averageScore server-side — never trust client value
    const averageScore =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

    // Sandbox mode for testing
    if (isTest) {
      console.log("Test survey detected. Skipping persistence and B24 updates.");
      return NextResponse.json({ success: true, isTest: true });
    }

    // Check 6-month constraint
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentSurvey = await prisma.surveyResponse.findFirst({
      where: {
        clientId,
        createdAt: { gte: sixMonthsAgo },
      },
    });

    if (recentSurvey) {
      return NextResponse.json(
        { error: "Вы уже проходили опрос недавно. Спасибо!" },
        { status: 429 }
      );
    }

    let responsibleName = (payload as any).responsibleName || null;
    if (!responsibleName && dealId) {
      try {
        const sent = await prisma.sentSurvey.findUnique({ where: { dealId } });
        if (sent?.responsibleName) responsibleName = sent.responsibleName;
      } catch (_) {}
    }

    // Save response. SurveyResponse.dealId is @unique — two concurrent
    // submissions of the same survey can both pass the 6-month findFirst
    // check above, but only one INSERT survives. The other gets P2002 and
    // we treat it as "already submitted" rather than a server error.
    try {
      await prisma.surveyResponse.create({
        data: {
          clientId,
          dealId,
          averageScore,
          answers,
          comment,
          branchId: payload.branchId || null,
          responsibleName: responsibleName || null,
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Вы уже отправили ответ на этот опрос." },
          { status: 429 }
        );
      }
      throw e;
    }

    // Handle B24 Field Mapping + Group Chat Notification
    try {
      const settings = await prisma.settings.findMany({
        where: { key: { startsWith: "b24_" } },
      });
      const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      if (settingsMap.b24_webhook_url && isSafeB24Url(settingsMap.b24_webhook_url)) {
        const cleanBaseUrl = settingsMap.b24_webhook_url
          .replace(/\/$/, "")
          .replace(/\/(profile\.json|profile)$/, "");

        // Fetch questions — used for both field mapping and notification message.
        // If the fetch fails we skip field mapping but still attempt the chat notification.
        let questions: any[] = [];
        try {
          const questionsRes = await fetch(`${getAppOrigin(req)}/api/questions`);
          if (questionsRes.ok) {
            questions = await questionsRes.json();
          } else {
            console.error("Failed to fetch questions for B24 mapping");
          }
        } catch (qErr) {
          console.error("Questions fetch threw:", qErr);
        }

        // 1–4. Update Bitrix24 deal fields
        if (questions.length > 0) {
          const updateData: any = {};

          // 1. Quality of service
          if (settingsMap.b24_field_quality) {
            const q = questions.find(
              (q: any) =>
                q.text.toLowerCase().includes("качество обслуживания") ||
                q.text.toLowerCase().includes("аллея мебели")
            );
            if (q && answersMap[q.id]) {
              updateData[settingsMap.b24_field_quality] = answersMap[q.id];
            } else if (questions[0] && answersMap[questions[0].id]) {
              updateData[settingsMap.b24_field_quality] = answersMap[questions[0].id];
            }
          }

          // 2. Support worker
          if (settingsMap.b24_field_support) {
            const q = questions.find(
              (q: any) =>
                q.text.toLowerCase().includes("работу сотрудника") ||
                q.text.toLowerCase().includes("службы поддержки")
            );
            if (q && answersMap[q.id]) {
              updateData[settingsMap.b24_field_support] = answersMap[q.id];
            } else if (questions[1] && answersMap[questions[1].id]) {
              updateData[settingsMap.b24_field_support] = answersMap[questions[1].id];
            }
          }

          // 3. Average
          if (settingsMap.b24_field_average) {
            updateData[settingsMap.b24_field_average] = averageScore;
          }

          // 4. Comment (only if negative)
          if (settingsMap.b24_field_comment && averageScore < 4 && comment) {
            updateData[settingsMap.b24_field_comment] = comment;
          }

          if (Object.keys(updateData).length > 0) {
            console.log(
              `Updating Bitrix24 Deal ${dealId} with:`,
              JSON.stringify(updateData)
            );
            await fetch(`${cleanBaseUrl}/crm.deal.update.json`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: dealId, fields: updateData }),
            });
          }
        }

        // 5. Group chat notification for negative feedback
        const notifyThreshold = 4;
        if (averageScore < notifyThreshold && settingsMap.b24_group_chat_id) {
          const branchId = payload.branchId;
          let branchName = "Неизвестный филиал";

          if (branchId) {
            const b = await prisma.branch.findUnique({ where: { id: branchId } });
            if (b) branchName = b.name;
          }

          console.log(
            `Negative feedback (Score: ${averageScore}) for ${branchName}. Notifying chat ${settingsMap.b24_group_chat_id}`
          );

          let alertMessage = `⚠️ [b]ОТРИЦАТЕЛЬНЫЙ ОТЗЫВ[/b]\n\n`;
          alertMessage += `🏢 [b]Филиал:[/b] ${branchName}\n`;
          alertMessage += `👤 [b]Клиент:[/b] ${clientId}\n`;
          alertMessage += `🔗 [b]Сделка:[/b] [url=${cleanBaseUrl.replace(
            "/rest/",
            "/crm/deal/details/"
          )}${dealId}/]${dealId}[/url]\n`;
          alertMessage += `⭐ [b]Средняя оценка:[/b] ${averageScore.toFixed(1)}\n\n`;

          // List ratings per question (use fetched questions if available)
          let displayQuestions = questions;
          if (branchId) {
            try {
              const branchData = await prisma.branch.findUnique({
                where: { id: branchId },
                include: {
                  template: {
                    include: { questions: { orderBy: { order: "asc" } } },
                  },
                },
              });
              const templateQs = branchData?.template?.questions;
              if (templateQs && templateQs.length > 0) {
                displayQuestions = templateQs as any;
              }
            } catch (_) {}
          }

          if (displayQuestions.length > 0) {
            alertMessage += `[b]Оценки:[/b]\n`;
            for (const q of displayQuestions) {
              const score = answersMap[q.id];
              if (score !== undefined) {
                alertMessage += `- ${q.text}: ${score}\n`;
              }
            }
          }

          if (comment) {
            alertMessage += `\n💬 [b]Комментарий:[/b] ${comment}`;
          }

          const rawChatId = settingsMap.b24_group_chat_id.trim();
          const dialogId = rawChatId.startsWith("chat") ? rawChatId : `chat${rawChatId}`;

          await fetch(`${cleanBaseUrl}/im.message.add.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ DIALOG_ID: dialogId, MESSAGE: alertMessage }),
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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.surveyResponse.deleteMany({});
    await prisma.sentSurvey.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
