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
        surveyResponses: {
          select: { averageScore: true }
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
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const branches = branchesRaw.map((branch) => {
      const scores = branch.surveyResponses.map((r) => r.averageScore);
      const avg =
        scores.length > 0
          ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
          : "0.0";
      // Strip the per-row response list from the response; only the average
      // is shipped to clients.
      const { surveyResponses: _drop, ...rest } = branch;
      void _drop;
      return { ...rest, averageScore: avg };
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
