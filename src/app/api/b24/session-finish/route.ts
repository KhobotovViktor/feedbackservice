import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/url";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Bitrix24 fires ONSESSIONFINISH when an Open Line dialog is closed. Unlike the
// stage-robot webhook (which carries a dealId), this event only gives us the
// chat — so we send the survey link straight into that chat. The link is built
// from the (optional) line→branch mapping and the operator's webhook for the
// responsible name; the score still lands in Results, but no CRM deal fields
// are touched (there's no deal in the event).
//
// Public route (B24 calls us with no session); guarded by a soft rate limit and
// an optional shared secret (B24_WEBHOOK_SECRET, same as /api/b24/webhook).

interface SessionEvent {
  chatId: string | null;
  userId: string | null;
  lineId: string | null;
  event: string | null;
}

// The event arrives as application/x-www-form-urlencoded with deeply nested
// keys like data[DATA][0][connector][chat_id]. We also tolerate JSON bodies and
// plain query params, and match keys by suffix so the array index doesn't
// matter.
async function extractEvent(req: NextRequest): Promise<SessionEvent> {
  const out: SessionEvent = { chatId: null, userId: null, lineId: null, event: null };

  const sp = new URL(req.url).searchParams;
  out.event = sp.get("event");
  out.chatId = sp.get("chat_id") || sp.get("CHAT_ID");
  out.userId = sp.get("user_id");
  out.lineId = sp.get("line_id");
  if (out.chatId) return out;

  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      out.event = out.event || j?.event || null;
      const c = j?.data?.DATA?.[0]?.connector ?? {};
      out.chatId = out.chatId || (c.chat_id != null ? String(c.chat_id) : null) || (j?.data?.DATA?.[0]?.chat?.id != null ? String(j.data.DATA[0].chat.id) : null);
      out.userId = out.userId || (c.user_id != null ? String(c.user_id) : null);
      out.lineId = out.lineId || (c.line_id != null ? String(c.line_id) : null);
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params) {
        if (k === "event") out.event = out.event || v;
        else if (k.endsWith("[chat_id]") && !out.chatId) out.chatId = v;
        else if (k.endsWith("[chat][id]") && !out.chatId) out.chatId = v;
        else if (k.endsWith("[user_id]") && !out.userId) out.userId = v;
        else if (k.endsWith("[line_id]") && !out.lineId) out.lineId = v;
      }
    }
  } catch {
    // best-effort — fall through with whatever we parsed from the query
  }
  return out;
}

async function handle(req: NextRequest) {
  if (!rateLimit(`olf:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const secret = process.env.B24_WEBHOOK_SECRET;
  if (secret && new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId, userId, lineId } = await extractEvent(req);
  if (!chatId || !/^\d+$/.test(chatId)) {
    return NextResponse.json({ error: "Missing chat id" }, { status: 400 });
  }

  // One survey per closed dialog. SentSurvey.dealId is @unique — namespace the
  // chat id so it can't collide with real deal/lead ids.
  const dedupKey = `OL_${chatId}`;
  try {
    await prisma.sentSurvey.create({ data: { dealId: dedupKey, clientId: dedupKey } });
  } catch (e: unknown) {
    if ((e as { code?: string } | null)?.code === "P2002") {
      return NextResponse.json({ message: "Survey already sent for this dialog", skip: true });
    }
    console.error("session-finish SentSurvey insert failed:", e);
    return NextResponse.json({ error: "Failed to record dispatch" }, { status: 500 });
  }

  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_message_template", "b24_template_id", "ol_line_branch_map"] } },
  });
  const sm = settings.reduce<Record<string, string>>((a, c) => ((a[c.key] = c.value), a), {});

  // Optional line → branch mapping: { "128": "<branchId>" }.
  let branchId: string | null = null;
  if (lineId && sm.ol_line_branch_map) {
    try {
      const map = JSON.parse(sm.ol_line_branch_map) as Record<string, string>;
      branchId = map[lineId] || null;
    } catch {
      // ignore malformed mapping
    }
  }

  // Responsible operator name, from the registered per-operator webhook.
  let responsibleName: string | null = null;
  if (userId) {
    try {
      const w = await prisma.b24Webhook.findUnique({ where: { userId } });
      responsibleName = w?.displayName || null;
    } catch {
      // best-effort
    }
  }

  // Template: the branch's own template if mapped, else the global one.
  let templateId: string | null = sm.b24_template_id || null;
  if (branchId) {
    try {
      const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { templateId: true } });
      if (b?.templateId) templateId = b.templateId;
    } catch {
      // keep global template
    }
  }
  if (responsibleName) {
    try {
      await prisma.sentSurvey.update({ where: { dealId: dedupKey }, data: { responsibleName } });
    } catch {
      // non-critical
    }
  }

  const token = await createSurveyToken(dedupKey, dedupKey, branchId, false, templateId, responsibleName, null);
  const appUrl = getAppOrigin(req);
  const fullUrl = `${appUrl}/survey/${token}`;

  let surveyUrl = fullUrl;
  try {
    const code = randomBytes(4).toString("hex");
    await prisma.shortLink.create({ data: { code, url: fullUrl, branchId } });
    surveyUrl = `${appUrl}/s/${code}`;
  } catch (e) {
    console.error("session-finish short link failed:", e);
  }
  try {
    await prisma.sentSurvey.update({ where: { dealId: dedupKey }, data: { surveyUrl } });
  } catch {
    // non-critical
  }

  // Deliver straight into the closed chat. Try the operator's webhook first,
  // then any other registered operator webhook, then the default — whichever is
  // a member of the Open Line will be accepted.
  if (sm.b24_webhook_url && isSafeB24Url(sm.b24_webhook_url)) {
    const baseUrl = normalizeB24Url(sm.b24_webhook_url);
    const template = sm.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}";
    const message = template.replace("{surveyUrl}", surveyUrl);

    const perOp = await prisma.b24Webhook.findMany({ select: { userId: true, url: true } });
    const sendCandidates: string[] = [];
    const seen = new Set<string>();
    const push = (raw?: string | null) => {
      if (!raw) return;
      const n = normalizeB24Url(raw);
      if (!seen.has(n)) {
        seen.add(n);
        sendCandidates.push(n);
      }
    };
    if (userId) push(perOp.find((w) => w.userId === userId)?.url);
    for (const w of perOp) push(w.url);
    push(baseUrl);

    let sent = false;
    for (const sendBase of sendCandidates) {
      try {
        const r = await fetch(`${sendBase}/im.message.add.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DIALOG_ID: `chat${chatId}`, MESSAGE: message }),
        });
        const d = await r.json();
        if (d.result) {
          sent = true;
          break;
        }
        if (d.error && d.error !== "CANCELED") {
          console.log(`session-finish im.message.add error: ${d.error_description || d.error}`);
        }
      } catch (e) {
        console.error("session-finish im.message.add request failed:", e);
      }
    }
    if (!sent) console.log(`session-finish: no webhook could post into chat ${chatId}`);
  } else {
    console.warn("session-finish: b24_webhook_url not configured");
  }

  return NextResponse.json({ ok: true, surveyUrl });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
