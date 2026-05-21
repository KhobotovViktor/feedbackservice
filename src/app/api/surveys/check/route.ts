import { NextRequest, NextResponse } from "next/server";
import { verifySurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = await verifySurveyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Недействительная ссылка" }, { status: 401 });
  }

  const { clientId, branchId, isTest, templateId, entityType } = payload;

  // ── "Pick your city" step (CRM links only) ──────────────────────────────
  // For CRM-originated links (deal/lead) we may ask the client to choose a
  // city first; the attached branch then drives the whole survey. Active when
  // the scenario is enabled (or always, in test mode) AND at least one city is
  // configured. If the client hasn't chosen yet we return the city list; once
  // chosen (?cityId=…) the city's branch overrides the token's branch. QR and
  // direct links are unaffected (entityType is null for them).
  const cityId = searchParams.get("cityId");
  const isCrmLink = entityType === "deal" || entityType === "lead";
  let effectiveBranchId: string | null = branchId || null;

  if (isCrmLink) {
    const enabled =
      (await prisma.settings.findUnique({ where: { key: "city_selection_enabled" } }))
        ?.value === "true";
    if (enabled || isTest) {
      const cities = await prisma.city.findMany({
        where: { branchId: { not: null } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      if (cities.length > 0) {
        if (!cityId) {
          // Client must pick a city before we know which branch to use.
          return NextResponse.json({
            success: true,
            needCity: true,
            cities,
            isTest: Boolean(isTest),
          });
        }
        const city = await prisma.city.findUnique({ where: { id: cityId } });
        if (!city || !city.branchId) {
          return NextResponse.json({ error: "Город не найден" }, { status: 400 });
        }
        effectiveBranchId = city.branchId;
      }
    }
  }

  // We only return a narrow projection of the branch to the survey page —
  // declare it once and keep the rest of this handler within that shape.
  type Question = { id: string; text: string; order: number };
  type Template = { id: string; name: string; questions: Question[] };
  type BranchInfo = {
    id?: string;
    yandexUrl?: string | null;
    dgisUrl?: string | null;
    googleUrl?: string | null;
    template: Template | null;
  };

  let branchInfo: BranchInfo | null = null;
  // Which review platform to highlight for a happy customer (balancing). Maps
  // to the survey's reviewLinks keys: "yandex" | "dgis" | "google" | null.
  let recommendedService: "yandex" | "dgis" | "google" | null = null;
  if (effectiveBranchId) {
    const b = await prisma.branch.findUnique({
      where: { id: effectiveBranchId },
      include: {
        template: {
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (b) {
      branchInfo = {
        id: b.id,
        yandexUrl: b.yandexUrl,
        dgisUrl: b.dgisUrl,
        googleUrl: b.googleUrl,
        template: b.template
          ? { id: b.template.id, name: b.template.name, questions: b.template.questions }
          : null,
      };

      // Balancing: pick the platform that needs help most, among those that
      // have a configured URL, using the latest scraped rating/review count.
      if (b.reviewStrategy !== "ALL") {
        const SERVICES = [
          { svc: "yandex" as const, dbKey: "yandex", url: b.yandexUrl },
          { svc: "dgis" as const, dbKey: "2gis", url: b.dgisUrl },
          { svc: "google" as const, dbKey: "google", url: b.googleUrl },
        ].filter((s) => s.url);

        if (SERVICES.length > 0) {
          const history = await prisma.ratingHistory.findMany({
            where: { branchId: b.id },
            orderBy: { createdAt: "desc" },
          });
          // Latest record per service.
          const latest: Record<string, { rating: number; reviewCount: number }> = {};
          for (const h of history) {
            if (!latest[h.service]) latest[h.service] = { rating: h.rating, reviewCount: h.reviewCount };
          }
          const metric = (dbKey: string) => {
            const rec = latest[dbKey];
            // Platforms with no data yet sort first (most "needs help") so we
            // start collecting reviews there.
            if (!rec) return -1;
            return b.reviewStrategy === "FEWER_REVIEWS" ? rec.reviewCount : rec.rating;
          };
          recommendedService = SERVICES.reduce((best, s) =>
            metric(s.dbKey) < metric(best.dbKey) ? s : best
          ).svc;
        }
      }
    }
  }

  // If no branch template, but templateId is in token (e.g. from B24 setting)
  if ((!branchInfo || !branchInfo.template) && templateId) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: templateId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (template) {
      const tpl: Template = {
        id: template.id,
        name: template.name,
        questions: template.questions,
      };
      if (!branchInfo) {
        branchInfo = { template: tpl };
      } else {
        branchInfo.template = tpl;
      }
    }
  }

  // Skip frequency check for tests
  if (isTest) {
    return NextResponse.json({
      success: true,
      branchId: effectiveBranchId,
      branch: branchInfo || null,
      recommendedService,
      isTest: true
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentSurvey = await prisma.surveyResponse.findFirst({
    where: {
      clientId,
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
  });

  if (recentSurvey) {
    return NextResponse.json(
      { error: "Вы уже проходили опрос в последние 6 месяцев. Спасибо!" },
      { status: 429 }
    );
  }

  return NextResponse.json({
    success: true,
    branchId: effectiveBranchId,
    branch: branchInfo || null,
    recommendedService,
  });
}
