import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, SurveyResponse, Branch } from "@prisma/client";
import { Building2, MessageCircle, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { BranchFilter } from "@/components/results/branch-filter";
import { TypeFilter } from "@/components/results/type-filter";
import { ClearResultsButton } from "@/components/results/clear-results-button";
import { ResultsTable } from "@/components/results/results-table";
import { getAccessibleBranchIds } from "@/lib/access";

type ResponseRow = SurveyResponse & { branch: Branch | null };

const PAGE_SIZE = 25;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; type?: string; sortBy?: string; order?: string; page?: string }>;
}) {
  const { branchId, type = "all", sortBy = "date", order = "desc", page } = await searchParams;
  const sortDir: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  // Preserve the active filters/sort when building pagination links.
  const buildPageHref = (p: number): string => {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (type && type !== "all") params.set("type", type);
    if (sortBy && sortBy !== "date") params.set("sortBy", sortBy);
    if (order && order !== "desc") params.set("order", order);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  // Role scope: MANAGER sees only assigned branches; ADMIN sees all.
  const accessibleBranchIds = await getAccessibleBranchIds();

  let responses: ResponseRow[] = [];
  let branches: { id: string; name: string }[] = [];
  let total = 0;
  // Bitrix24 portal base (e.g. https://am35.bitrix24.ru) for deep-links into
  // deals/leads from the results table.
  let portalUrl = "";

  try {
    const where: Prisma.SurveyResponseWhereInput = {};
    if (branchId === "crm") {
      where.branchId = null;
      where.dealId = { not: "QR_GUEST" };
    } else if (branchId && branchId !== "all") {
      where.branchId = branchId;
    }

    if (type === "positive") where.averageScore = { gte: 4.5 };
    if (type === "negative") where.averageScore = { lt: 4.5 };

    // Enforce branch scope for managers, intersecting with any chosen filter.
    if (accessibleBranchIds !== null) {
      if (branchId === "crm") {
        // CRM/no-branch responses aren't tied to a branch — managers can't see them.
        where.branchId = { in: [] };
      } else if (typeof where.branchId === "string") {
        if (!accessibleBranchIds.includes(where.branchId)) where.branchId = { in: [] };
      } else {
        where.branchId = { in: accessibleBranchIds };
      }
    }

    // "source" sorts by the related branch name at the DB level so pagination
    // stays correct (the old in-memory sort only ordered the current page).
    const orderBy: Prisma.SurveyResponseOrderByWithRelationInput =
      sortBy === "score"
        ? { averageScore: sortDir }
        : sortBy === "responsible"
          ? { responsibleName: sortDir }
          : sortBy === "source"
            ? { branch: { name: sortDir } }
            : { createdAt: sortDir };

    const results = await Promise.all([
      prisma.surveyResponse.findMany({
        where,
        orderBy,
        include: { branch: true },
        skip: (pageNum - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.branch.findMany({
        where: accessibleBranchIds === null ? {} : { id: { in: accessibleBranchIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.settings.findUnique({ where: { key: "b24_webhook_url" } }),
      prisma.surveyResponse.count({ where }),
    ]);
    responses = results[0];
    branches = results[1];
    const webhookUrl = results[2]?.value || "";
    portalUrl = webhookUrl.replace(/\/rest\/.*$/, "");
    total = results[3];
  } catch (err) {
    console.error("Results page data fetch error:", err);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1;
  const to = Math.min(pageNum * PAGE_SIZE, total);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Результаты</h1>
          <p className="text-slate-500 text-lg font-medium">История и анализ всех полученных отзывов</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {/* Clear Results Button */}
          <ClearResultsButton />
          {/* Branch Filter */}
          <div className="flex items-center gap-2 p-1 md:p-1.5 glass rounded-2xl md:rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
            <div className="flex-1 sm:flex-none flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">Филиал:</span>
            </div>
            <div className="flex-1 sm:flex-none">
              <BranchFilter branches={branches} defaultValue={branchId || "all"} />
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 p-1 md:p-1.5 glass rounded-2xl md:rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
            <div className="flex-1 sm:flex-none flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3">
              <Filter className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">Тип:</span>
            </div>
            <div className="flex-1 sm:flex-none">
              <TypeFilter defaultValue={type} />
            </div>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="bento-card flex flex-col items-center justify-center py-40 border-dashed space-y-8">
          <div className="w-24 h-24 glass border-white/60 rounded-[2.5rem] flex items-center justify-center text-slate-300 relative">
            <MessageCircle className="w-10 h-10" />
            <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-full"></div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Результатов пока нет</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto">Как только клиенты начнут проходить опросы, их ответы мгновенно появятся здесь.</p>
          </div>
        </div>
      ) : (
        <>
          <ResultsTable responses={responses} portalUrl={portalUrl} />

          {/* Server-side pagination — preserves active filters/sort */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <p className="text-xs font-bold text-slate-400">
              Показаны {from}–{to} из {total}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {pageNum > 1 ? (
                  <Link
                    href={buildPageHref(pageNum - 1)}
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl glass border-white/50 text-slate-700 font-black text-xs hover:bg-white transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" /> Назад
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl glass border-white/50 text-slate-300 font-black text-xs opacity-50 cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" /> Назад
                  </span>
                )}
                <span className="text-xs font-black text-slate-600 px-3 whitespace-nowrap">
                  {pageNum} / {totalPages}
                </span>
                {pageNum < totalPages ? (
                  <Link
                    href={buildPageHref(pageNum + 1)}
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl glass border-white/50 text-slate-700 font-black text-xs hover:bg-white transition-all shadow-sm"
                  >
                    Вперёд <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl glass border-white/50 text-slate-300 font-black text-xs opacity-50 cursor-not-allowed">
                    Вперёд <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
