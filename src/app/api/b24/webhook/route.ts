import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

function isValidId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !/[{}\n\r]/.test(value);
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
  
  // Get base URL from env or request headers
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    const host = req.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
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
      const template = settingsMap.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
      const message = template.replace("{surveyUrl}", surveyUrl);
      const baseUrl = settingsMap.b24_webhook_url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");


      // 0. Fetch Deal data once to use for both Open Channel and Field Protection
      let dealData: any = null;
      try {
        const dealRes = await fetch(`${baseUrl}/crm.deal.get.json?id=${effectiveDealId}`);
        const dealDataRaw = await dealRes.json();
        dealData = dealDataRaw.result;
      } catch (e) {
        console.error("Failed to fetch deal data for protection check:", e);
      }

      // 1. Try to send via Open Channel (Direct Chat)
      try {
        const cleanBaseUrl = baseUrl;
        console.log(`Open Channel Delivery attempt for Deal ${effectiveDealId}`);

        const dealContactId = dealData?.CONTACT_ID;
        const dealLeadId = dealData?.LEAD_ID;

        // Also fetch Lead details
        let leadContactId = null;
        if (dealLeadId) {
          try {
            const leadRes = await fetch(`${cleanBaseUrl}/crm.lead.get.json?id=${dealLeadId}`);
            const leadData = await leadRes.json();
            leadContactId = leadData.result?.CONTACT_ID;
          } catch (e) {}
        }

        const sendMessage = async (type: string, id: string) => {
          const entityType = type.toLowerCase();
          console.log(`Searching for chat bound to ${entityType} ${id}...`);
          try {
            const chatUrl = `${cleanBaseUrl}/imopenlines.crm.chat.get.json?CRM_ENTITY_TYPE=${entityType}&CRM_ENTITY=${id}&ACTIVE_ONLY=N`;
            const chatRes = await fetch(chatUrl);
            const chatData = await chatRes.json();
            
            let chats = chatData.result;
            if (!Array.isArray(chats)) chats = chats ? [chats] : [];
            
            for (const chat of chats) {
              const chatId = chat.CHAT_ID || chat;
              if (!chatId) continue;

              const webhookUserId = cleanBaseUrl.match(/\/rest\/(\d+)\//)?.[1] || "1";
              
              // Method 1: im.message.add (Winning Method - Most reliable for Open Lines)
              console.log(`Attempting message (im.message.add) to Chat ${chatId}...`);
              const imPayload = {
                DIALOG_ID: `chat${chatId}`,
                MESSAGE: message
              };
              
              const imRes = await fetch(`${cleanBaseUrl}/im.message.add.json`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(imPayload)
              });
              const imData = await imRes.json();
              console.log(`IM Result:`, JSON.stringify(imData));
              if (imData.result) return true;

              // Method 2: imopenlines.crm.message.add (Original CRM Fallback)
              console.log(`Attempting CRM fallback (imopenlines.crm.message.add) for ${entityType} ${id}...`);
              const crmPayload = {
                CRM_ENTITY_TYPE: entityType,
                CRM_ENTITY: parseInt(id),
                CHAT_ID: parseInt(chatId),
                USER_ID: parseInt(webhookUserId),
                MESSAGE: message
              };
              
              const crmRes = await fetch(`${cleanBaseUrl}/imopenlines.crm.message.add.json`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(crmPayload)
              });
              const crmData = await crmRes.json();
              if (crmData.result) return true;
            }
          } catch (e) {
            console.error(`Error in sendMessage logic:`, e);
          }
          return false;
        };

        // Try order: Deal -> Lead -> Contact (from Deal) -> Contact (from Lead)
        let sent = await sendMessage("deal", effectiveDealId);
        if (!sent && dealLeadId) sent = await sendMessage("lead", dealLeadId);
        if (!sent && dealContactId) sent = await sendMessage("contact", dealContactId);
        if (!sent && leadContactId) sent = await sendMessage("contact", leadContactId);

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
      const existingValue = dealData ? dealData[linkField] : null;

      if (!existingValue || String(existingValue).trim() === "") {
        console.log(`Field ${linkField} is empty. Updating with survey link.`);
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
        console.log(`Field ${linkField} already contains data ("${existingValue}"). Skipping update to prevent overwriting.`);
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
