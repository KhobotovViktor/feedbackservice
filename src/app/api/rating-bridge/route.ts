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
      return NextResponse.json({ error: "Auth failed", debug: "Key mismatch" }, { status: 401 });
    }

    const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const branchExists = branches.find(b => b.id === branchId);

    if (!branchExists) {
      return NextResponse.json({ 
        error: "Branch not found", 
        idRequested: branchId,
        availableIds: branches.map(b => b.id)
      }, { status: 404 });
    }

    const record = await prisma.ratingHistory.create({
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

    const allRatings = await prisma.ratingHistory.count();
    const dbUrl = process.env.DATABASE_URL || "not set";
    const maskedUrl = dbUrl.substring(0, 25) + "...";

    return NextResponse.json({ 
      success: true, 
      updated: true, 
      branch: branchExists.name,
      id: record.id,
      totalRatingsInDb: allRatings,
      dbInfo: maskedUrl,
      received: { branchId, service, rating, reviewCount }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
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
