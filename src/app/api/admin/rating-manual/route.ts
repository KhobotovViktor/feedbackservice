import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { branchId, service, rating, reviewCount } = await req.json();

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

    console.log(`Manual rating record saved for branch ${branchId}, service ${service}: ${rating}/${reviewCount}`);
    
    return NextResponse.json({ success: true, id: record.id });
  } catch (error: any) {
    console.error("Manual rating record error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
