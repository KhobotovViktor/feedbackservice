import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkRatingSanity } from "@/lib/rating-sanity";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = 'force-dynamic';

// Resolve the rating-drop alert threshold from Settings. Empty/unset → 4.0
// (alerts on by default once Telegram is configured); "0"/"off"/"none" → off
// (returns null). Any number → that threshold.
async function getAlertThreshold(): Promise<number | null> {
  try {
    const row = await prisma.settings.findUnique({ where: { key: "alert_min_rating" } });
    const raw = row?.value?.trim().toLowerCase();
    if (raw === undefined || raw === "") return 4.0;
    if (raw === "0" || raw === "off" || raw === "none") return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 4.0;
  } catch {
    return 4.0;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const service = searchParams.get("service");
  const rating = searchParams.get("rating");
  const reviewCount = searchParams.get("reviewCount");
  const apiKey = searchParams.get("apiKey") || req.headers.get("x-api-key");
  const force = searchParams.get("force") === "1" || searchParams.get("force") === "true";

  if (branchId && service && rating) {
    return handleSync(branchId, service, rating, reviewCount || "0", apiKey || "", force);
  }

  return NextResponse.json({ active: true, syncSupported: "GET params", serverTime: new Date().toISOString() });
}

async function handleSync(branchId: string, service: string, rating: string, reviewCount: string, apiKey: string, force = false) {
  try {
    const SYNC_API_KEY = process.env.SYNC_API_KEY;
    if (!SYNC_API_KEY || apiKey !== SYNC_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ratingVal = parseFloat(rating);
    const reviewCountVal = parseInt(reviewCount) || 0;
    if (isNaN(ratingVal)) {
      return NextResponse.json({ error: "Invalid rating value" }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({ select: { id: true, name: true }, where: { id: branchId } });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Block obviously-bogus syncs (typically when Apps Script's Serper search
    // returned a different business). Admins can resend with force=1 to
    // override after they've fixed the upstream search query.
    if (!force) {
      const sanity = await checkRatingSanity(branchId, service, ratingVal, reviewCountVal);
      if (!sanity.ok) {
        console.warn(
          `rating-bridge: rejected ${service} sync for ${branch.name}: ${sanity.reason}`
        );
        return NextResponse.json(
          {
            error: "Suspicious data rejected — likely wrong place. Refine the search query (or resend with force=1).",
            type: "SANITY_REJECTED",
            reason: sanity.reason,
            previous: sanity.previous,
            received: { rating: ratingVal, reviewCount: reviewCountVal },
          },
          { status: 422 }
        );
      }
    }

    // Capture the previous rating BEFORE inserting the new one, so we can
    // detect a downward crossing of the alert threshold.
    const prevForAlert = await prisma.ratingHistory.findFirst({
      where: { branchId, service },
      orderBy: { createdAt: "desc" },
      select: { rating: true },
    });

    const record = await prisma.ratingHistory.create({
      data: { branchId, service, rating: ratingVal, reviewCount: reviewCountVal }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

    // Rating-drop alert: fire only on a downward CROSSING of the threshold
    // (previous ≥ threshold > new), so we alert once per dip instead of on
    // every sync while a branch sits below it. Fire-and-forget — never blocks
    // or fails the sync. No-op when Telegram isn't configured.
    void (async () => {
      try {
        const threshold = await getAlertThreshold();
        if (threshold === null) return;
        const prev = prevForAlert?.rating;
        const crossedDown = prev !== undefined && prev >= threshold && ratingVal < threshold;
        if (!crossedDown) return;
        const svc = service === "yandex" ? "Яндекс" : service === "2gis" ? "2ГИС" : "Google";
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let text = `📉 <b>Падение рейтинга</b>\n`;
        text += `🏢 Филиал: ${esc(branch.name)}\n`;
        text += `🗺 Платформа: ${esc(svc)}\n`;
        text += `⭐ ${prev?.toFixed(1)} → <b>${ratingVal.toFixed(1)}</b> (порог ${threshold.toFixed(1)})\n`;
        text += `💬 Отзывов: ${reviewCountVal}`;
        await sendTelegramMessage(text);
      } catch (e) {
        console.error("rating-drop alert failed:", e);
      }
    })();

    revalidatePath("/admin/branches");
    revalidatePath("/admin");
    revalidatePath("/api/branches");

    const totalRecords = await prisma.ratingHistory.count({ where: { branchId } });

    return NextResponse.json({
      status: "success",
      syncId: record.id,
      branchName: branch.name,
      service,
      rating: ratingVal,
      reviewCount: reviewCountVal,
      totalRecordsForBranch: totalRecords,
      serverTimestamp: new Date().toISOString()
    });
  } catch (err: unknown) {
    // Log details internally but never leak Prisma/SQL fragments to the
    // anonymous caller (this route is reachable without auth — see proxy.ts).
    console.error("rating-bridge sync exception:", err);
    return NextResponse.json(
      { error: "Sync failed", type: "SYNC_EXCEPTION" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key") || body.apiKey;
    const force = body.force === true || body.force === "1" || body.force === 1;
    return handleSync(body.branchId, body.service, body.rating, body.reviewCount, apiKey, force);
  } catch (err: unknown) {
    console.error("rating-bridge POST error:", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
