import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { dispatchSurveyToOpenChannel } from "@/lib/b24-send";
import { verbose } from "@/lib/log";

/**
 * Follow-up reminder job: re-sends the survey link to customers who were sent
 * one but never completed the survey. Triggered by the VM cron (SYNC_API_KEY)
 * or manually by an admin (session). Exempt from the proxy session gate via an
 * exact-path allowlist entry — auth is enforced here.
 *
 * Targets dispatches that are:
 *   - older than MIN_AGE_H (give the customer time to respond first),
 *   - younger than MAX_AGE_H (don't nag about ancient links),
 *   - have a stored surveyUrl,
 *   - haven't had a follow-up yet,
 *   - and have no SurveyResponse recorded.
 */
const MIN_AGE_H = 24;
const MAX_AGE_H = 24 * 7;

async function authorized(req: NextRequest): Promise<boolean> {
  if (await getSession()) return true;
  const KEY = process.env.SYNC_API_KEY;
  if (!KEY) return false;
  const provided =
    req.headers.get("x-api-key") || new URL(req.url).searchParams.get("apiKey");
  return provided === KEY;
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_message_template"] } },
  });
  const sm = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  if (!sm.b24_webhook_url || !isSafeB24Url(sm.b24_webhook_url)) {
    return NextResponse.json({ error: "b24_webhook_url not configured" }, { status: 400 });
  }
  const baseUrl = normalizeB24Url(sm.b24_webhook_url);

  // Build the same operator-webhook candidate list the initial dispatch uses.
  const perOperatorWebhooks = await prisma.b24Webhook.findMany({
    select: { url: true },
  });
  const seen = new Set<string>();
  const sendCandidates: string[] = [];
  for (const w of [...perOperatorWebhooks.map((w) => w.url), sm.b24_webhook_url]) {
    const norm = normalizeB24Url(w);
    if (!seen.has(norm)) {
      seen.add(norm);
      sendCandidates.push(norm);
    }
  }

  const now = Date.now();
  const pending = await prisma.sentSurvey.findMany({
    where: {
      followUpSentAt: null,
      surveyUrl: { not: null },
      createdAt: {
        lt: new Date(now - MIN_AGE_H * 3600_000),
        gt: new Date(now - MAX_AGE_H * 3600_000),
      },
    },
    take: 100,
  });

  const baseTemplate =
    sm.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";

  let remindersSent = 0;
  let skippedCompleted = 0;
  for (const s of pending) {
    const entityType = s.dealId.startsWith("lead:") ? "lead" : "deal";
    const entityId = s.dealId.replace(/^lead:/, "");

    // Already completed? Don't remind — and stamp followUpSentAt so we stop
    // reconsidering it on every run.
    const responded = await prisma.surveyResponse.findFirst({
      where: { dealId: entityId },
      select: { id: true },
    });
    if (responded) {
      await prisma.sentSurvey.update({
        where: { id: s.id },
        data: { followUpSentAt: new Date() },
      });
      skippedCompleted++;
      continue;
    }

    const message =
      "Напоминаем: поделитесь, пожалуйста, впечатлением — " +
      baseTemplate.replace("{surveyUrl}", s.surveyUrl as string);

    try {
      await dispatchSurveyToOpenChannel({
        baseUrl,
        sendCandidates,
        entityType,
        entityId,
        message,
      });
    } catch (e) {
      console.error(`Follow-up dispatch failed for ${s.dealId}:`, e);
    }

    await prisma.sentSurvey.update({
      where: { id: s.id },
      data: { followUpSentAt: new Date(), followUpCount: { increment: 1 } },
    });
    remindersSent++;
  }

  verbose(
    `Follow-up run: ${remindersSent} reminders, ${skippedCompleted} already completed, ${pending.length} candidates.`
  );
  return NextResponse.json({
    success: true,
    candidates: pending.length,
    remindersSent,
    skippedCompleted,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
