import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeB24Url } from "@/lib/b24-url";

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
  // CRM field for the callback phone left on a negative response.
  "b24_field_phone",
  "review_yandex",
  "review_2gis",
  "review_google_maps",
  "b24_group_chat_id",
  "b24_template_id",
  "survey_questions",
  "b24_link_field",
  // Enable the "pick your city" step for CRM survey links ("true"/"false").
  "city_selection_enabled",
  // Survey-page branding (logo / name / site link / accent colour).
  "brand_name",
  "brand_logo_url",
  "brand_site_url",
  "brand_accent",
  // Legal-side branding for footers / Privacy / Terms pages.
  //   brand_company_full — full legal name with org type & details
  //     (e.g. "ООО «Компания», ИНН 1234567890") — shows up as the
  //     "Оператор" in the privacy/terms texts and in printed leaflets.
  //   brand_privacy_contact — public contact for data-processing
  //     requests (email / phone / address). Substituted into the
  //     privacy policy and the terms-of-service page.
  "brand_company_full",
  "brand_privacy_contact",
  // Telegram channel for negative-feedback alerts.
  "telegram_bot_token",
  "telegram_chat_id",
  // Rating-drop alert threshold (stars). When a synced map rating crosses
  // below this value, a Telegram alert fires. Empty → default 4.0; "0" or
  // "off" disables rating-drop alerts.
  "alert_min_rating",
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
