import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

function isValidId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !/[{}\n\r]/.test(value);
}

/**
 * Защита от SSRF: разрешаем только HTTPS-URL на домен *.bitrix24.* / *.bitrix24.ru
 * Блокируем localhost, внутренние IP, произвольные домены.
 */
function isSafeB24Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    // Блокируем loopback и link-local
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return false;
    // Разрешаем только Bitrix24-домены
    return host.includes("bitrix24.");
  } catch {
    return false;
  }
}

async function handleWebhook(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const dealId = searchParams.get("dealId");
  const branchId = searchParams.get("branchId");
  const responsibleName = searchParams.get("responsible");
  const isTest = searchParams.get("isTest") === "true";

  const effectiveClientId = clientId || dealId;
  const effectiveDealId = dealId || clientId;

  if (!effectiveClientId || !effectiveDealId) {
    console.error("Missing both clientId and dealId in request");
    return NextResponse.json(
      { error: "Missing identity parameters" },
      { status: 400 }
    );
  }

  if (!isValidId(effectiveClientId) || !isValidId(effectiveDealId)) {
    console.warn("Rejected webhook: invalid or placeholder ID values.");
    return NextResponse.json(
      { error: "Invalid identity parameters" },
      { status: 400 }
    );
  }

  const safeResponsibleName = responsibleName
    ? responsibleName.replace(/[^\p{L}\p{N} \-.,]/gu, "").slice(0, 256) || null
    : null;
  
  // DEDUPLICATION: Check if survey was already sent for this deal
  if (!isTest) {
    const existingDispatch = await prisma.sentSurvey.findUnique({
      where: { dealId: effectiveDealId }
    });
    if (existingDispatch) {
      console.log(`Survey already dispatched for deal ${effectiveDealId}. Skipping to prevent duplicates.`);
      return NextResponse.json({ message: "Survey already sent for this deal", skip: true });
    }
  }

  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_message_template", "b24_link_field", "b24_template_id"] } }
  });
  
  const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  const b24TemplateId = settingsMap.b24_template_id;
  const token = await createSurveyToken(effectiveClientId, effectiveDealId, branchId, isTest, b24TemplateId, safeResponsibleName);
  
  // Get base URL from env or request headers.
  // NEXT_PUBLIC_APP_URL is inlined at build time — must be set when building.
  // Fallback strips default ports (:80/:443) so that nginx upstreams that
  // pass "Host $host:443" don't produce ugly survey links.
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    let host = (req.headers.get("host") || "").replace(/:(?:80|443)$/, "");
    const protocol = host.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${host}`;
  }
  
  const fullSurveyUrl = `${appUrl}/survey/${token}`;
  console.log(`Generated Full Survey URL: ${fullSurveyUrl}`);

  // Generate Short Link
  let surveyUrl = fullSurveyUrl;
  if (!isTest) {
    try {
      const code = randomBytes(4).toString("hex");
      await prisma.shortLink.create({
        data: {
          code,
          url: fullSurveyUrl,
          branchId: branchId || null
        }
      });
      surveyUrl = `${appUrl}/s/${code}`;
      console.log(`Generated Short Survey URL: ${surveyUrl}`);
      
      // Record dispatch to prevent duplicates
      await prisma.sentSurvey.create({
        data: {
          dealId: effectiveDealId,
          clientId: effectiveClientId,
          responsibleName: safeResponsibleName
        }
      });
    } catch (shortError) {
      console.error("Shortening/Recording failed, using full URL:", shortError);
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
      const baseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");


      // 0. Fetch Deal data once to use for both Open Channel and Field Protection.
      // encodeURIComponent is belt-and-suspenders on top of isValidId() — neutralises
      // any odd character that slipped past validation when forming the URL.
      let dealData: any = null;
      try {
        const dealRes = await fetch(
          `${baseUrl}/crm.deal.get.json?id=${encodeURIComponent(effectiveDealId)}`
        );
        const dealDataRaw = await dealRes.json();
        dealData = dealDataRaw.result;
      } catch (e) {
        console.error("Failed to fetch deal data for protection check:", e);
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
        select: { userId: true, url: true },
      });
      const normalize = (u: string) =>
        u.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");
      const sendCandidates: string[] = [];
      const seen = new Set<string>();
      const pushCandidate = (raw?: string | null) => {
        if (!raw) return;
        const norm = normalize(raw);
        if (seen.has(norm)) return;
        seen.add(norm);
        sendCandidates.push(norm);
      };
      const assignedWebhook = assignedById
        ? perOperatorWebhooks.find((w: { userId: string; url: string }) => w.userId === assignedById)
        : undefined;
      if (assignedWebhook) {
        console.log(
          `Routing to per-operator webhook for ASSIGNED_BY_ID=${assignedById}`
        );
        pushCandidate(assignedWebhook.url);
      }
      for (const w of perOperatorWebhooks) pushCandidate(w.url);
      pushCandidate(baseUrl);

      // 1. Try to send via Open Channel (Direct Chat)
      try {
        const cleanBaseUrl = baseUrl;
        console.log(`Open Channel Delivery attempt for Deal ${effectiveDealId}`);

        const dealLeadId = dealData?.LEAD_ID
          ? String(dealData.LEAD_ID)
          : null;

        // Modern way: a deal may have multiple contacts. crm.deal.contact.items.get
        // returns the full list (each with CONTACT_ID + IS_PRIMARY). Falling back
        // to the legacy primary-only dealData.CONTACT_ID if that call fails.
        const dealContactIds: string[] = [];
        try {
          const contactsRes = await fetch(
            `${cleanBaseUrl}/crm.deal.contact.items.get.json?id=${encodeURIComponent(effectiveDealId)}`
          );
          const contactsRaw = await contactsRes.json();
          const items = Array.isArray(contactsRaw.result) ? contactsRaw.result : [];
          // Put primary contact first so it gets the priority try.
          items
            .sort((a: any, b: any) =>
              (a.IS_PRIMARY === "Y" ? -1 : 0) - (b.IS_PRIMARY === "Y" ? -1 : 0)
            )
            .forEach((c: any) => {
              if (c?.CONTACT_ID) dealContactIds.push(String(c.CONTACT_ID));
            });
        } catch (e) {
          console.error("crm.deal.contact.items.get failed, will fall back to dealData.CONTACT_ID", e);
        }
        if (dealContactIds.length === 0 && dealData?.CONTACT_ID) {
          dealContactIds.push(String(dealData.CONTACT_ID));
        }

        // Fetch the lead's primary contact too — sometimes the OL chat is bound
        // to the contact rather than to the deal/lead directly.
        let leadContactId: string | null = null;
        if (dealLeadId) {
          try {
            const leadRes = await fetch(
              `${cleanBaseUrl}/crm.lead.get.json?id=${encodeURIComponent(dealLeadId)}`
            );
            const leadData = await leadRes.json();
            leadContactId = leadData.result?.CONTACT_ID
              ? String(leadData.result.CONTACT_ID)
              : null;
          } catch (e) {
            console.error("crm.lead.get failed", e);
          }
        }

        const sendMessage = async (type: string, id: string) => {
          const entityType = type.toLowerCase();
          console.log(`Searching for chat bound to ${entityType} ${id}...`);
          try {
            const chatUrl =
              `${cleanBaseUrl}/imopenlines.crm.chat.get.json` +
              `?CRM_ENTITY_TYPE=${encodeURIComponent(entityType)}` +
              `&CRM_ENTITY=${encodeURIComponent(id)}` +
              `&ACTIVE_ONLY=N`;
            const chatRes = await fetch(chatUrl);
            const chatData = await chatRes.json();
            if (chatData.error) {
              console.log(
                `imopenlines.crm.chat.get error for ${entityType} ${id}: ${chatData.error_description || chatData.error}`
              );
              return false;
            }

            let chats = chatData.result;
            if (!Array.isArray(chats)) chats = chats ? [chats] : [];

            for (const chat of chats) {
              const chatId = chat?.CHAT_ID ?? chat;
              const chatIdNum = parseInt(String(chatId), 10);
              if (!chatId || Number.isNaN(chatIdNum)) continue;

              // Try each candidate webhook in priority order. The first one
              // whose user is allowed to write into this chat wins.
              for (const sendBase of sendCandidates) {
                const sendWebhookUserId =
                  sendBase.match(/\/rest\/(\d+)\//)?.[1] || "1";

                // Method 1: im.message.add — works when the webhook owner is
                // a member/operator of the Open Line the chat belongs to.
                console.log(
                  `Attempting im.message.add via user ${sendWebhookUserId} to Chat ${chatId}...`
                );
                const imRes = await fetch(`${sendBase}/im.message.add.json`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    DIALOG_ID: `chat${chatId}`,
                    MESSAGE: message,
                  }),
                });
                const imData = await imRes.json();
                if (imData.result) {
                  console.log(
                    `im.message.add OK (msg id ${imData.result}) — user ${sendWebhookUserId} → chat ${chatId}`
                  );
                  return true;
                }
                if (imData.error === "CANCELED") {
                  console.log(
                    `im.message.add denied — user ${sendWebhookUserId} is not a member of chat ${chatId}'s Open Line`
                  );
                } else {
                  console.log(
                    `im.message.add error: ${imData.error_description || imData.error || "unknown"}`
                  );
                }

                // Method 2: imopenlines.crm.message.add — CRM-routed fallback.
                console.log(
                  `Attempting imopenlines.crm.message.add via user ${sendWebhookUserId} for ${entityType} ${id}...`
                );
                const entityIdNum = parseInt(id, 10);
                if (Number.isNaN(entityIdNum)) {
                  console.log(`Non-numeric entity id "${id}" — skipping CRM fallback`);
                  continue;
                }
                const crmRes = await fetch(
                  `${sendBase}/imopenlines.crm.message.add.json`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      CRM_ENTITY_TYPE: entityType,
                      CRM_ENTITY: entityIdNum,
                      CHAT_ID: chatIdNum,
                      USER_ID: parseInt(sendWebhookUserId, 10) || 1,
                      MESSAGE: message,
                    }),
                  }
                );
                const crmData = await crmRes.json();
                if (crmData.result) {
                  console.log(
                    `imopenlines.crm.message.add OK — user ${sendWebhookUserId} → chat ${chatId}`
                  );
                  return true;
                }
                console.log(
                  `imopenlines.crm.message.add error: ${crmData.error_description || crmData.error || "unknown"}`
                );
              }
            }
          } catch (e) {
            console.error(`Error in sendMessage logic:`, e);
          }
          return false;
        };

        // Try order: Deal -> Lead -> every contact of the deal -> Lead's contact
        let sent = await sendMessage("deal", effectiveDealId);
        if (!sent && dealLeadId) sent = await sendMessage("lead", dealLeadId);
        if (!sent) {
          for (const cid of dealContactIds) {
            sent = await sendMessage("contact", cid);
            if (sent) break;
          }
        }
        if (!sent && leadContactId && !dealContactIds.includes(leadContactId)) {
          sent = await sendMessage("contact", leadContactId);
        }

        if (sent) {
          console.log("SUCCESS: Message delivered to Open Channel.");
        } else {
          console.log("No Open Channel session accepted the message via any registered webhook.");
        }
      } catch (ocError) {
        console.error("FATAL: Open Channel block error:", ocError);
      }

      // 2. Log to Deal Timeline (always — independent of OL outcome).
      try {
        const timelineRes = await fetch(baseUrl + "/crm.timeline.comment.add.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              ENTITY_ID: effectiveDealId,
              ENTITY_TYPE: "deal",
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
      const linkField = settingsMap.b24_link_field || "UF_CRM_1773746121";
      const existingValue = dealData ? dealData[linkField] : null;

      if (!existingValue || String(existingValue).trim() === "") {
        console.log(`Field ${linkField} is empty. Updating with survey link.`);
        try {
          const updateRes = await fetch(baseUrl + "/crm.deal.update.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: effectiveDealId,
              fields: { [linkField]: surveyUrl },
            }),
          });
          const updateData = await updateRes.json();
          if (updateData.error) {
            console.error(
              `crm.deal.update error: ${updateData.error_description || updateData.error}`
            );
          }
        } catch (e) {
          console.error("crm.deal.update request failed:", e);
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
