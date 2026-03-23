import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Sync API is active. Use POST to send data." 
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { branchId, service, rating, reviewCount, apiKey } = data;

    // Verify API Key
    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";
    const isAuthorized = apiKey === SYNC_API_KEY;

    if (!isAuthorized) {
       const referer = req.headers.get("referer");
       if (!referer || !referer.includes(req.headers.get("host") || "")) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
       }
    }

    if (!branchId || !service || rating === undefined || reviewCount === undefined) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Save to RatingHistory
    const record = await prisma.ratingHistory.create({
      data: {
        branchId,
        service,
        rating: parseFloat(rating),
        reviewCount: parseInt(reviewCount),
      }
    });

    // Update branch updatedAt
    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ success: true, id: record.id });
  } catch (error: any) {
    console.error("Sync API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
