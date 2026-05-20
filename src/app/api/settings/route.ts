import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Reject anything that isn't a Bitrix24 incoming webhook URL. Centralized
// here (write path) AND in src/app/api/b24/webhook/route.ts (read path) so
// SSRF can't slip in via either direction.
function isSafeB24Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return host.includes("bitrix24.");
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const settingsMap = settings.reduce(
      (acc: Record<string, string>, curr: { key: string; value: string }) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {}
    );

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// Keys we accept from the admin panel. Anything else in the POST body is
// silently dropped — prevents a forged request from polluting `Settings`
// with arbitrary keys that other handlers might trust.
const ALLOWED_KEYS = [
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
  "b24_template_id",
  "review_min_score",
  "survey_questions",
  "b24_link_field",
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the few keys we know how to validate. Unknown keys are dropped.
    if (typeof body.b24_webhook_url === "string" && body.b24_webhook_url.trim() !== "") {
      if (!isSafeB24Url(body.b24_webhook_url)) {
        return NextResponse.json(
          { error: "b24_webhook_url must be an HTTPS URL on a *.bitrix24.* host" },
          { status: 400 }
        );
      }
    }
    if (
      body.review_min_score !== undefined &&
      Number.isNaN(Number(body.review_min_score))
    ) {
      return NextResponse.json(
        { error: "review_min_score must be a number" },
        { status: 400 }
      );
    }
    if (
      typeof body.b24_message_template === "string" &&
      body.b24_message_template.length > 2000
    ) {
      return NextResponse.json(
        { error: "b24_message_template is too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    const updates = [];
    for (const key of ALLOWED_KEYS) {
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
