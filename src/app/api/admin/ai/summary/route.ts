import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAccessibleBranchIds } from "@/lib/access";
import { summarizeProblems, aiConfigured } from "@/lib/ai";

/**
 * AI summary of the top-3 recurring problems from survey comments over a
 * period (default 30 days), optionally scoped to one branch. Session-gated;
 * MANAGERs are limited to their assigned branches.
 */
export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { branchId?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body → defaults (all accessible branches, last 30 days)
  }

  const days = Number(body.days) > 0 ? Math.min(Number(body.days), 365) : 30;
  const since = new Date(Date.now() - days * 24 * 3600_000);

  const accessible = await getAccessibleBranchIds(); // null = admin (all)
  const branchId = body.branchId && body.branchId !== "all" ? body.branchId : null;

  const where: Prisma.SurveyResponseWhereInput = {
    createdAt: { gte: since },
    comment: { not: null },
  };

  if (accessible !== null) {
    // MANAGER: restrict to assigned branches, intersected with any chosen one.
    if (branchId) {
      if (!accessible.includes(branchId)) {
        return NextResponse.json({ error: "Нет доступа к этому филиалу" }, { status: 403 });
      }
      where.branchId = branchId;
    } else {
      where.branchId = { in: accessible };
    }
  } else if (branchId) {
    where.branchId = branchId;
  }

  let branchName: string | null = null;
  if (branchId) {
    const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    branchName = b?.name ?? null;
  }

  try {
    const rows = await prisma.surveyResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { comment: true },
      take: 400,
    });
    const comments = rows.map((r) => r.comment || "").filter((c) => c.trim().length > 0);

    const summary = await summarizeProblems(comments);
    return NextResponse.json({
      success: true,
      configured: aiConfigured(),
      count: comments.length,
      days,
      branchName,
      summary,
    });
  } catch (e) {
    console.error("AI summary failed:", e);
    return NextResponse.json(
      { error: "Не удалось сформировать сводку. Проверьте ключ ANTHROPIC_API_KEY и попробуйте снова." },
      { status: 502 }
    );
  }
}
