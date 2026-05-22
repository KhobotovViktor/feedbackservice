import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAppOrigin } from "@/lib/url";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";

// Bind / unbind / check the Bitrix24 ONSESSIONFINISH event so closing an Open
// Line dialog triggers the survey link. Session-gated (admin panel only). Uses
// the configured b24_webhook_url to call B24's event.* REST methods.

const EVENT = "ONSESSIONFINISH";

async function getWebhookBase(): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key: "b24_webhook_url" } });
  if (!s?.value || !isSafeB24Url(s.value)) return null;
  return normalizeB24Url(s.value);
}

function handlerUrl(req: NextRequest): string {
  return `${getAppOrigin(req)}/api/b24/session-finish`;
}

// GET — is our handler currently bound?
export async function GET(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = await getWebhookBase();
  if (!base) {
    return NextResponse.json({ error: "b24_webhook_url not configured" }, { status: 400 });
  }
  const handler = handlerUrl(req);
  try {
    const r = await fetch(`${base}/event.get.json`);
    const j = await r.json();
    const list: Array<{ event?: string; handler?: string }> = Array.isArray(j.result) ? j.result : [];
    const bound = list.some(
      (e) => (e.event || "").toUpperCase() === EVENT && (e.handler || "") === handler
    );
    return NextResponse.json({ bound, handler });
  } catch (e) {
    console.error("event.get failed:", e);
    return NextResponse.json({ error: "Failed to query events" }, { status: 502 });
  }
}

// POST — bind the event to our handler.
export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = await getWebhookBase();
  if (!base) {
    return NextResponse.json({ error: "b24_webhook_url not configured" }, { status: 400 });
  }
  const handler = handlerUrl(req);
  try {
    const r = await fetch(`${base}/event.bind.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: EVENT, handler }),
    });
    const j = await r.json();
    if (j.error && j.error !== "ERROR_EVENT_BINDING_EXIST") {
      return NextResponse.json(
        { error: j.error_description || j.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, bound: true, handler });
  } catch (e) {
    console.error("event.bind failed:", e);
    return NextResponse.json({ error: "Failed to bind event" }, { status: 502 });
  }
}

// DELETE — unbind our handler.
export async function DELETE(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = await getWebhookBase();
  if (!base) {
    return NextResponse.json({ error: "b24_webhook_url not configured" }, { status: 400 });
  }
  const handler = handlerUrl(req);
  try {
    const r = await fetch(`${base}/event.unbind.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: EVENT, handler }),
    });
    const j = await r.json();
    if (j.error) {
      return NextResponse.json({ error: j.error_description || j.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, bound: false });
  } catch (e) {
    console.error("event.unbind failed:", e);
    return NextResponse.json({ error: "Failed to unbind event" }, { status: 502 });
  }
}
