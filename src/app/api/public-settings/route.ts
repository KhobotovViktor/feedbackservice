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

// Tiny in-memory cache. Branding changes rarely but this endpoint is hit by
// every login and survey load, so a short TTL spares the DB a query per hit.
// Process-local (PM2 fork) — fine for a value that's eventually consistent;
// a save in the admin shows up within TTL seconds.
const CACHE_TTL_MS = 30_000;
let cache: { at: number; data: Record<string, string> } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }
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
    cache = { at: Date.now(), data: out };
    return NextResponse.json(out);
  } catch (err) {
    console.error("public-settings GET failed:", err);
    // Serve a stale cache if we have one; otherwise an empty payload so the
    // login / survey page degrades to its built-in defaults instead of 500.
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({}, { status: 200 });
  }
}
