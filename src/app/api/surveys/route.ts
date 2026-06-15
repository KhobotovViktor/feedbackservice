import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySurveyToken } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/auth";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { tagComment, aiConfigured } from "@/lib/ai";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { sendTelegramMessage } from "@/lib/telegram";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { verbose } from "@/lib/log";

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
      verbose("Test survey detected. Skipping persistence and B24 updates.");
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

    // NB: a 3rd fallback that asks Bitrix24 for the deal/lead's ASSIGNED_BY
    // when the responsible is still unknown used to run HERE, on the critical
    // path — up to ~16-32s of blocking B24 calls before the customer's "thank
    // you". It now runs AFTER the response is returned, in the fire-and-forget
    // B24 block below, and back-fills both SurveyResponse and SentSurvey.

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

    // Everything that talks to Bitrix24 / Telegram now runs AFTER the response
    // is returned — one fire-and-forget block. The customer never waits on a
    // slow or unreachable B24, and nothing here can fail the submission.
    // Outbound calls use fetchWithRetry with a hard per-attempt timeout.
    void (async () => {
      // BBCode is the chat markup ([b], [url], …). Customer-supplied text
      // (comment, free-text answers) and even admin-supplied labels must not
      // be able to inject tags, so we neutralise brackets in interpolated
      // values. The static template keeps its real [b]/[url] tags.
      const escBB = (s: unknown) => String(s).replace(/[[\]]/g, " ");
      const isCrm =
        dealId && dealId !== "0" && dealId !== "TEST_DEAL" && !dealId.startsWith("QR");
      const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

      try {
        const settings = await prisma.settings.findMany({
          where: { key: { startsWith: "b24_" } },
        });
        const settingsMap = settings.reduce<Record<string, string>>((acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {});
        const b24Base =
          settingsMap.b24_webhook_url && isSafeB24Url(settingsMap.b24_webhook_url)
            ? normalizeB24Url(settingsMap.b24_webhook_url)
            : null;

        // 0. Resolve the responsible operator from B24 when still unknown (the
        //    ~21% of dispatches the robot sent without ?responsible=). Moved
        //    off the critical path; back-fills the response and dispatch rows.
        if (!responsibleName && isCrm && b24Base) {
          try {
            const getMethod =
              entityType === "lead" ? "crm.lead.get.json" : "crm.deal.get.json";
            const dr = await fetchWithRetry(
              `${b24Base}/${getMethod}?id=${encodeURIComponent(dealId)}`,
              {},
              { retries: 1, timeoutMs: 8000 }
            );
            const dj = await dr.json();
            const assignedById = dj?.result?.ASSIGNED_BY_ID
              ? String(dj.result.ASSIGNED_BY_ID)
              : null;
            if (assignedById) {
              const op = await prisma.b24Webhook.findUnique({
                where: { userId: assignedById },
                select: { displayName: true },
              });
              if (op?.displayName) {
                responsibleName = op.displayName;
              } else {
                const ur = await fetchWithRetry(
                  `${b24Base}/user.get.json?ID=${encodeURIComponent(assignedById)}`,
                  {},
                  { retries: 1, timeoutMs: 8000 }
                );
                const uj = await ur.json();
                const u = Array.isArray(uj?.result) ? uj.result[0] : null;
                const full = [u?.LAST_NAME, u?.NAME].filter(Boolean).join(" ").trim();
                if (full) responsibleName = full.slice(0, 256);
              }
            }
            if (responsibleName) {
              const sentKey = entityType === "lead" ? `lead:${dealId}` : dealId;
              await Promise.all([
                prisma.surveyResponse
                  .update({ where: { dealId }, data: { responsibleName } })
                  .catch(() => {}),
                prisma.sentSurvey
                  .update({ where: { dealId: sentKey }, data: { responsibleName } })
                  .catch(() => {}),
              ]);
            }
          } catch (e) {
            console.error("responsible lookup from B24 failed:", e);
          }
        }

        // Branch name (shared by the Telegram alert and the chat card).
        let branchName = "Без филиала";
        if (effectiveBranchId) {
          const b = await prisma.branch.findUnique({
            where: { id: effectiveBranchId },
            select: { name: true },
          });
          if (b) branchName = b.name;
        }

        // 1. Negative-feedback Telegram alert. No-op when not configured.
        if (isNegative) {
          try {
            const esc = (s: string) =>
              s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        }

        // 2. Bitrix24 field mapping + group-chat card.
        if (!b24Base) return;
        const cleanBaseUrl = b24Base;

        // Read questions straight from the DB (the /api/questions endpoint is
        // admin-gated, so a server-side fetch with no cookie would 401).
        type Q = { id: string; text: string };
        let questions: Q[] = [];
        try {
          questions = await prisma.question.findMany({
            where: effectiveTemplateId ? { templateId: effectiveTemplateId } : {},
            orderBy: { order: "asc" },
            select: { id: true, text: true },
          });
        } catch (qErr) {
          console.error("Direct question load failed:", qErr);
        }

        // 1–5. Write graded fields back to the deal/lead. Pick the method by
        // entityType — the bug before always called crm.deal.update, so lead
        // surveys silently dropped their scores (or hit an unrelated deal).
        if (isCrm && questions.length > 0) {
          const updateData: Record<string, string | number> = {};

          if (settingsMap.b24_field_quality) {
            const q = questions.find(
              (q) =>
                q.text.toLowerCase().includes("качество обслуживания") ||
                q.text.toLowerCase().includes("качество") ||
                q.text.toLowerCase().includes("quality")
            );
            const qv = q ? answersMap[q.id] : undefined;
            const q0v = questions[0] ? answersMap[questions[0].id] : undefined;
            if (isNum(qv)) updateData[settingsMap.b24_field_quality] = qv;
            else if (isNum(q0v)) updateData[settingsMap.b24_field_quality] = q0v;
          }

          if (settingsMap.b24_field_support) {
            const q = questions.find(
              (q) =>
                q.text.toLowerCase().includes("работу сотрудника") ||
                q.text.toLowerCase().includes("службы поддержки")
            );
            const qv = q ? answersMap[q.id] : undefined;
            const q1v = questions[1] ? answersMap[questions[1].id] : undefined;
            if (isNum(qv)) updateData[settingsMap.b24_field_support] = qv;
            else if (isNum(q1v)) updateData[settingsMap.b24_field_support] = q1v;
          }

          if (settingsMap.b24_field_average) {
            updateData[settingsMap.b24_field_average] = averageScore;
          }
          if (settingsMap.b24_field_comment && averageScore < 4 && comment) {
            updateData[settingsMap.b24_field_comment] = comment;
          }
          if (settingsMap.b24_field_phone && isNegative && sanitizedPhone) {
            updateData[settingsMap.b24_field_phone] = sanitizedPhone;
          }

          if (Object.keys(updateData).length > 0) {
            const updMethod =
              entityType === "lead" ? "crm.lead.update.json" : "crm.deal.update.json";
            verbose(`Updating Bitrix24 ${entityType ?? "deal"} ${dealId} with:`, JSON.stringify(updateData));
            await fetchWithRetry(
              `${cleanBaseUrl}/${updMethod}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: dealId, fields: updateData }),
              },
              { retries: 1, timeoutMs: 8000 }
            );
          }
        }

        // Group-chat card — sent for EVERY new response.
        if (settingsMap.b24_group_chat_id) {
          const portal = cleanBaseUrl.replace(/\/rest\/.*$/, "");
          const crmType = entityType === "lead" ? "lead" : "deal";
          const entityLabel = entityType === "lead" ? "Лид" : "Сделка";

          const head = isNegative ? "⚠️ [b]Новая оценка (негатив)[/b]" : "✅ [b]Новая оценка[/b]";
          let msg = `${head}\n\n`;
          msg += `📅 [b]Дата:[/b] ${when}\n`;
          msg += `🏢 [b]Филиал:[/b] ${escBB(branchName)}\n`;
          msg += `⭐ [b]Общая оценка:[/b] ${averageScore.toFixed(1)}\n`;

          let displayQuestions: { id: string; text: string }[] = questions;
          if (effectiveBranchId) {
            try {
              const branchData = await prisma.branch.findUnique({
                where: { id: effectiveBranchId },
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
                msg += `• ${escBB(q.text)}: ${escBB(shown)}\n`;
              }
            }
          }

          msg += `\n👤 [b]Ответственный:[/b] ${escBB(responsibleName || "—")}\n`;
          if (sanitizedPhone) msg += `📞 [b]Телефон для связи:[/b] ${escBB(sanitizedPhone)}\n`;
          if (isCrm) {
            msg += `🔗 [b]${entityLabel}:[/b] [url=${portal}/crm/${crmType}/details/${dealId}/]№ ${dealId}[/url]`;
          } else {
            msg += `🔗 [b]Источник:[/b] QR / прямая ссылка`;
          }
          if (comment) msg += `\n\n💬 [b]Комментарий:[/b] ${escBB(String(comment))}`;

          const rawChatId = settingsMap.b24_group_chat_id.trim();
          const dialogId = rawChatId.startsWith("chat") ? rawChatId : `chat${rawChatId}`;
          try {
            await fetchWithRetry(
              `${cleanBaseUrl}/im.message.add.json`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ DIALOG_ID: dialogId, MESSAGE: msg }),
              },
              { retries: 1, timeoutMs: 8000 }
            );
          } catch (e) {
            console.error("Group chat notification failed:", e);
          }
        }
      } catch (b24Error) {
        console.error("Failed post-response B24/Telegram block:", b24Error);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Deletion is an ADMIN-only, destructive action. MANAGERs (and the
    // formerly public path) must not be able to remove responses.
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (me.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let ids: string[] | null = null;
    let wipeAll = false;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids.filter((x: unknown): x is string => typeof x === "string");
      }
      wipeAll = body?.all === true;
    } catch {
      // no JSON body
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

    // Full wipe requires an explicit { all: true } confirmation — an empty /
    // malformed body must never silently nuke every response + dispatch row.
    if (!wipeAll) {
      return NextResponse.json(
        { error: "Specify { ids: [...] } to delete selected, or { all: true } to wipe everything." },
        { status: 400 }
      );
    }

    await prisma.surveyResponse.deleteMany({});
    await prisma.sentSurvey.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
