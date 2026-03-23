import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Manual rating endpoint is active. Use POST to send data." 
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

export async function POST(req: Request) {
  try {
    const { branchId, service, rating, reviewCount, apiKey } = await req.json();

    // Verify API Key for remote updates
    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";
    const isAuthorized = apiKey === SYNC_API_KEY;

    if (!isAuthorized) {
       // Also allow requests from the same origin (client-side manual edit)
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

    console.log(`Manual rating record saved for branch ${branchId}, service ${service}: ${rating}/${reviewCount}`);
    
    return NextResponse.json({ success: true, id: record.id });
  } catch (error: any) {
    console.error("Manual rating record error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
