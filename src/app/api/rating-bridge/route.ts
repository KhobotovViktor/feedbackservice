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
    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";
    if (apiKey !== SYNC_API_KEY) {
      return NextResponse.json({ error: "Auth failed", debug: "Key mismatch", receivedKey: apiKey ? "provided" : "none" }, { status: 401 });
    }

    const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const branchExists = branches.find(b => b.id === branchId);

    if (!branchExists) {
      return NextResponse.json({ 
        error: "Branch not found", 
        idRequested: branchId,
        availableBranches: branches.map(b => `${b.name} (${b.id})`)
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

    // Revalidate paths to clear Next.js cache
    revalidatePath("/admin/branches");
    revalidatePath("/admin");
    revalidatePath("/api/branches");

    const allRatings = await prisma.ratingHistory.count({ where: { branchId } });
    
    return NextResponse.json({ 
      status: "success",
      syncId: record.id,
      branchName: branchExists.name,
      service,
      rating: parseFloat(rating),
      reviewCount: parseInt(reviewCount) || 0,
      totalRecordsForBranch: allRatings,
      serverTimestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, type: "SYNC_EXCEPTION" }, { status: 500 });
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
