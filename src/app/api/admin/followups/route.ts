import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { dispatchSurveyToOpenChannel, sendMessageToChatId } from "@/lib/b24-send";
import { isQuietHoursMsk } from "@/lib/quiet-hours";
import { verbose } from "@/lib/log";

/**
 * Scheduled dispatch job, triggered hourly by the VM cron (SYNC_API_KEY) or
 * manually by an admin (session). Exempt from the proxy session gate via an
 * exact-path allowlist entry — auth is enforced here. Does two things:
 *
 * 1. DEFERRED DELIVERY — sends survey links that were created during quiet
 *    hours (20:00-09:00 МСК) and parked with deliverAfter = next 09:00 МСК.
 * 2. FOLLOW-UP REMINDERS — re-sends the link to customers who received one
 *    (deliveredAt) 24h-7d ago and never completed the survey. One reminder
 *    max per dispatch.
 *
 * The whole run is a no-op during quiet hours, so night cron slots never
 * message customers.
 *
 * Concurrency: two overlapping runs (e.g. duplicated crontab lines) used to
 * double-send reminders — both saw followUpSentAt = null and both dispatched.
 * Every send is now preceded by an atomic claim (updateMany conditioned on
 * the not-yet-sent state); whichever run loses the claim skips the row.
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

/** Has this dispatch's survey already been completed? (entity-type aware) */
async function hasResponse(dealId: string): Promise<boolean> {
  const entityType = dealId.startsWith("lead:") ? "lead" : "deal";
  const entityId = dealId.replace(/^lead:/, "");
  // OL_ dispatches store the namespaced id in SurveyResponse.dealId as-is and
  // fall under the "deal" branch (their entityType is null).
  const responded = await prisma.surveyResponse.findFirst({
    where: {
      dealId: entityId,
      ...(entityType === "lead"
        ? { entityType: "lead" }
        : { OR: [{ entityType: "deal" }, { entityType: null }] }),
    },
    select: { id: true },
  });
  return Boolean(responded);
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Quiet hours: never message customers at night. Deferred deliveries and
  // reminders will go out on the first daytime cron slot instead.
  if (isQuietHoursMsk()) {
    verbose("Follow-up run skipped: quiet hours (20:00-09:00 МСК).");
    return NextResponse.json({
      success: true,
      quietHours: true,
      delivered: 0,
      remindersSent: 0,
    });
  }

  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_message_template", "b24_link_field"] } },
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

  const baseTemplate =
    sm.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
  const now = Date.now();

  // ── Stage 1: deferred deliveries (links parked during quiet hours) ────────
  const due = await prisma.sentSurvey.findMany({
    where: {
      deliveredAt: null,
      deliverAfter: { not: null, lte: new Date(now) },
      surveyUrl: { not: null },
      createdAt: { gt: new Date(now - MAX_AGE_H * 3600_000) },
    },
    take: 100,
  });

  let delivered = 0;
  let deliveryFailed = 0;
  for (const s of due) {
    // Customer already completed it (link was visible in CRM overnight) —
    // stamp as delivered and move on without messaging them.
    if (await hasResponse(s.dealId)) {
      await prisma.sentSurvey.updateMany({
        where: { id: s.id, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
      continue;
    }

    // Atomic claim — a concurrent run loses this update and skips the row.
    const claim = await prisma.sentSurvey.updateMany({
      where: { id: s.id, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
    if (claim.count === 0) continue;

    const message = baseTemplate.replace("{surveyUrl}", s.surveyUrl as string);
    try {
      let ok = false;
      if (s.dealId.startsWith("OL_")) {
        const chatId = s.dealId.slice(3);
        ok = (await sendMessageToChatId(sendCandidates, chatId, message)).ok;
      } else {
        const entityType = s.dealId.startsWith("lead:") ? ("lead" as const) : ("deal" as const);
        const entityId = s.dealId.replace(/^lead:/, "");
        ok = (
          await dispatchSurveyToOpenChannel({
            baseUrl,
            sendCandidates,
            entityType,
            entityId,
            message,
          })
        ).ok;

        // The initial webhook skipped the CRM link field at night so B24's
        // own SMS/WhatsApp robots wouldn't fire after hours — fill it now.
        const linkField = sm.b24_link_field || "UF_CRM_1773746121";
        const updateMethod =
          entityType === "lead" ? "crm.lead.update.json" : "crm.deal.update.json";
        try {
          await fetch(`${baseUrl}/${updateMethod}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: entityId, fields: { [linkField]: s.surveyUrl } }),
          });
        } catch (e) {
          console.error(`Deferred ${updateMethod} failed for ${s.dealId}:`, e);
        }
      }
      if (ok) delivered++;
      else deliveryFailed++;
    } catch (e) {
      deliveryFailed++;
      console.error(`Deferred delivery failed for ${s.dealId}:`, e);
    }
  }

  // ── Stage 2: follow-up reminders ──────────────────────────────────────────
  // The 24h-7d window counts from the moment the customer actually got the
  // link (deliveredAt). Rows written by pre-deferral code inside the
  // migration gap have neither deliveredAt nor deliverAfter — fall back to
  // createdAt for those.
  const windowFilter = {
    lt: new Date(now - MIN_AGE_H * 3600_000),
    gt: new Date(now - MAX_AGE_H * 3600_000),
  };
  const pending = await prisma.sentSurvey.findMany({
    where: {
      followUpSentAt: null,
      surveyUrl: { not: null },
      OR: [
        { deliveredAt: windowFilter },
        { deliveredAt: null, deliverAfter: null, createdAt: windowFilter },
      ],
    },
    take: 100,
  });

  let remindersSent = 0;
  let skippedCompleted = 0;
  for (const s of pending) {
    // Already completed? Stamp followUpSentAt so we stop reconsidering it.
    if (await hasResponse(s.dealId)) {
      await prisma.sentSurvey.updateMany({
        where: { id: s.id, followUpSentAt: null },
        data: { followUpSentAt: new Date() },
      });
      skippedCompleted++;
      continue;
    }

    // Atomic claim before sending — the losing concurrent run skips the row,
    // so the customer can never receive the reminder twice.
    const claim = await prisma.sentSurvey.updateMany({
      where: { id: s.id, followUpSentAt: null },
      data: { followUpSentAt: new Date(), followUpCount: { increment: 1 } },
    });
    if (claim.count === 0) continue;

    const message =
      "Напоминаем: поделитесь, пожалуйста, впечатлением — " +
      baseTemplate.replace("{surveyUrl}", s.surveyUrl as string);

    try {
      if (s.dealId.startsWith("OL_")) {
        // Open Line dispatches carry no CRM entity — deliver by chat id.
        const chatId = s.dealId.slice(3);
        await sendMessageToChatId(sendCandidates, chatId, message);
      } else {
        const entityType = s.dealId.startsWith("lead:") ? ("lead" as const) : ("deal" as const);
        const entityId = s.dealId.replace(/^lead:/, "");
        await dispatchSurveyToOpenChannel({
          baseUrl,
          sendCandidates,
          entityType,
          entityId,
          message,
        });
      }
    } catch (e) {
      console.error(`Follow-up dispatch failed for ${s.dealId}:`, e);
    }
    remindersSent++;
  }

  verbose(
    `Follow-up run: ${delivered} deferred delivered (${deliveryFailed} failed), ` +
      `${remindersSent} reminders, ${skippedCompleted} already completed ` +
      `(${due.length}/${pending.length} candidates).`
  );
  return NextResponse.json({
    success: true,
    delivered,
    deliveryFailed,
    deferredCandidates: due.length,
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
