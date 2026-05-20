import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/url";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { dispatchSurveyToOpenChannel } from "@/lib/b24-send";

function isValidId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !/[{}\n\r]/.test(value);
}

async function handleWebhook(req: NextRequest) {
  const { searchParams } = new URL(req.url);
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
        console.log(
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
    safeResponsibleName
  );
  
  // Resolve the public origin (env-baked NEXT_PUBLIC_APP_URL or Host header
  // with default-port stripping). See src/lib/url.ts for why we can't use
  // req.nextUrl.origin here.
  const appUrl = getAppOrigin(req);
  
  const fullSurveyUrl = `${appUrl}/survey/${token}`;
  console.log(`Generated Full Survey URL: ${fullSurveyUrl}`);

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
      console.log(`Generated Short Survey URL: ${surveyUrl}`);
    } catch (shortError) {
      console.error("Shortening failed, using full URL:", shortError);
    }
    // Persist the link on the dispatch row so the follow-up reminder job can
    // re-send the same URL later.
    try {
      await prisma.sentSurvey.update({
        where: { dealId: dedupKey },
        data: { surveyUrl },
      });
    } catch (e) {
      console.error("Failed to store surveyUrl on SentSurvey:", e);
    }
  }

  // Outbound notification to Bitrix24 (Skip if it's a test)
  if (isTest) {
    console.log("Test mode: Skipping B24 outbound notifications.");
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
          console.log(
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
        console.log(
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
          console.log(
            `responsibleName set from webhook mapping: ${assignedWebhook.displayName}`
          );
        } catch (e) {
          console.error("Failed to backfill responsibleName on SentSurvey:", e);
        }
      }

      // 1. Send the survey link into the customer's Open Channel chat.
      // (Shared with the follow-up reminder job — see src/lib/b24-send.ts.)
      try {
        await dispatchSurveyToOpenChannel({
          baseUrl,
          sendCandidates,
          entityType,
          entityId,
          message,
          dealData,
        });
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
          console.log(`Timeline comment added (id ${timelineData.result})`);
        }
      } catch (e) {
        console.error("crm.timeline.comment.add request failed:", e);
      }

      // 3. Update the custom field for automated delivery (SMS/WhatsApp robots).
      // The same UF_-style field works on both Deals and Leads; we just dispatch
      // to crm.deal.update or crm.lead.update accordingly.
      const linkField = settingsMap.b24_link_field || "UF_CRM_1773746121";
      const existingValue = dealData ? dealData[linkField] : null;

      if (!existingValue || String(existingValue).trim() === "") {
        console.log(`Field ${linkField} is empty. Updating with survey link.`);
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
        console.log(
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
  });
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}

export async function POST(req: NextRequest) {
  return handleWebhook(req);
}
