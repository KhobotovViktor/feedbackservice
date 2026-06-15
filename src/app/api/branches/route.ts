import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const branchesRaw = await prisma.branch.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        city: true,
        yandexUrl: true,
        dgisUrl: true,
        googleUrl: true,
        googleSearchQuery: true,
        externalId: true,
        templateId: true,
        createdAt: true,
        _count: {
          select: { surveyResponses: true }
        },
        template: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { questions: true }
            }
          }
        },
        ratingHistory: {
          orderBy: { createdAt: "desc" },
          // Only the fields the branches chart actually plots — don't ship the
          // id/branchId of every history row.
          select: { service: true, rating: true, reviewCount: true, createdAt: true },
        }
      }
    });

    // Per-branch average computed in the DB, instead of shipping every response
    // row (thousands) to the server just to average them in JS.
    const avgRows = await prisma.surveyResponse.groupBy({
      by: ["branchId"],
      _avg: { averageScore: true },
    });
    const avgByBranch = new Map(
      avgRows.map((r) => [r.branchId, r._avg.averageScore])
    );

    const branches = branchesRaw.map((branch) => {
      const a = avgByBranch.get(branch.id);
      const avg = typeof a === "number" ? a.toFixed(1) : "0.0";
      return { ...branch, averageScore: avg };
    });

    return NextResponse.json({ 
      branches, 
      _serverTime: new Date().toISOString(),
      _count: branches.length
    });
  } catch (error: unknown) {
    console.error("FETCH_BRANCHES_ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

const REVIEW_STRATEGIES = ["ALL", "FEWER_REVIEWS", "LOWER_RATING"] as const;
type ReviewStrategy = (typeof REVIEW_STRATEGIES)[number];
function normStrategy(v: unknown): ReviewStrategy {
  return REVIEW_STRATEGIES.includes(v as ReviewStrategy) ? (v as ReviewStrategy) : "ALL";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, city, yandexUrl, dgisUrl, googleUrl, googleSearchQuery, externalId, templateId, reviewStrategy } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // The form sends "" for unselected optional fields. For templateId that's
    // fatal — Prisma treats "" as a real FK value and the create fails with
    // P2003 (Branch_templateId_fkey) because no template has an empty id.
    // Coerce blanks to null so "no template / no external id" works.
    // (PATCH already did this; POST didn't, hence the 500 on first create.)
    const branch = await prisma.branch.create({
      data: {
        name,
        city: city || null,
        yandexUrl: yandexUrl || null,
        dgisUrl: dgisUrl || null,
        googleUrl: googleUrl || null,
        googleSearchQuery: googleSearchQuery || null,
        externalId: externalId || null,
        templateId: templateId || null,
        reviewStrategy: normStrategy(reviewStrategy),
      },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
