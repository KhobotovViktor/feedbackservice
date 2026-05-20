import { prisma } from "@/lib/prisma";
import type { Prisma, SurveyResponse, Branch } from "@prisma/client";
import { Building2, MessageCircle, Filter } from "lucide-react";
import { BranchFilter } from "@/components/results/branch-filter";
import { TypeFilter } from "@/components/results/type-filter";
import { ClearResultsButton } from "@/components/results/clear-results-button";
import { ResultsTable } from "@/components/results/results-table";
import { getAccessibleBranchIds } from "@/lib/access";

type ResponseRow = SurveyResponse & { branch: Branch | null };

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; type?: string; sortBy?: string; order?: string }>;
}) {
  const { branchId, type = "all", sortBy = "date", order = "desc" } = await searchParams;
  const sortDir: "asc" | "desc" = order === "asc" ? "asc" : "desc";

  // Helper to get source text
  const getSourceText = (res: ResponseRow): string => {
    const isCRM =
      res.dealId &&
      res.dealId !== "0" &&
      res.dealId !== "TEST_DEAL" &&
      res.dealId !== "QR_GUEST";
    if (res.branch?.name) {
      return `${res.branch.name} ${isCRM ? "(CRM)" : "(QR)"}`;
    }
    if (isCRM) return "Bitrix24 (CRM)";
    return "Прямая ссылка / QR";
  };

  // Role scope: MANAGER sees only assigned branches; ADMIN sees all.
  const accessibleBranchIds = await getAccessibleBranchIds();

  let responses: ResponseRow[] = [];
  let branches: { id: string; name: string }[] = [];

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

    const orderBy: Prisma.SurveyResponseOrderByWithRelationInput | undefined =
      sortBy === "date"
        ? { createdAt: sortDir }
        : sortBy === "score"
          ? { averageScore: sortDir }
          : sortBy === "responsible"
            ? { responsibleName: sortDir }
            : undefined;

    const results = await Promise.all([
      prisma.surveyResponse.findMany({
        where,
        orderBy,
        include: { branch: true },
      }),
      prisma.branch.findMany({
        where: accessibleBranchIds === null ? {} : { id: { in: accessibleBranchIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    responses = results[0];
    branches = results[1];
    
    // In-memory sort only for computed source field
    if (sortBy === "source") {
      responses.sort((a, b) => {
        const textA = getSourceText(a);
        const textB = getSourceText(b);
        return order === "asc" ? textA.localeCompare(textB) : textB.localeCompare(textA);
      });
    }
  } catch (err) {
    console.error("Results page data fetch error:", err);
  }

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

      {responses.length === 0 ? (
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
        <ResultsTable responses={responses} />
      )}
    </div>
  );
}
