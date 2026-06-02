import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, SurveyResponse, Branch } from "@prisma/client";
import { Building2, MessageCircle, Filter, ChevronLeft, ChevronRight, Download, Tag, AlertCircle, Clock, CheckCircle2, UserCheck } from "lucide-react";
import { BranchFilter } from "@/components/results/branch-filter";
import { TypeFilter } from "@/components/results/type-filter";
import { TagFilter } from "@/components/results/tag-filter";
import { ComplaintFilter } from "@/components/results/complaint-filter";
import { ResponsibleFilter } from "@/components/results/responsible-filter";
import { ClearResultsButton } from "@/components/results/clear-results-button";
import { ResultsTable } from "@/components/results/results-table";
import { getAccessibleBranchIds } from "@/lib/access";

type ResponseRow = SurveyResponse & { branch: Branch | null };

const PAGE_SIZE = 25;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; type?: string; tag?: string; complaint?: string; responsible?: string; sortBy?: string; order?: string; page?: string }>;
}) {
  const { branchId, type = "all", tag = "all", complaint = "all", responsible = "all", sortBy = "date", order = "desc", page } = await searchParams;
  const sortDir: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  // Preserve the active filters/sort when building pagination links.
  const buildPageHref = (p: number): string => {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (type && type !== "all") params.set("type", type);
    if (tag && tag !== "all") params.set("tag", tag);
    if (complaint && complaint !== "all") params.set("complaint", complaint);
    if (responsible && responsible !== "all") params.set("responsible", responsible);
    if (sortBy && sortBy !== "date") params.set("sortBy", sortBy);
    if (order && order !== "desc") params.set("order", order);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  // CSV export keeps the active branch/type/tag/responsible filters.
  const exportParams = new URLSearchParams();
  if (branchId) exportParams.set("branchId", branchId);
  if (type && type !== "all") exportParams.set("type", type);
  if (tag && tag !== "all") exportParams.set("tag", tag);
  if (responsible && responsible !== "all") exportParams.set("responsible", responsible);
  const exportHref = `/api/admin/results/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  // Role scope: MANAGER sees only assigned branches; ADMIN sees all.
  const accessibleBranchIds = await getAccessibleBranchIds();

  let responses: ResponseRow[] = [];
  let branches: { id: string; name: string }[] = [];
  // List of distinct responsibleName values within the current branch scope —
  // feeds the «Ответственный» filter dropdown. Nulls/empty are stripped here
  // and surfaced as a special "Без ответственного" option in the filter UI.
  let responsibles: string[] = [];
  let total = 0;
  // Bitrix24 portal base (e.g. https://am35.bitrix24.ru) for deep-links into
  // deals/leads from the results table.
  let portalUrl = "";
  // Complaint KPI counts across the current branch scope (independent of the
  // type/tag/complaint filters, so the summary shows the full picture).
  const complaintCounts = { NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  // questionId → question text — lets the table render per-question scores
  // ("Качество: 5, Поддержка: 5") instead of just the average.
  const questionMap: Record<string, string> = {};
  // dispatch dedupe-key → { createdAt, surveyUrl } — lets the table show
  // how long it took the customer to fill the survey out, and the actual
  // /s/<code> link that was sent.
  const sentMap: Record<string, { createdAt: string; surveyUrl: string | null }> = {};

  try {
    // Branch scope (role + chosen branch filter), kept separate so the KPI
    // counts can reuse it without the type/tag/complaint filters.
    const scopeWhere: Prisma.SurveyResponseWhereInput = {};
    if (branchId === "crm") {
      scopeWhere.branchId = null;
      scopeWhere.dealId = { not: "QR_GUEST" };
    } else if (branchId && branchId !== "all") {
      scopeWhere.branchId = branchId;
    }
    // Enforce branch scope for managers, intersecting with any chosen filter.
    if (accessibleBranchIds !== null) {
      if (branchId === "crm") {
        // CRM/no-branch responses aren't tied to a branch — managers can't see them.
        scopeWhere.branchId = { in: [] };
      } else if (typeof scopeWhere.branchId === "string") {
        if (!accessibleBranchIds.includes(scopeWhere.branchId)) scopeWhere.branchId = { in: [] };
      } else {
        scopeWhere.branchId = { in: accessibleBranchIds };
      }
    }

    const where: Prisma.SurveyResponseWhereInput = { ...scopeWhere };
    if (type === "positive") where.averageScore = { gte: 4.5 };
    if (type === "negative") where.averageScore = { lt: 4.5 };
    if (tag && tag !== "all") where.tags = { has: tag };
    if (complaint === "open") where.complaintStatus = { in: ["NEW", "IN_PROGRESS"] };
    else if (complaint === "new") where.complaintStatus = "NEW";
    else if (complaint === "in_progress") where.complaintStatus = "IN_PROGRESS";
    else if (complaint === "resolved") where.complaintStatus = "RESOLVED";

    // «Ответственный» filter. "__none__" → only rows without a responsible
    // (null or empty string), any other non-"all" value → exact match.
    if (responsible === "__none__") {
      where.OR = [{ responsibleName: null }, { responsibleName: "" }];
    } else if (responsible && responsible !== "all") {
      where.responsibleName = responsible;
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
      prisma.surveyResponse.groupBy({
        by: ["complaintStatus"],
        where: { ...scopeWhere, complaintStatus: { not: null } },
        _count: { _all: true },
      }),
      // Whole question catalogue — used to label per-question answers in the
      // expandable details. The table currently shows ≤25 rows and we don't
      // know which templates they belong to (responses don't carry the
      // template id), so a single sweep is simpler than per-row lookups.
      prisma.question.findMany({ select: { id: true, text: true } }),
      // Distinct list of responsibleName values inside the branch scope —
      // independent of the other filters so the dropdown stays usable when
      // the user drills down. Nulls/empties are dropped client-side.
      prisma.surveyResponse.findMany({
        where: { ...scopeWhere, responsibleName: { not: null } },
        select: { responsibleName: true },
        distinct: ["responsibleName"],
        orderBy: { responsibleName: "asc" },
      }),
    ]);
    responses = results[0];
    branches = results[1];
    const webhookUrl = results[2]?.value || "";
    portalUrl = webhookUrl.replace(/\/rest\/.*$/, "");
    total = results[3];
    for (const row of results[4]) {
      const s = row.complaintStatus;
      if (s === "NEW" || s === "IN_PROGRESS" || s === "RESOLVED") {
        complaintCounts[s] = row._count._all;
      }
    }
    for (const q of results[5]) questionMap[q.id] = q.text;
    responsibles = results[6]
      .map((r) => r.responsibleName)
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0);

    // Pull dispatch rows for the visible responses so the table can show
    // (a) "Открыто через …" delay between robot fire and submission, and
    // (b) the actual /s/<code> link that was sent. dedupe key in SentSurvey
    // is "lead:<id>" for leads, plain "<id>" for deals — mirror that.
    const dispatchKeys = responses.map((r) =>
      r.entityType === "lead" ? `lead:${r.dealId}` : r.dealId
    );
    if (dispatchKeys.length > 0) {
      const sentRows = await prisma.sentSurvey.findMany({
        where: { dealId: { in: dispatchKeys } },
        select: { dealId: true, createdAt: true, surveyUrl: true },
      });
      for (const s of sentRows) {
        sentMap[s.dealId] = {
          createdAt: s.createdAt.toISOString(),
          surveyUrl: s.surveyUrl,
        };
      }
    }
  } catch (err) {
    console.error("Results page data fetch error:", err);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1;
  const to = Math.min(pageNum * PAGE_SIZE, total);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
      <div className="flex flex-col xl:flex-row gap-6 xl:items-end xl:justify-between">
        <div className="text-center xl:text-left space-y-1 shrink-0">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Результаты</h1>
          <p className="text-slate-500 text-lg font-medium">История и анализ всех полученных отзывов</p>
        </div>

        {/* Filter bar — wraps onto multiple lines so a long row of filters
            never overflows the viewport on intermediate widths. Aligned to
            the right on xl+ and centred otherwise. */}
        <div className="flex flex-wrap items-center justify-center xl:justify-end gap-3 sm:gap-4 w-full xl:w-auto">
          {/* Clear Results Button */}
          <ClearResultsButton />
          {/* CSV export (respects current filters) */}
          <a
            href={exportHref}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl glass border-white/50 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-sm shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-500" /> Экспорт
          </a>
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

          {/* Tag Filter (AI themes) */}
          <div className="flex items-center gap-2 p-1 md:p-1.5 glass rounded-2xl md:rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
            <div className="flex-1 sm:flex-none flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3">
              <Tag className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">Тема:</span>
            </div>
            <div className="flex-1 sm:flex-none">
              <TagFilter defaultValue={tag} />
            </div>
          </div>

          {/* Complaint Status Filter */}
          <div className="flex items-center gap-2 p-1 md:p-1.5 glass rounded-2xl md:rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
            <div className="flex-1 sm:flex-none flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">Жалоба:</span>
            </div>
            <div className="flex-1 sm:flex-none">
              <ComplaintFilter defaultValue={complaint} />
            </div>
          </div>

          {/* Responsible Filter */}
          <div className="flex items-center gap-2 p-1 md:p-1.5 glass rounded-2xl md:rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
            <div className="flex-1 sm:flex-none flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3">
              <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">{"Ответственный:"}</span>
            </div>
            <div className="flex-1 sm:flex-none">
              <ResponsibleFilter options={responsibles} defaultValue={responsible} />
            </div>
          </div>
        </div>
      </div>

      {/* Complaint KPI summary (full picture for the current branch scope) */}
      {(complaintCounts.NEW + complaintCounts.IN_PROGRESS + complaintCounts.RESOLVED) > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="glass border-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{complaintCounts.NEW}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Новые жалобы</p>
            </div>
          </div>
          <div className="glass border-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{complaintCounts.IN_PROGRESS}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">В работе</p>
            </div>
          </div>
          <div className="glass border-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{complaintCounts.RESOLVED}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Решено</p>
            </div>
          </div>
        </div>
      )}

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
          <ResultsTable responses={responses} portalUrl={portalUrl} questionMap={questionMap} sentMap={sentMap} />

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
