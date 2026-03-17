import { NextRequest, NextResponse } from "next/server";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const dealId = searchParams.get("dealId");

  if (!clientId || !dealId) {
    return NextResponse.json(
      { error: "Missing clientId or dealId" },
      { status: 400 }
    );
  }

  const token = await createSurveyToken(clientId, dealId);
  const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${token}`;

  // Outbound notification to Bitrix24
  try {
    const settings = await prisma.settings.findMany({
      where: { key: { in: ["b24_webhook_url", "b24_message_template"] } }
    });
    
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (settingsMap.b24_webhook_url) {
      const template = settingsMap.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
      const message = template.replace("{surveyUrl}", surveyUrl);

      // Log to Deal Timeline
      const timelineUrl = settingsMap.b24_webhook_url.replace(/\/$/, "") + "/crm.timeline.item.add";
      await fetch(timelineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            ENTITY_ID: dealId,
            ENTITY_TYPE: "deal",
            COMMENT: message
          }
        })
      });
    }
  } catch (error) {
    console.error("Failed to send outbound to B24:", error);
    // Continue even if B24 notification fails
  }

  return NextResponse.json({
    surveyUrl,
    token,
  });
}
