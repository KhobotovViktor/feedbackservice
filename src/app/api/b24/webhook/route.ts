import { NextRequest, NextResponse } from "next/server";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

async function handleWebhook(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const dealId = searchParams.get("dealId");

  console.log(`Incoming B24 Webhook: clientId=${clientId}, dealId=${dealId}`);

  // Resilience: if clientId is missing but dealId is present, use dealId as clientId
  const effectiveClientId = clientId || dealId;
  const effectiveDealId = dealId || clientId;

  if (!effectiveClientId || !effectiveDealId) {
    console.error("Missing both clientId and dealId in request");
    return NextResponse.json(
      { error: "Missing identity parameters" },
      { status: 400 }
    );
  }

  // Handle placeholders like "{{DEAL_ID}}" which means B24 didn't replace them
  if (effectiveDealId.includes("{") || effectiveClientId.includes("{")) {
    console.warn("Detected unresolved Bitrix24 placeholders. Please check Robot configuration.");
  }

  const token = await createSurveyToken(effectiveClientId, effectiveDealId);
  
  // Get base URL from env or request headers
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    const host = req.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${host}`;
  }
  
  const surveyUrl = `${appUrl}/survey/${token}`;
  console.log(`Generated Survey URL: ${surveyUrl}`);

  // Outbound notification to Bitrix24
  try {
    const settings = await prisma.settings.findMany({
      where: { key: { in: ["b24_webhook_url", "b24_message_template", "b24_link_field"] } }
    });
    
    const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (settingsMap.b24_webhook_url) {
      const template = settingsMap.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
      const message = template.replace("{surveyUrl}", surveyUrl);
      const baseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");

      // 1. Try to send via Open Channel (Direct Chat)
      try {
        const cleanBaseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");
        console.log(`Open Channel Delivery attempt for Deal ${effectiveDealId} via ${cleanBaseUrl}`);

        // Get Lead/Contact info for better targeting
        const dealUrl = `${cleanBaseUrl}/crm.deal.get.json?id=${effectiveDealId}`;
        const dealRes = await fetch(dealUrl);
        const dealDataRaw = await dealRes.json();
        const contactId = dealDataRaw.result?.CONTACT_ID;
        const leadId = dealDataRaw.result?.LEAD_ID;

        const sendMessage = async (type: string, id: string) => {
          const entityType = type.toLowerCase();
          console.log(`Attempting message to ${entityType} ${id}...`);
          try {
            // 1. First get the Chat ID
            const chatUrl = `${cleanBaseUrl}/imopenlines.crm.chat.get.json?CRM_ENTITY_TYPE=${entityType}&CRM_ENTITY=${id}&ACTIVE_ONLY=N`;
            console.log(`Chat lookup URL: ${chatUrl}`);
            const chatRes = await fetch(chatUrl);
            const chatData = await chatRes.json();
            console.log(`Chat lookup result for ${entityType} ${id}:`, JSON.stringify(chatData));
            
            // Extract numerical CHAT_ID from response
            let chatId = null;
            if (Array.isArray(chatData.result)) {
              chatId = chatData.result[0]?.CHAT_ID || chatData.result[0];
            } else {
              chatId = chatData.result?.CHAT_ID || chatData.result;
            }

            if (!chatId) {
              console.log(`No chat found for ${entityType} ${id}`);
              return false;
            }

            // 2. Use the webhook owner ID as USER_ID
            const webhookUserId = cleanBaseUrl.match(/\/rest\/(\d+)\//)?.[1] || "1";

            const payload = {
              CRM_ENTITY_TYPE: entityType,
              CRM_ENTITY: id,
              CHAT_ID: chatId,
              USER_ID: webhookUserId,
              MESSAGE: message
            };
            
            console.log(`Sending message to Chat ${chatId} (Entity: ${entityType} ${id})...`);
            const res = await fetch(`${cleanBaseUrl}/imopenlines.crm.message.add.json`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            console.log(`Message delivery result:`, JSON.stringify(data));
            return !!data.result;
          } catch (e) {
            console.error(`Error in sendMessage for ${entityType} ${id}:`, e);
            return false;
          }
        };

        // Try Deal first, then Lead, then Contact
        let sent = await sendMessage("DEAL", effectiveDealId);
        if (!sent && leadId) sent = await sendMessage("LEAD", leadId);
        if (!sent && contactId) sent = await sendMessage("CONTACT", contactId);

        if (sent) {
          console.log("SUCCESS: Message delivered to Open Channel.");
        } else {
          console.log("No active Open Channel session could be targeted.");
        }
      } catch (ocError) {
        console.error("FATAL: Open Channel block error:", ocError);
      }

      // 2. Log to Deal Timeline (Standard Fallback)
      const timelineUrl = baseUrl + "/crm.timeline.comment.add";
      await fetch(timelineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            ENTITY_ID: effectiveDealId,
            ENTITY_TYPE: "deal",
            COMMENT: message
          }
        })
      });

      // 3. Update the custom field for automated delivery (SMS/WhatsApp robots)
      const linkField = settingsMap.b24_link_field || "UF_CRM_1773746121";
      const updateUrl = baseUrl + "/crm.deal.update";
      await fetch(updateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: effectiveDealId,
          fields: {
            [linkField]: surveyUrl
          }
        })
      });
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
