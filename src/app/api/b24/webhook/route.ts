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
        console.log(`Searching for active Open Channel session for Deal ${effectiveDealId}`);
        const baseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");

        // Step A: Search by Deal ID directly
        const sessionUrl = `${baseUrl}/imopenlines.session.list?filter[CRM_ENTITY_TYPE]=DEAL&filter[CRM_ENTITY_ID]=${effectiveDealId}&order[ID]=DESC&limit=5`;
        const sessionRes = await fetch(sessionUrl);
        const sessionData = await sessionRes.json();
        
        let sessionId = sessionData.result?.[0]?.ID;

        // Step B: If not found, try common fallback: Search by Contact ID linked to the deal
        if (!sessionId) {
          console.log(`Session not found for Deal. Fetching contact info for Deal ${effectiveDealId}...`);
          const dealRes = await fetch(`${baseUrl}/crm.deal.get?id=${effectiveDealId}`);
          const dealData = await dealRes.json();
          const contactId = dealData.result?.CONTACT_ID;

          if (contactId) {
            console.log(`Found Contact ID ${contactId}. Searching session for Contact...`);
            const contactSessionUrl = `${baseUrl}/imopenlines.session.list?filter[CRM_ENTITY_TYPE]=CONTACT&filter[CRM_ENTITY_ID]=${contactId}&order[ID]=DESC&limit=1`;
            const contactSessionRes = await fetch(contactSessionUrl);
            const contactSessionData = await contactSessionRes.json();
            sessionId = contactSessionData.result?.[0]?.ID;
          }
        }

        if (sessionId) {
          console.log(`Found active Open Channel session: ${sessionId}`);
          const chatMsgUrl = `${baseUrl}/imopenlines.operator.message.add`;
          const chatMsgRes = await fetch(chatMsgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              SESSION_ID: sessionId,
              MESSAGE: message
            })
          });
          const chatMsgData = await chatMsgRes.json();
          console.log("Open Channel Message Status:", chatMsgRes.status, chatMsgData);
        } else {
          console.log("No active Open Channel session found for this deal or contact.");
        }
      } catch (ocError) {
        console.error("Error attempting Open Channel delivery:", ocError);
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
