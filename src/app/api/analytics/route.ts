import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set(["VIEW", "CLICK"]);
const ALLOWED_TARGETS = new Set(["YANDEX", "2GIS", "GOOGLE"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, target, branchId } = body;

    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (target && !ALLOWED_TARGETS.has(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    // This endpoint is public (survey page posts VIEW/CLICK), so branchId is
    // untrusted. A stale/unknown id would trip the FK constraint (P2003) and
    // turn into a 500; instead, retry once without the branch so we still
    // record the event rather than dropping it.
    let event;
    try {
      event = await prisma.analyticsEvent.create({
        data: { type, target: target ?? null, branchId: branchId ?? null },
      });
    } catch (e) {
      if ((e as { code?: string } | null)?.code === "P2003") {
        event = await prisma.analyticsEvent.create({
          data: { type, target: target ?? null, branchId: null },
        });
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
