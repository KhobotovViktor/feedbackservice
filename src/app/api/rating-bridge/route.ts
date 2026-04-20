import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const service = searchParams.get("service");
  const rating = searchParams.get("rating");
  const reviewCount = searchParams.get("reviewCount");
  const apiKey = searchParams.get("apiKey") || req.headers.get("x-api-key");

  if (branchId && service && rating) {
    return handleSync(branchId, service, rating, reviewCount || "0", apiKey || "");
  }

  return NextResponse.json({ active: true, syncSupported: "GET params", serverTime: new Date().toISOString() });
}

async function handleSync(branchId: string, service: string, rating: string, reviewCount: string, apiKey: string) {
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

    const record = await prisma.ratingHistory.create({
      data: { branchId, service, rating: ratingVal, reviewCount: reviewCountVal }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, type: "SYNC_EXCEPTION" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key") || body.apiKey;
    return handleSync(body.branchId, body.service, body.rating, body.reviewCount, apiKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
