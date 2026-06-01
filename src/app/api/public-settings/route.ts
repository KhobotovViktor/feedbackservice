import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Settings keys that are safe to expose without an admin session — they're
// already public-facing in the rendered UI (logo, brand name, review links).
// Anything sensitive (B24 webhooks, Telegram tokens, sync keys) is NOT here
// and stays behind /api/settings + admin auth.
const PUBLIC_KEYS = [
  "brand_name",
  "brand_logo_url",
  "brand_site_url",
  "brand_accent",
  "brand_company_full",
  "brand_privacy_contact",
  // Customer-facing review platforms — used by the survey page when the
  // customer finishes a positive flow.
  "review_yandex",
  "review_2gis",
  "review_google_maps",
  // UI flag for the city-picker step before a CRM survey.
  "city_selection_enabled",
] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.settings.findMany({
      where: { key: { in: [...PUBLIC_KEYS] } },
      select: { key: true, value: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      // Whitelist filter again — defence-in-depth in case findMany leaks
      // anything outside the intended set.
      if ((PUBLIC_KEYS as readonly string[]).includes(r.key)) {
        out[r.key] = r.value ?? "";
      }
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("public-settings GET failed:", err);
    // Never break the login / survey page with a 500 — return an empty
    // payload so the UI degrades to its built-in defaults.
    return NextResponse.json({}, { status: 200 });
  }
}
