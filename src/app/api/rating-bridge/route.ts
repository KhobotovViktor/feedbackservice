import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Rating Bridge is active. Send POST here." 
  });
}

export async function POST(request: Request) {
  console.log("Rating Bridge: POST arrived");
  try {
    const body = await request.json();
    const { branchId, service, rating, reviewCount, apiKey } = body;

    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";
    
    if (apiKey !== SYNC_API_KEY) {
      console.warn("Rating Bridge: Unauthorized attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!branchId || !service || rating === undefined) {
      return NextResponse.json({ error: "Incomplete data" }, { status: 400 });
    }

    const r = parseFloat(rating);
    const c = parseInt(reviewCount) || 0;

    await prisma.ratingHistory.create({
      data: {
        branchId,
        service,
        rating: r,
        reviewCount: c,
      }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

    console.log(`Rating Bridge: Updated ${branchId} (${service}): ${r}/${c}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Rating Bridge: Error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
