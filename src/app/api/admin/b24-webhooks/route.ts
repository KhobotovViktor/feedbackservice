import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Per-operator Bitrix24 incoming webhooks.
 *
 * The main settings.b24_webhook_url stays the "default" webhook used for CRM
 * operations (crm.deal.get / crm.timeline.comment.add / crm.deal.update).
 *
 * These rows let us pick a per-operator webhook for `im.message.add` so that
 * the message to the client is sent from the actual operator's account
 * (which is the one with permission to write in the right Open Channel).
 *
 * Auth is enforced by src/proxy.ts — any path under /api/admin/* requires a
 * valid session cookie.
 */

function isValidB24Url(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!u.hostname.toLowerCase().includes("bitrix24.")) return false;
    // Block loopback / private ranges.
    const host = u.hostname.toLowerCase();
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
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string): string {
  // Strip trailing slash and trailing /profile.json or /profile so the value
  // matches the shape we use for API calls (base URL without method suffix).
  return raw
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(profile\.json|profile)$/, "");
}

function isValidUserId(value: string): boolean {
  return /^\d{1,12}$/.test(value);
}

export async function GET() {
  try {
    const rows = await prisma.b24Webhook.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, displayName: true, url: true, createdAt: true },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to list B24 webhooks:", error);
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userIdRaw = String(body.userId ?? "").trim();
    const urlRaw = String(body.url ?? "").trim();
    const displayName = body.displayName ? String(body.displayName).slice(0, 128) : null;

    if (!isValidUserId(userIdRaw)) {
      return NextResponse.json(
        { error: "userId must be a numeric Bitrix24 user ID" },
        { status: 400 }
      );
    }
    const url = normalizeUrl(urlRaw);
    if (!isValidB24Url(url)) {
      return NextResponse.json(
        { error: "url must be a HTTPS link to a *.bitrix24.* host" },
        { status: 400 }
      );
    }

    // Reject mismatch: the webhook URL embeds the owner user id as
    // /rest/<userId>/<token>/. If the body's userId doesn't match what's in
    // the URL, that's almost certainly a copy/paste mistake and would silently
    // break routing later. Surface it now.
    const m = url.match(/\/rest\/(\d+)\//);
    if (m && m[1] !== userIdRaw) {
      return NextResponse.json(
        {
          error: `userId (${userIdRaw}) does not match the user embedded in the URL (${m[1]}). Did you paste the wrong webhook?`,
        },
        { status: 400 }
      );
    }

    const row = await prisma.b24Webhook.upsert({
      where: { userId: userIdRaw },
      create: { userId: userIdRaw, url, displayName },
      update: { url, displayName },
      select: { id: true, userId: true, displayName: true, url: true, createdAt: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Failed to create B24 webhook:", error);
    return NextResponse.json({ error: "Failed to save webhook" }, { status: 500 });
  }
}
