import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSafeB24Url, normalizeB24Url } from "@/lib/b24-url";
import { fetchWithRetry } from "@/lib/fetch-retry";

/**
 * Scheduled summary report. Posts a 7-day rollup to the Bitrix24 group chat.
 * Triggered by the VM cron (Mon/Wed/Fri 10:00) with SYNC_API_KEY, or manually
 * by an admin session. Exempt from the proxy session gate (exact-path
 * allowlist) — auth enforced here.
 */
const WINDOW_DAYS = 7;

async function authorized(req: NextRequest): Promise<boolean> {
  if (await getSession()) return true;
  const KEY = process.env.SYNC_API_KEY;
  if (!KEY) return false;
  const provided =
    req.headers.get("x-api-key") || new URL(req.url).searchParams.get("apiKey");
  return provided === KEY;
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000);
  const dateScope = { createdAt: { gte: since } };

  const [total, avgAgg, negativeCount, openComplaints, clicks, branches, lastRating] =
    await Promise.all([
      prisma.surveyResponse.count({ where: dateScope }),
      prisma.surveyResponse.aggregate({ where: dateScope, _avg: { averageScore: true } }),
      prisma.surveyResponse.count({ where: { ...dateScope, averageScore: { lt: 4.5 } } }),
      prisma.surveyResponse.count({
        where: { complaintStatus: { in: ["NEW", "IN_PROGRESS"] } },
      }),
      prisma.analyticsEvent.count({ where: { ...dateScope, type: "CLICK" } }),
      prisma.branch.findMany({
        select: {
          name: true,
          surveyResponses: { where: dateScope, select: { averageScore: true } },
        },
      }),
      // Health-check: when did rating sync last write anything? A stale value
      // means the Apps Script syncer (or upstream DOM/Serper) has broken
      // silently — we surface it in the report so it doesn't go unnoticed.
      prisma.ratingHistory.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const avg = avgAgg._avg.averageScore ?? 0;
  const periodLabel = `${since.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })} – ${new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  // Build the report text (Bitrix chat BB-code).
  let msg = `📊 [b]Отчёт по отзывам за ${WINDOW_DAYS} дней[/b]\n`;
  msg += `🗓 ${periodLabel}\n\n`;
  msg += `📝 [b]Всего опросов:[/b] ${total}\n`;
  msg += `⭐ [b]Средняя оценка:[/b] ${avg.toFixed(1)}\n`;
  msg += `⚠️ [b]Негативных за период:[/b] ${negativeCount}\n`;
  msg += `🔴 [b]Открытых жалоб (всего):[/b] ${openComplaints}\n`;
  msg += `🗺 [b]Переходов на карты:[/b] ${clicks}\n`;

  // Rating-sync freshness warning. > 2 days stale (or never) = likely broken.
  const STALE_MS = 2 * 24 * 3600_000;
  const lastSyncAt = lastRating?.createdAt ?? null;
  const syncStale = !lastSyncAt || Date.now() - lastSyncAt.getTime() > STALE_MS;
  if (syncStale) {
    const whenTxt = lastSyncAt
      ? lastSyncAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })
      : "никогда";
    msg += `\n⚠️ [b]Синхронизация рейтингов не обновлялась[/b] (последняя: ${whenTxt}). Проверьте Google Apps Script.\n`;
  }

  const branchLines = branches
    .map((b) => {
      const scores = b.surveyResponses.map((r) => r.averageScore);
      const cnt = scores.length;
      const a = cnt > 0 ? scores.reduce((x, y) => x + y, 0) / cnt : 0;
      return { name: b.name, cnt, a };
    })
    .filter((b) => b.cnt > 0)
    .sort((x, y) => y.cnt - x.cnt);

  if (branchLines.length > 0) {
    msg += `\n[b]По филиалам:[/b]\n`;
    for (const b of branchLines) {
      msg += `• ${b.name}: ${b.cnt} опр., ср. ${b.a.toFixed(1)}\n`;
    }
  }

  // Deliver to the group chat if configured.
  const settings = await prisma.settings.findMany({
    where: { key: { in: ["b24_webhook_url", "b24_group_chat_id"] } },
  });
  const sm = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  let delivered = false;
  if (sm.b24_webhook_url && isSafeB24Url(sm.b24_webhook_url) && sm.b24_group_chat_id) {
    const base = normalizeB24Url(sm.b24_webhook_url);
    const raw = sm.b24_group_chat_id.trim();
    const dialogId = raw.startsWith("chat") ? raw : `chat${raw}`;
    try {
      const r = await fetchWithRetry(`${base}/im.message.add.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ DIALOG_ID: dialogId, MESSAGE: msg }),
      });
      const j = await r.json();
      delivered = Boolean(j.result);
      if (!delivered) console.error("Report delivery error:", j.error_description || j.error);
    } catch (e) {
      console.error("Report delivery failed:", e);
    }
  }

  return NextResponse.json({
    success: true,
    delivered,
    summary: { total, avg: Number(avg.toFixed(1)), negativeCount, openComplaints, clicks },
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
