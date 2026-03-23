import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ active: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key");
    const SYNC_API_KEY = process.env.SYNC_API_KEY || "alleya-default-key-123";

    if (apiKey !== SYNC_API_KEY && body.apiKey !== SYNC_API_KEY) {
      return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    const { branchId, service, rating, reviewCount } = body;
    
    if (!branchId || !service) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
