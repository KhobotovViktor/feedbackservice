import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Manual rating endpoint is active. Use POST to send data."
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      const SYNC_API_KEY = process.env.SYNC_API_KEY;
      if (!SYNC_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const body = await req.clone().json();
      if (body.apiKey !== SYNC_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { branchId, service, rating, reviewCount } = await req.json();

    if (!branchId || !service || rating === undefined || reviewCount === undefined) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    if (!["yandex", "2gis", "google"].includes(service)) {
      return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    const ratingVal = parseFloat(rating);
    const reviewCountVal = parseInt(reviewCount, 10);
    if (isNaN(ratingVal) || isNaN(reviewCountVal)) {
      return NextResponse.json({ error: "Invalid rating or reviewCount" }, { status: 400 });
    }

    const record = await prisma.ratingHistory.create({
      data: {
        branchId,
        service,
        rating: ratingVal,
        reviewCount: reviewCountVal,
      }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ success: true, id: record.id });
  } catch (error: unknown) {
    console.error("Manual rating record error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
