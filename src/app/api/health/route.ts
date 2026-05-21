import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Lightweight liveness/readiness probe for external uptime monitoring
// (UptimeRobot etc.). Public + cheap: confirms the process is up and the DB
// connection works. Returns 503 if the DB is unreachable so the monitor alerts.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
