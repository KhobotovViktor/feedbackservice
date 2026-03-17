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
        console.log(`Deep Search for Open Channel: Deal ${effectiveDealId}`);
        const baseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");

        // DIAGNOSTIC: Check available methods
        const methodsRes = await fetch(`${baseUrl}/methods`);
        const methodsData = await methodsRes.json();
        const hasImOpenlines = methodsData.result?.some((m: string) => m.startsWith("imopenlines."));
        console.log(`B24 Webhook Permissions: hasImOpenlines=${hasImOpenlines}`);
        if (!hasImOpenlines) {
          console.warn("WARNING: imopenlines methods NOT listed in available methods for this webhook.");
        }

        // DIAGNOSTIC: Log full Deal object
        const dealRes = await fetch(`${baseUrl}/crm.deal.get?id=${effectiveDealId}`);
        const dealDataRaw = await dealRes.json();
        console.log("FULL DEAL DATA:", JSON.stringify(dealDataRaw));

        const contactId = dealDataRaw.result?.CONTACT_ID;
        let sessionId = null;

        if (hasImOpenlines) {
          // Attempt using standard OC getter
          const sessionRes = await fetch(`${baseUrl}/imopenlines.crm.session.get?CRM_ENTITY_TYPE=DEAL&CRM_ENTITY_ID=${effectiveDealId}`);
          const sessionData = await sessionRes.json();
          sessionId = sessionData.result?.ID;

          if (!sessionId && contactId) {
            const contactSessionRes = await fetch(`${baseUrl}/imopenlines.crm.session.get?CRM_ENTITY_TYPE=CONTACT&CRM_ENTITY_ID=${contactId}`);
            const contactSessionData = await contactSessionRes.json();
            sessionId = contactSessionData.result?.ID;
          }
        }

        if (sessionId) {
          console.log(`SUCCESS: Found session ID ${sessionId}. Sending message...`);
          const chatMsgRes = await fetch(`${baseUrl}/imopenlines.operator.message.add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              SESSION_ID: sessionId,
              MESSAGE: message
            })
          });
          const chatMsgData = await chatMsgRes.json();
          console.log("Message Add Response:", JSON.stringify(chatMsgData));
        } else {
          console.error("No Open Channel session found or methods restricted.");
        }
      } catch (ocError) {
        console.error("Error in diagnostic OC logic:", ocError);
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
