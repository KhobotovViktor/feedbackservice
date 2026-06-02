import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySurveyToken } from "@/lib/auth-utils";
import { getSession } from "@/lib/auth";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { tagComment, aiConfigured } from "@/lib/ai";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  if (!rateLimit(`sv:${getClientIp(req)}`, 15, 60_000)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 }
    );
  }
  try {
    const { token, answers, comment, cityId, phone } = await req.json();

    const payload = await verifySurveyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { clientId, dealId, isTest } = payload;

    // Validate answers. Values are mixed now: numbers for RATING/NPS, strings
    // for CHOICE/YESNO/TEXT, so we only require that *something* was answered.
    const answersMap = (answers ?? {}) as Record<string, unknown>;
    if (Object.keys(answersMap).length === 0) {
      return NextResponse.json({ error: "No valid answers provided" }, { status: 400 });
    }
    const isNum = (v: unknown): v is number => typeof v === "number" && !isNaN(v);

    // Sandbox mode for testing — no persistence, no score needed.
    if (isTest) {
      console.log("Test survey detected. Skipping persistence and B24 updates.");
      return NextResponse.json({ success: true, isTest: true });
    }

    // payload is typed by verifySurveyToken — responsibleName lives there.
    let responsibleName: string | null = payload.responsibleName || null;
    if (!responsibleName && dealId) {
      try {
        // SentSurvey.dealId mirrors the dedupe key used by the B24 webhook:
        // leads are stored as "lead:<id>" to avoid id collisions with deals.
        // Surveys' own dealId carries the bare id, so for leads we have to
        // re-prefix when looking the dispatch row up.
        const sentKey =
          payload.entityType === "lead" ? `lead:${dealId}` : dealId;
        const sent = await prisma.sentSurvey.findUnique({ where: { dealId: sentKey } });
        if (sent?.responsibleName) responsibleName = sent.responsibleName;
      } catch {
        // best-effort lookup — fall through to null
      }
    }

    // City-selection scenario: when the client picked a city, that city's
    // branch overrides the token's branch — so the saved response, the group
    // chat notification and the B24 field-mapping all use the chosen branch
    // (and its question template). Falls back to the token values otherwise.
    let effectiveBranchId: string | null = payload.branchId || null;
    let effectiveTemplateId: string | null =
      (payload as { templateId?: string | null }).templateId || null;
    if (cityId) {
      try {
        const city = await prisma.city.findUnique({
          where: { id: cityId },
          include: { branch: { select: { id: true, templateId: true } } },
        });
        if (city?.branchId) {
          effectiveBranchId = city.branchId;
          if (city.branch?.templateId) effectiveTemplateId = city.branch.templateId;
        }
      } catch {
        // best-effort — keep the token's branch/template on lookup failure
      }
    }

    // Retake frequency from the effective template (0/none = unlimited). No
    // template → unlimited (unique dealId + per-token device lock still apply).
    let freqHours = 0;
    try {
      let tId = effectiveTemplateId;
      if (!tId && effectiveBranchId) {
        const b = await prisma.branch.findUnique({
          where: { id: effectiveBranchId },
          select: { templateId: true },
        });
        tId = b?.templateId || null;
      }
      if (tId) {
        const tpl = await prisma.questionTemplate.findUnique({
          where: { id: tId },
          select: { surveyFrequencyHours: true },
        });
        freqHours = tpl?.surveyFrequencyHours ?? 0;
      }
    } catch {
      // best-effort — no frequency limit on lookup failure
    }
    if (freqHours > 0) {
      const cutoff = new Date(Date.now() - freqHours * 3600_000);
      const recent = await prisma.surveyResponse.findFirst({
        where: { clientId, createdAt: { gte: cutoff } },
      });
      if (recent) {
        return NextResponse.json(
          { error: "Вы недавно уже проходили опрос. Спасибо!" },
          { status: 429 }
        );
      }
    }

    // Score only the RATING questions of the effective template — NPS/choice/
    // yes-no/text answers are stored but never skew the 1-5 average / negative
    // threshold. Fall back to averaging every numeric answer when the template
    // questions can't be resolved (legacy links / built-in default questions).
    let ratingIds: Set<string> | null = null;
    try {
      if (effectiveTemplateId) {
        const qs = await prisma.question.findMany({
          where: { templateId: effectiveTemplateId },
          select: { id: true, type: true },
        });
        if (qs.length > 0) {
          ratingIds = new Set(qs.filter((q) => (q.type ?? "RATING") === "RATING").map((q) => q.id));
        }
      }
    } catch {
      // best-effort — fall through to all-numeric averaging
    }
    let scoreVals: number[] =
      ratingIds && ratingIds.size > 0
        ? Object.entries(answersMap)
            .filter(([k, v]) => ratingIds!.has(k) && isNum(v))
            .map(([, v]) => v as number)
        : (Object.values(answersMap).filter(isNum) as number[]);
    if (scoreVals.length === 0) {
      scoreVals = Object.values(answersMap).filter(isNum) as number[];
    }
    if (scoreVals.length === 0) {
      return NextResponse.json({ error: "No valid answers provided" }, { status: 400 });
    }
    // Recalculate averageScore server-side — never trust the client value.
    const averageScore =
      Math.round((scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) * 10) / 10;

    // Save response. SurveyResponse.dealId is @unique — two concurrent
    // submissions of the same survey can both pass the 6-month findFirst
    // check above, but only one INSERT survives. The other gets P2002 and
    // we treat it as "already submitted" rather than a server error.
    // Negative responses open a complaint to work through (close-the-loop).
    const NEGATIVE_THRESHOLD = 4.5;
    const isNegative = averageScore < NEGATIVE_THRESHOLD;
    // Normalised contact phone (negative-feedback step). Reused for storage,
    // the B24 field-mapping and the group-chat callback line below.
    const sanitizedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim().slice(0, 32) : null;
    const entityType =
      payload.entityType === "lead" || payload.entityType === "deal"
        ? payload.entityType
        : null;
    try {
      await prisma.surveyResponse.create({
        data: {
          clientId,
          dealId,
          averageScore,
          answers,
          comment,
          phone: sanitizedPhone,
          branchId: effectiveBranchId,
          responsibleName: responsibleName || null,
          entityType,
          complaintStatus: isNegative ? "NEW" : null,
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

    // AI auto-tagging of the comment — fire-and-forget so it never blocks the
    // response or fails the submission on an API hiccup. Updates the freshly
    // created row (unique dealId) once Claude returns. Tests return earlier.
    if (comment && String(comment).trim() && aiConfigured()) {
      void (async () => {
        try {
          const tags = await tagComment(String(comment));
          if (tags.length > 0) {
            await prisma.surveyResponse.update({ where: { dealId }, data: { tags } });
          }
        } catch (e) {
          console.error("AI tagging failed:", e);
        }
      })();
    }

    // Negative feedback → optional Telegram alert (duplicate of the B24 chat).
    // Fire-and-forget; no-op when Telegram isn't configured.
    if (isNegative) {
      void (async () => {
        try {
          const esc = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          let branchName = "Без филиала";
          if (effectiveBranchId) {
            const b = await prisma.branch.findUnique({
              where: { id: effectiveBranchId },
              select: { name: true },
            });
            if (b) branchName = b.name;
          }
          const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
          const isCrm =
            dealId && dealId !== "0" && dealId !== "TEST_DEAL" && !dealId.startsWith("QR");
          const label = entityType === "lead" ? "Лид" : "Сделка";
          let text = `⚠️ <b>Негативный отзыв</b>\n`;
          text += `📅 ${esc(when)}\n`;
          text += `🏢 Филиал: ${esc(branchName)}\n`;
          text += `⭐ Оценка: ${averageScore.toFixed(1)}\n`;
          text += `👤 Ответственный: ${esc(responsibleName || "—")}\n`;
          if (sanitizedPhone) text += `📞 Телефон: ${esc(sanitizedPhone)}\n`;
          if (isCrm) text += `🔗 ${label} № ${esc(dealId)}\n`;
          if (comment) text += `\n💬 ${esc(String(comment))}`;
          await sendTelegramMessage(text);
        } catch (e) {
          console.error("Telegram negative alert failed:", e);
        }
      })();
    }

    // Handle B24 Field Mapping + Group Chat Notification
    try {
      const settings = await prisma.settings.findMany({
        where: { key: { startsWith: "b24_" } },
      });
      const settingsMap = settings.reduce<Record<string, string>>(
        (acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        },
        {}
      );

      if (settingsMap.b24_webhook_url && isSafeB24Url(settingsMap.b24_webhook_url)) {
        const cleanBaseUrl = normalizeB24Url(settingsMap.b24_webhook_url);

        // Fetch questions — used for both field mapping and notification message.
        // Read straight from the DB instead of self-calling /api/questions:
        // that endpoint is admin-gated by proxy.ts, so a server-side fetch
        // (which has no session cookie) gets a 401 and the field-mapping
        // block silently no-ops. The user-visible symptom was the survey
        // link reaching the deal but the UF_-graded fields staying empty.
        // If the token carried a templateId we narrow to its questions;
        // otherwise we fall back to all questions (legacy behavior).
        type Q = { id: string; text: string };
        let questions: Q[] = [];
        try {
          const dbQuestions = await prisma.question.findMany({
            where: effectiveTemplateId ? { templateId: effectiveTemplateId } : {},
            orderBy: { order: "asc" },
            select: { id: true, text: true },
          });
          questions = dbQuestions;
        } catch (qErr) {
          console.error("Direct question load failed:", qErr);
        }

        // 1–4. Update Bitrix24 deal fields
        if (questions.length > 0) {
          const updateData: Record<string, string | number> = {};

          // 1. Quality of service
          if (settingsMap.b24_field_quality) {
            // Match the "service quality" question by keyword in any
            // language/branding — the bare "качество" / "quality" /
            // "обслуживания" tokens are reliable, brand name in the text
            // would just over-fit to one organisation's wording.
            const q = questions.find(
              (q) =>
                q.text.toLowerCase().includes("качество обслуживания") ||
                q.text.toLowerCase().includes("качество") ||
                q.text.toLowerCase().includes("quality")
            );
            const qv = q ? answersMap[q.id] : undefined;
            const q0v = questions[0] ? answersMap[questions[0].id] : undefined;
            if (isNum(qv)) {
              updateData[settingsMap.b24_field_quality] = qv;
            } else if (isNum(q0v)) {
              updateData[settingsMap.b24_field_quality] = q0v;
            }
          }

          // 2. Support worker
          if (settingsMap.b24_field_support) {
            const q = questions.find(
              (q) =>
                q.text.toLowerCase().includes("работу сотрудника") ||
                q.text.toLowerCase().includes("службы поддержки")
            );
            const qv = q ? answersMap[q.id] : undefined;
            const q1v = questions[1] ? answersMap[questions[1].id] : undefined;
            if (isNum(qv)) {
              updateData[settingsMap.b24_field_support] = qv;
            } else if (isNum(q1v)) {
              updateData[settingsMap.b24_field_support] = q1v;
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

          // 5. Callback phone — only for negative responses where the client
          // left a number. Lets a manager ring back fast to save the review.
          if (settingsMap.b24_field_phone && isNegative && sanitizedPhone) {
            updateData[settingsMap.b24_field_phone] = sanitizedPhone;
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

        // 5. Group chat notification — sent for EVERY new response (not just
        // negatives), with full context for the team.
        if (settingsMap.b24_group_chat_id) {
          const branchId = effectiveBranchId;
          let branchName = "Без филиала";
          if (branchId) {
            const b = await prisma.branch.findUnique({ where: { id: branchId } });
            if (b) branchName = b.name;
          }

          // Portal base, e.g. https://am35.bitrix24.ru (strip /rest/<id>/<token>).
          const portal = cleanBaseUrl.replace(/\/rest\/.*$/, "");
          const crmType = entityType === "lead" ? "lead" : "deal";
          const isCrm =
            dealId && dealId !== "0" && dealId !== "TEST_DEAL" && !dealId.startsWith("QR");
          const entityLabel = entityType === "lead" ? "Лид" : "Сделка";
          const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

          const head = isNegative ? "⚠️ [b]Новая оценка (негатив)[/b]" : "✅ [b]Новая оценка[/b]";
          let msg = `${head}\n\n`;
          msg += `📅 [b]Дата:[/b] ${when}\n`;
          msg += `🏢 [b]Филиал:[/b] ${branchName}\n`;
          msg += `⭐ [b]Общая оценка:[/b] ${averageScore.toFixed(1)}\n`;

          // Per-question scores. Prefer the template questions of the branch.
          let displayQuestions: { id: string; text: string }[] = questions;
          if (branchId) {
            try {
              const branchData = await prisma.branch.findUnique({
                where: { id: branchId },
                include: { template: { include: { questions: { orderBy: { order: "asc" } } } } },
              });
              const templateQs = branchData?.template?.questions;
              if (templateQs && templateQs.length > 0) {
                displayQuestions = templateQs.map((q) => ({ id: q.id, text: q.text }));
              }
            } catch {
              // fall back to the questions already loaded above
            }
          }
          if (displayQuestions.length > 0) {
            msg += `\n[b]Ответы:[/b]\n`;
            for (const q of displayQuestions) {
              const score = answersMap[q.id];
              if (score !== undefined && score !== null && score !== "") {
                const shown = Array.isArray(score) ? score.join(", ") : String(score);
                msg += `• ${q.text}: ${shown}\n`;
              }
            }
          }

          msg += `\n👤 [b]Ответственный:[/b] ${responsibleName || "—"}\n`;
          // Callback phone front-and-centre so the team can ring back quickly.
          if (sanitizedPhone) msg += `📞 [b]Телефон для связи:[/b] ${sanitizedPhone}\n`;
          if (isCrm) {
            msg += `🔗 [b]${entityLabel}:[/b] [url=${portal}/crm/${crmType}/details/${dealId}/]№ ${dealId}[/url]`;
          } else {
            msg += `🔗 [b]Источник:[/b] QR / прямая ссылка`;
          }
          if (comment) msg += `\n\n💬 [b]Комментарий:[/b] ${comment}`;

          const rawChatId = settingsMap.b24_group_chat_id.trim();
          const dialogId = rawChatId.startsWith("chat") ? rawChatId : `chat${rawChatId}`;

          try {
            await fetch(`${cleanBaseUrl}/im.message.add.json`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ DIALOG_ID: dialogId, MESSAGE: msg }),
            });
          } catch (e) {
            console.error("Group chat notification failed:", e);
          }
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

    // Optional body { ids: [...] } → delete just those responses.
    // No body / empty ids → wipe everything (the "Очистить" button).
    let ids: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids.filter((x: unknown): x is string => typeof x === "string");
      }
    } catch {
      // no JSON body — fall through to full wipe
    }

    if (ids && ids.length > 0) {
      // Targeted delete. We only remove the responses themselves, not the
      // SentSurvey dispatch rows, so a deleted result won't cause the survey
      // to be re-sent for that deal.
      const result = await prisma.surveyResponse.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    await prisma.surveyResponse.deleteMany({});
    await prisma.sentSurvey.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
