import { NextRequest, NextResponse } from "next/server";
import { verifySurveyToken } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`ck:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = await verifySurveyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Недействительная ссылка" }, { status: 401 });
  }

  const { clientId, branchId, isTest, templateId, entityType, citySelect } = payload;

  // ── "Pick your city" step ───────────────────────────────────────────────
  // Two token kinds get it. CRM-originated links (deal/lead) ask when the
  // scenario toggle is enabled (or always, in test mode). Permanent-link
  // tokens (citySelect, minted by /survey/city for stories embeds) always ask
  // — the city step is the link's whole purpose, so the CRM toggle doesn't
  // apply. Either way it needs at least one configured city. If the client
  // hasn't chosen yet we return the city list; once chosen (?cityId=…) the
  // city's branch overrides the token's branch. QR and direct links are
  // unaffected (no entityType, no citySelect).
  const cityId = searchParams.get("cityId");
  const isCrmLink = entityType === "deal" || entityType === "lead";
  let effectiveBranchId: string | null = branchId || null;

  let askCity = citySelect === true;
  if (!askCity && isCrmLink) {
    const enabled =
      (await prisma.settings.findUnique({ where: { key: "city_selection_enabled" } }))
        ?.value === "true";
    askCity = enabled || Boolean(isTest);
  }

  if (askCity) {
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

  // We only return a narrow projection of the branch to the survey page —
  // declare it once and keep the rest of this handler within that shape.
  type Question = { id: string; text: string; order: number; type: string; options: string[]; showIf: string | null };
  type Template = {
    id: string;
    name: string;
    minScore: number;
    questions: Question[];
    startTitle: string | null;
    startSubtitle: string | null;
    lowTitle: string | null;
    lowSubtitle: string | null;
    commentPlaceholder: string | null;
    successTitle: string | null;
    successPositive: string | null;
    successNegative: string | null;
    reviewPrompt: string | null;
    surveyFrequencyHours: number;
  };
  type BranchInfo = {
    id?: string;
    yandexUrl?: string | null;
    dgisUrl?: string | null;
    googleUrl?: string | null;
    template: Template | null;
  };
  // Project a full Prisma template into the narrow Template shape above.
  const projectTemplate = (t: {
    id: string; name: string; minScore: number; questions: Question[];
    startTitle: string | null; startSubtitle: string | null;
    lowTitle: string | null; lowSubtitle: string | null;
    commentPlaceholder: string | null; successTitle: string | null;
    successPositive: string | null; successNegative: string | null;
    reviewPrompt: string | null; surveyFrequencyHours: number;
  }): Template => ({
    id: t.id, name: t.name, minScore: t.minScore, questions: t.questions,
    startTitle: t.startTitle, startSubtitle: t.startSubtitle,
    lowTitle: t.lowTitle, lowSubtitle: t.lowSubtitle,
    commentPlaceholder: t.commentPlaceholder, successTitle: t.successTitle,
    successPositive: t.successPositive, successNegative: t.successNegative,
    reviewPrompt: t.reviewPrompt, surveyFrequencyHours: t.surveyFrequencyHours,
  });

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
        template: b.template ? projectTemplate(b.template) : null,
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
      const tpl: Template = projectTemplate(template);
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

  // Retake frequency comes from the template (0 = unlimited). No template →
  // unlimited (other guards still apply: unique dealId, per-token device lock).
  const freqHours = branchInfo?.template?.surveyFrequencyHours ?? 0;
  if (freqHours > 0) {
    const cutoff = new Date(Date.now() - freqHours * 3600_000);
    const recentSurvey = await prisma.surveyResponse.findFirst({
      where: { clientId, createdAt: { gte: cutoff } },
    });
    if (recentSurvey) {
      return NextResponse.json(
        { error: "Вы недавно уже проходили опрос. Спасибо!" },
        { status: 429 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    branchId: effectiveBranchId,
    branch: branchInfo || null,
    recommendedService,
  });
}
