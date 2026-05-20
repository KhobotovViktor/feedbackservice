import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBranchRatings } from "@/lib/rating-fetcher";
import { getSession } from "@/lib/auth";

/**
 * Rating scrape trigger. Two callers:
 *   - an admin clicking through from the panel (session cookie), and
 *   - a system cron on the VM (no session — uses SYNC_API_KEY).
 *
 * This route is exempted from proxy.ts's session gate (exact-path match in
 * the public allowlist), so the auth check below is the ONLY gate. Both GET
 * and POST must enforce it — the scrape loops every branch and hits external
 * sites, so an unauthenticated trigger would be a free DoS lever.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = await getSession();
  if (session) return true;

  const KEY = process.env.SYNC_API_KEY;
  if (!KEY) return false;
  const provided =
    req.headers.get("x-api-key") ||
    new URL(req.url).searchParams.get("apiKey");
  return provided === KEY;
}

async function runSync(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (branchId) {
      const results = await syncBranchRatings(branchId);
      return NextResponse.json({ success: true, results });
    }

    const branches = await prisma.branch.findMany({
      select: { id: true },
    });

    const results = [];
    for (const branch of branches) {
      const res = await syncBranchRatings(branch.id);
      results.push({ branchId: branch.id, res });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runSync(req);
}

export async function POST(req: NextRequest) {
  return runSync(req);
}
