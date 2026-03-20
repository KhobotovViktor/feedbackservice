import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBranchRatings } from "@/lib/rating-fetcher";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (branchId) {
      const results = await syncBranchRatings(branchId);
      return NextResponse.json({ success: true, results });
    }

    const branches = await prisma.branch.findMany({
      select: { id: true }
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

export async function POST(req: NextRequest) {
    return GET(req);
}
