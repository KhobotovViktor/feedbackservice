import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      b24_webhook_url, 
      b24_message_template,
      b24_field_quality,
      b24_field_support,
      b24_field_average,
      b24_field_comment
    } = body;

    const updates = [];

    const keys = [
      "b24_webhook_url", 
      "b24_message_template",
      "b24_field_quality",
      "b24_field_support",
      "b24_field_average",
      "b24_field_comment",
      "review_yandex",
      "review_2gis",
      "review_google_maps",
      "b24_group_chat_id",
      "review_min_score",
      "survey_questions"
    ];

    for (const key of keys) {
      if (body[key] !== undefined) {
        updates.push(
          prisma.settings.upsert({
            where: { key },
            update: { value: String(body[key]) },
            create: { key, value: String(body[key]) },
          })
        );
      }
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
