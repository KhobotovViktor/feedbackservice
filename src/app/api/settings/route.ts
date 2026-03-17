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
    const { b24_webhook_url, b24_message_template } = body;

    const updates = [];

    if (b24_webhook_url !== undefined) {
      updates.push(
        prisma.settings.upsert({
          where: { key: "b24_webhook_url" },
          update: { value: b24_webhook_url },
          create: { key: "b24_webhook_url", value: b24_webhook_url },
        })
      );
    }

    if (b24_message_template !== undefined) {
      updates.push(
        prisma.settings.upsert({
          where: { key: "b24_message_template" },
          update: { value: b24_message_template },
          create: { key: "b24_message_template", value: b24_message_template },
        })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
