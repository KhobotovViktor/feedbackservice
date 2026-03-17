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

        // DIAGNOSTIC: Log exact IM methods
        const methodsRes = await fetch(`${baseUrl}/methods.json`);
        const methodsData = await methodsRes.json();
        const imMethods = methodsData.result?.filter((m: string) => m.startsWith("imopenlines."));
        console.log(`AVAILABLE IM METHODS: ${JSON.stringify(imMethods)}`);

        // DIAGNOSTIC: Log full Deal object
        const dealRes = await fetch(`${baseUrl}/crm.deal.get.json?id=${effectiveDealId}`);
        const dealDataRaw = await dealRes.json();
        const contactId = dealDataRaw.result?.CONTACT_ID;
        const leadId = dealDataRaw.result?.LEAD_ID;
        console.log(`DEAL ENTITIES: Contact=${contactId}, Lead=${leadId}`);

        let sessionId = null;

        const tryGetSession = async (type: string, id: string) => {
          console.log(`Attempting to find session for ${type} ${id}...`);
          try {
            const res = await fetch(`${baseUrl}/imopenlines.crm.session.get.json?CRM_ENTITY_TYPE=${type}&CRM_ENTITY_ID=${id}`);
            const data = await res.json();
            if (data.result?.ID) return data.result.ID;
            
            // Fallback to list
            const listRes = await fetch(`${baseUrl}/imopenlines.session.list.json?filter[CRM_ENTITY_TYPE]=${type}&filter[CRM_ENTITY_ID]=${id}&order[ID]=DESC&limit=1`);
            const listData = await listRes.json();
            return listData.result?.[0]?.ID;
          } catch (e) {
            return null;
          }
        };

        // Execution order: Deal -> Contact -> Lead
        sessionId = await tryGetSession("DEAL", effectiveDealId);
        if (!sessionId && contactId) sessionId = await tryGetSession("CONTACT", contactId);
        if (!sessionId && leadId) sessionId = await tryGetSession("LEAD", leadId);

        if (sessionId) {
          console.log(`SUCCESS: Found session ID ${sessionId}. Sending message...`);
          const chatMsgRes = await fetch(`${baseUrl}/imopenlines.operator.message.add.json`, {
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
          console.error("No Open Channel session found after deep search (Deal/Contact/Lead).");
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
