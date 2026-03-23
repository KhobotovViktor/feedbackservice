import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ active: true, syncSupported: "GET params" });
}

async function handleSync(branchId: string, service: string, rating: string, reviewCount: string, apiKey: string) {
  try {
    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";
    if (apiKey !== SYNC_API_KEY) {
      return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    await prisma.ratingHistory.create({
      data: {
        branchId,
        service,
        rating: parseFloat(rating),
        reviewCount: parseInt(reviewCount) || 0,
      }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ success: true, updated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key") || body.apiKey;
    return handleSync(body.branchId, body.service, body.rating, body.reviewCount, apiKey);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
