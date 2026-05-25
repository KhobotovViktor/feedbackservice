import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REVIEW_STRATEGIES = ["ALL", "FEWER_REVIEWS", "LOWER_RATING"] as const;
type ReviewStrategy = (typeof REVIEW_STRATEGIES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, city, yandexUrl, dgisUrl, googleUrl, googleSearchQuery, externalId, templateId, reviewStrategy } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name,
        city,
        yandexUrl,
        dgisUrl,
        googleUrl,
        // PATCH semantics: only touch the field when the caller actually
        // sent it. Otherwise we'd nuke the auto-populated CID URL whenever
        // someone saves an unrelated edit through an older form payload.
        ...(googleSearchQuery !== undefined ? { googleSearchQuery } : {}),
        externalId,
        templateId: templateId || null,
        ...(REVIEW_STRATEGIES.includes(reviewStrategy as ReviewStrategy)
          ? { reviewStrategy: reviewStrategy as ReviewStrategy }
          : {}),
      },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.branch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
