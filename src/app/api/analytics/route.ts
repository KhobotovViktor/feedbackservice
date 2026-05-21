import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set(["VIEW", "CLICK"]);
const ALLOWED_TARGETS = new Set(["YANDEX", "2GIS", "GOOGLE"]);

// Short, index-friendly hash of the (long) survey JWT for the dedupe key.
function shortHash(s: string): string {
  return createHash("sha256").update(s).digest("base64url").slice(0, 22);
}

export async function POST(req: NextRequest) {
  // Anti-abuse: cap analytics writes per IP. A real visitor fires ~1 VIEW plus
  // a few CLICKs; only a bot would approach this.
  const ip = getClientIp(req);
  if (!rateLimit(`an:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { type, target, branchId, token } = body;

    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (target && !ALLOWED_TARGETS.has(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    // Unique counting: one VIEW per survey token, one CLICK per token+target.
    // Reloads/returns to the same survey link no longer inflate the funnel.
    // Events without a token (legacy callers) keep the always-insert behaviour.
    let dedupeKey: string | null = null;
    if (typeof token === "string" && token) {
      const h = shortHash(token);
      if (type === "VIEW") dedupeKey = `v:${h}`;
      else if (type === "CLICK" && target) dedupeKey = `c:${h}:${target}`;
    }

    const base = { type, target: target ?? null };
    // branchId is untrusted (public endpoint). A stale/unknown id trips the FK
    // (P2003) and would 500; retry once without the branch so the event is
    // still recorded.
    const write = (withBranch: boolean) => {
      const data = { ...base, branchId: withBranch ? branchId ?? null : null };
      if (dedupeKey) {
        // upsert collapses duplicates: the first event wins, repeats no-op.
        return prisma.analyticsEvent.upsert({
          where: { dedupeKey },
          create: { ...data, dedupeKey },
          update: {},
        });
      }
      return prisma.analyticsEvent.create({ data });
    };

    let event;
    try {
      event = await write(true);
    } catch (e) {
      if ((e as { code?: string } | null)?.code === "P2003") {
        event = await write(false);
      } else {
        throw e;
      }
    }

    return NextResponse.json({ success: true, id: event.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to record analytics event" }, { status: 500 });
  }
}
