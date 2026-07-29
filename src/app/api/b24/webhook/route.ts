import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/url";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { dispatchSurveyToOpenChannel } from "@/lib/b24-send";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isQuietHoursMsk, nextSendTimeMsk } from "@/lib/quiet-hours";
import { verbose } from "@/lib/log";

function isValidId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !/[{}\n\r]/.test(value);
}

async function handleWebhook(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Anti-abuse: soft per-IP rate limit + optional shared secret. The secret is
  // OFF by default (backwards-compatible) — set B24_WEBHOOK_SECRET in the
  // server env and append &secret=... to the robot URL in Bitrix24 to enable.
  if (!rateLimit(`wh:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const webhookSecret = process.env.B24_WEBHOOK_SECRET;
  if (webhookSecret && searchParams.get("secret") !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = searchParams.get("clientId");
  const dealId = searchParams.get("dealId");
  const leadId = searchParams.get("leadId");
  const branchId = searchParams.get("branchId");
  const responsibleName = searchParams.get("responsible");
  const isTest = searchParams.get("isTest") === "true";

  // The robot can fire from either the Deals funnel or the Leads funnel.
  // entityType lets callers pick which CRM entity the rest of this handler
  // operates against. Defaults to "deal" for backwards compatibility — old
  // robots configured before Lead support shipped will continue working
  // unchanged. Accepted: "deal" | "lead".
  const entityTypeRaw = searchParams.get("entityType")?.toLowerCase();
  const entityType: "deal" | "lead" =
    entityTypeRaw === "lead" ? "lead" : "deal";

  // Backwards-compat: the original robots template was
  //   ?clientId={{ID}}&dealId={{ID}}
  // For leads we accept either ?leadId=... explicitly, or ?dealId=... with
  // ?entityType=lead. clientId remains the canonical "who is this person"
  // identifier — for leads it's usually the same as the lead id.
  const entityId = leadId || dealId || clientId;
  const effectiveClientId = clientId || entityId;

  if (!effectiveClientId || !entityId) {
    console.error("Missing both clientId and dealId/leadId in request");
    return NextResponse.json(
      { error: "Missing identity parameters" },
      { status: 400 }
    );
  }

  if (!isValidId(effectiveClientId) || !isValidId(entityId)) {
    console.warn("Rejected webhook: invalid or placeholder ID values.");
    return NextResponse.json(
      { error: "Invalid identity parameters" },
      { status: 400 }
    );
  }

  // The SentSurvey table has a single @unique(dealId) — we reuse it for
  // leads too by namespacing the key. New leads get "lead:123", deals stay
  // bare ("123") so old rows keep matching. This avoids a schema change
  // while preventing collisions between unrelated deal/lead ids.
  const dedupKey = entityType === "lead" ? `lead:${entityId}` : entityId;

  const safeResponsibleName = responsibleName
    ? responsibleName.replace(/[^\p{L}\p{N} \-.,]/gu, "").slice(0, 256) || null
    : null;
  
  // DEDUPLICATION: race-safe variant. Two robot retries firing at the same
  // moment could both pass a plain findUnique-then-create check and both
  // generate tokens / short links / send messages. Instead we attempt the
  // INSERT first and rely on the @unique(dealId) constraint to reject the
  // duplicate. The winning call proceeds; the losing one bails immediately
  // without side effects. (Survey URL/token are generated *after* this
  // claim, so a loser never publishes anything.)
  if (!isTest) {
    try {
      await prisma.sentSurvey.create({
        data: {
          dealId: dedupKey,
          clientId: effectiveClientId,
          responsibleName: safeResponsibleName,
        },
      });
    } catch (e: unknown) {
      // P2002 = unique constraint violation on the @unique(dealId).
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2002") {
        verbose(
          `Survey already dispatched for ${entityType} ${entityId}. Skipping to prevent duplicates.`
        );
        return NextResponse.json({
          message: "Survey already sent",
          skip: true,
        });
      }
      // Some other DB failure — surface it instead of silently double-sending.
      console.error("SentSurvey insert failed:", e);
      return NextResponse.json(
        { error: "Failed to record dispatch" },
        { status: 500 }
      );
    }
  }

  // Quiet hours (20:00-09:00 МСК): don't message the customer at night.
  // The dispatch row and survey link are still created now; the OL message
  // and the CRM link field (which triggers B24's own SMS/WhatsApp robots)
  // are deferred to the next 09:00 МСК via the cron job. The timeline
  // comment is internal to B24, so it still goes out immediately.
  const deferUntil = !isTest && isQuietHoursMsk() ? nextSendTimeMsk() : null;
  if (deferUntil) {
    verbose(`Quiet hours: deferring customer sends for ${dedupKey} until ${deferUntil.toISOString()}`);
  }

  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_message_template", "b24_link_field", "b24_template_id"] } }
  });
  
  const settingsMap = settings.reduce<Record<string, string>>((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  const b24TemplateId = settingsMap.b24_template_id;
  // The survey token still carries `dealId` as the legacy field name (for
  // schema/back-compat reasons) but holds either the deal or the lead id.
  const token = await createSurveyToken(
    effectiveClientId,
    entityId,
    branchId,
    isTest,
    b24TemplateId,
    safeResponsibleName,
    entityType
  );
  
  // Resolve the public origin (env-baked NEXT_PUBLIC_APP_URL or Host header
  // with default-port stripping). See src/lib/url.ts for why we can't use
  // req.nextUrl.origin here.
  const appUrl = getAppOrigin(req);
  
  const fullSurveyUrl = `${appUrl}/survey/${token}`;
  verbose(`Generated Full Survey URL: ${fullSurveyUrl}`);

  // Generate Short Link. The SentSurvey claim above already prevents
  // duplicate dispatch, so we only need to mint a short code here.
  let surveyUrl = fullSurveyUrl;
  if (!isTest) {
    try {
      const code = randomBytes(4).toString("hex");
      await prisma.shortLink.create({
        data: {
          code,
          url: fullSurveyUrl,
          branchId: branchId || null,
        },
      });
      surveyUrl = `${appUrl}/s/${code}`;
      verbose(`Generated Short Survey URL: ${surveyUrl}`);
    } catch (shortError) {
      console.error("Shortening failed, using full URL:", shortError);
    }
    // Persist the link on the dispatch row so the follow-up reminder job can
    // re-send the same URL later. During quiet hours (20:00-09:00 МСК) the
    // customer-facing sends below are skipped and deliverAfter is stamped
    // instead — the cron job delivers the link at 09:00; daytime dispatches
    // are delivered right here, so they get deliveredAt immediately.
    try {
      await prisma.sentSurvey.update({
        where: { dealId: dedupKey },
        data: {
          surveyUrl,
          ...(deferUntil ? { deliverAfter: deferUntil } : { deliveredAt: new Date() }),
        },
      });
    } catch (e) {
      console.error("Failed to store surveyUrl on SentSurvey:", e);
    }
  }

  // Outbound notification to Bitrix24 (Skip if it's a test)
  if (isTest) {
    verbose("Test mode: Skipping B24 outbound notifications.");
    return NextResponse.json({
      surveyUrl,
      token,
      isTest: true
    });
  }
  try {
    if (settingsMap.b24_webhook_url) {
      if (!isSafeB24Url(settingsMap.b24_webhook_url)) {
        console.error("Blocked SSRF attempt: invalid b24_webhook_url:", settingsMap.b24_webhook_url);
        return NextResponse.json({ error: "Invalid webhook URL configuration" }, { status: 500 });
      }

      const template = settingsMap.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
      const message = template.replace("{surveyUrl}", surveyUrl);
      const baseUrl = normalizeB24Url(settingsMap.b24_webhook_url);


      // 0. Fetch the entity (deal or lead) once. The same shape covers both —
      // crm.{deal,lead}.get return a flat record of all fields, and we only
      // touch a handful of well-known ones plus the configurable UF_* field.
      type EntityData = Record<string, unknown> & {
        ASSIGNED_BY_ID?: string;
        LEAD_ID?: string;
        CONTACT_ID?: string;
      };
      const entityGetMethod =
        entityType === "lead" ? "crm.lead.get.json" : "crm.deal.get.json";
      let dealData: EntityData | null = null;
      try {
        const dealRes = await fetch(
          `${baseUrl}/${entityGetMethod}?id=${encodeURIComponent(entityId)}`
        );
        const dealDataRaw = await dealRes.json();
        dealData = (dealDataRaw.result as EntityData) ?? null;
        if (!dealData) {
          verbose(
            `${entityGetMethod} returned no result for ${entityType} ${entityId} — ${dealDataRaw.error_description || dealDataRaw.error || "empty result"}`
          );
        }
      } catch (e) {
        console.error(`Failed to fetch ${entityType} data for protection check:`, e);
      }

      // Build the ordered list of webhook base URLs to try for im.message.add.
      // Priority:
      //   1) Per-operator webhook for the deal's ASSIGNED_BY_ID, if registered.
      //      This is the operator who handled the case and should be in the
      //      Open Line's queue, so im.message.add from their token will pass.
      //   2) Every other registered per-operator webhook (round-robin fallback).
      //   3) The default webhook (settings.b24_webhook_url).
      // Duplicates are removed while preserving order. CRM/timeline calls keep
      // using the default webhook so they all show up under the same author.
      const assignedById: string | undefined = dealData?.ASSIGNED_BY_ID
        ? String(dealData.ASSIGNED_BY_ID)
        : undefined;
      const perOperatorWebhooks = await prisma.b24Webhook.findMany({
        select: { userId: true, url: true, displayName: true },
      });
      const sendCandidates: string[] = [];
      const seen = new Set<string>();
      const pushCandidate = (raw?: string | null) => {
        if (!raw) return;
        const norm = normalizeB24Url(raw);
        if (seen.has(norm)) return;
        seen.add(norm);
        sendCandidates.push(norm);
      };
      const assignedWebhook = assignedById
        ? perOperatorWebhooks.find((w) => w.userId === assignedById)
        : undefined;
      if (assignedWebhook) {
        verbose(
          `Routing to per-operator webhook for ASSIGNED_BY_ID=${assignedById}`
        );
        pushCandidate(assignedWebhook.url);
      }
      for (const w of perOperatorWebhooks) pushCandidate(w.url);
      pushCandidate(baseUrl);

      // If the robot didn't pass ?responsible=, derive the operator name from
      // the webhook mapping (deal/lead ASSIGNED_BY_ID → registered displayName)
      // and persist it on the dispatch row, so the survey result later shows
      // who sent the link. (The submit handler reads SentSurvey.responsibleName
      // by dealId; for deals dedupKey === the id, which is the common case.)
      if (!safeResponsibleName && assignedWebhook?.displayName) {
        try {
          await prisma.sentSurvey.update({
            where: { dealId: dedupKey },
            data: { responsibleName: assignedWebhook.displayName },
          });
          verbose(
            `responsibleName set from webhook mapping: ${assignedWebhook.displayName}`
          );
        } catch (e) {
          console.error("Failed to backfill responsibleName on SentSurvey:", e);
        }
      }

      // 1. Send the survey link into the customer's Open Channel chat.
      // (Shared with the follow-up reminder job — see src/lib/b24-send.ts.)
      // If the official ASSIGNED_BY user wasn't a registered per-operator
      // webhook, the message gets delivered by whoever *is* registered and
      // currently in the chat — that operator is the best fallback signal
      // for "who is handling this conversation". Backfill SentSurvey with
      // their displayName so the survey result shows them.
      // Skipped during quiet hours — the cron job delivers at 09:00 МСК.
      if (!deferUntil) try {
        const dispatch = await dispatchSurveyToOpenChannel({
          baseUrl,
          sendCandidates,
          entityType,
          entityId,
          message,
          dealData,
        });
        if (
          dispatch.ok &&
          dispatch.usedWebhookUrl &&
          !safeResponsibleName &&
          !assignedWebhook?.displayName
        ) {
          const normalizedUsed = normalizeB24Url(dispatch.usedWebhookUrl);
          const used = perOperatorWebhooks.find(
            (w) => normalizeB24Url(w.url) === normalizedUsed
          );
          if (used?.displayName) {
            try {
              await prisma.sentSurvey.update({
                where: { dealId: dedupKey },
                data: { responsibleName: used.displayName },
              });
              verbose(
                `responsibleName backfilled from dialog operator: ${used.displayName} (webhook user ${used.userId})`
              );
            } catch (e) {
              console.error("Failed to backfill responsibleName from dialog operator:", e);
            }
          }
        }
      } catch (ocError) {
        console.error("FATAL: Open Channel block error:", ocError);
      }

      // 2. Log to Deal/Lead Timeline (always — independent of OL outcome).
      try {
        const timelineRes = await fetch(baseUrl + "/crm.timeline.comment.add.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              ENTITY_ID: entityId,
              ENTITY_TYPE: entityType, // "deal" or "lead"
              COMMENT: message,
            },
          }),
        });
        const timelineData = await timelineRes.json();
        if (timelineData.error) {
          console.error(
            `crm.timeline.comment.add error: ${timelineData.error_description || timelineData.error}`
          );
        } else {
          verbose(`Timeline comment added (id ${timelineData.result})`);
        }
      } catch (e) {
        console.error("crm.timeline.comment.add request failed:", e);
      }

      // 3. Update the custom field for automated delivery (SMS/WhatsApp robots).
      // The same UF_-style field works on both Deals and Leads; we just dispatch
      // to crm.deal.update or crm.lead.update accordingly.
      // Skipped during quiet hours: filling the field at night would let B24's
      // own robots text the customer immediately — the cron fills it at 09:00.
      const linkField = settingsMap.b24_link_field || "UF_CRM_1773746121";
      const existingValue = dealData ? dealData[linkField] : null;

      if (deferUntil) {
        verbose(`Quiet hours: link field ${linkField} left for deferred delivery.`);
      } else if (!existingValue || String(existingValue).trim() === "") {
        verbose(`Field ${linkField} is empty. Updating with survey link.`);
        const updateMethod =
          entityType === "lead" ? "crm.lead.update.json" : "crm.deal.update.json";
        try {
          const updateRes = await fetch(`${baseUrl}/${updateMethod}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: entityId,
              fields: { [linkField]: surveyUrl },
            }),
          });
          const updateData = await updateRes.json();
          if (updateData.error) {
            console.error(
              `${updateMethod} error: ${updateData.error_description || updateData.error}`
            );
          }
        } catch (e) {
          console.error(`${updateMethod} request failed:`, e);
        }
      } else {
        verbose(
          `Field ${linkField} already contains data ("${existingValue}"). Skipping update to prevent overwriting.`
        );
      }
    } else {
      console.warn("b24_webhook_url is NOT configured in settings.");
    }
  } catch (error) {
    console.error("Failed to send outbound to B24:", error);
  }

  return NextResponse.json({
    surveyUrl,
    token,
    ...(deferUntil ? { deferred: true, deliverAfter: deferUntil.toISOString() } : {}),
  });
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}

export async function POST(req: NextRequest) {
  return handleWebhook(req);
}
