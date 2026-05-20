import { prisma } from "@/lib/prisma";
import type { Prisma, Branch, RatingHistory, SurveyResponse } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { Star, MessageSquare, Users, TrendingUp, Eye, MousePointer2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverallMonitoring } from "@/components/dashboard/overall-monitoring";
import { PeriodFilter } from "@/components/dashboard/period-filter";

interface BentoCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  desc: string;
  className?: string;
}

function BentoMetricCard({ label, value, icon: Icon, color, bg, desc, className }: BentoCardProps) {
  return (
    <div className={`bento-card flex flex-col justify-between group h-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 leading-tight tracking-tighter">{value}</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period, from, to } = (await searchParams) || {};

  const safeDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  type DateFilter = Prisma.DateTimeFilter;
  let dateFilter: DateFilter = {};
  if (period === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    dateFilter = { gte: d };
  } else if (period === "custom") {
    const fromDate = safeDate(from);
    const toDate = safeDate(to);
    if (fromDate || toDate) {
      dateFilter = {};
      if (fromDate) dateFilter.gte = fromDate;
      if (toDate) dateFilter.lte = toDate;
    }
  }

  const whereWithDate: { createdAt?: DateFilter } =
    Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  // Fetch Previous Period for Trends
  let prevDateFilter: DateFilter = {};
  if (period === "30d") {
    const startOfPrev30 = new Date();
    startOfPrev30.setDate(startOfPrev30.getDate() - 60);
    const endOfPrev30 = new Date();
    endOfPrev30.setDate(endOfPrev30.getDate() - 30);
    prevDateFilter = { gte: startOfPrev30, lt: endOfPrev30 };
  } else if (period === "custom") {
    const fromDate = safeDate(from);
    const toDate = safeDate(to);
    if (fromDate && toDate) {
      const diff = toDate.getTime() - fromDate.getTime();
      prevDateFilter = {
        gte: new Date(fromDate.getTime() - diff),
        lt: fromDate,
      };
    }
  }

  type BranchRow = Branch & {
    surveyResponses: Pick<SurveyResponse, "averageScore">[];
    ratingHistory: RatingHistory[];
  };

  let totalResponses = 0;
  let totalViews = 0;
  let totalClicks = 0;
  let negativeResponses = 0;
  let branchesRaw: BranchRow[] = [];
  let prevResponsesCount = 0;
  // Network-wide average over ALL responses (including CRM/QR ones with no
  // branchId). The old code averaged only branch-attached responses, which
  // undercounted whenever surveys came through Bitrix24 without a branch.
  let networkAvg = 0;
  // Average over only CRM-originated responses — i.e. surveys dispatched via
  // the Bitrix24 webhook (dealId/leadId), excluding QR scans (dealId "QR_…")
  // and local tests (dealId "TEST…").
  let crmAvg = 0;
  let crmCount = 0;
  // Click breakdown per review service (YANDEX / 2GIS / GOOGLE).
  const clicksByTarget: Record<string, number> = { YANDEX: 0, "2GIS": 0, GOOGLE: 0 };
  // Per-branch analytics for the "По филиалам" block.
  type BranchAnalytics = {
    views: number;
    clicks: number;
    clicksByTarget: Record<string, number>;
  };
  const perBranch: Record<string, BranchAnalytics> = {};
  const branchA = (id: string): BranchAnalytics => {
    if (!perBranch[id]) {
      perBranch[id] = { views: 0, clicks: 0, clicksByTarget: { YANDEX: 0, "2GIS": 0, GOOGLE: 0 } };
    }
    return perBranch[id];
  };

  try {
    const results = await Promise.all([
      prisma.surveyResponse.count({ where: whereWithDate }),
      prisma.analyticsEvent.count({ where: { ...whereWithDate, type: "VIEW" } }),
      prisma.analyticsEvent.count({ where: { ...whereWithDate, type: "CLICK" } }),
      prisma.surveyResponse.count({
        where: { ...whereWithDate, averageScore: { lt: 4.5 } },
      }),
      prisma.branch.findMany({
        include: {
          surveyResponses: {
            where: whereWithDate,
            select: { averageScore: true },
          },
          ratingHistory: {
            where: whereWithDate,
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      Object.keys(prevDateFilter).length > 0
        ? prisma.surveyResponse.count({ where: { createdAt: prevDateFilter } })
        : Promise.resolve(0),
      // Network-wide average across every response in the period.
      prisma.surveyResponse.aggregate({
        where: whereWithDate,
        _avg: { averageScore: true },
      }),
      // CLICK events grouped by which map service was opened.
      prisma.analyticsEvent.groupBy({
        by: ["target"],
        where: { ...whereWithDate, type: "CLICK" },
        _count: { _all: true },
      }),
      // CRM-only average: responses whose dealId is a real Bitrix24 id —
      // exclude QR scans ("QR_…") and local tests ("TEST…").
      prisma.surveyResponse.aggregate({
        where: {
          ...whereWithDate,
          NOT: [
            { dealId: { startsWith: "QR" } },
            { dealId: { startsWith: "TEST" } },
          ],
        },
        _avg: { averageScore: true },
        _count: { _all: true },
      }),
      // Per-branch VIEW / CLICK totals.
      prisma.analyticsEvent.groupBy({
        by: ["branchId", "type"],
        where: { ...whereWithDate, branchId: { not: null } },
        _count: { _all: true },
      }),
      // Per-branch CLICK totals split by map service.
      prisma.analyticsEvent.groupBy({
        by: ["branchId", "target"],
        where: { ...whereWithDate, type: "CLICK", branchId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    totalResponses = results[0];
    totalViews = results[1];
    totalClicks = results[2];
    negativeResponses = results[3];
    branchesRaw = results[4];
    prevResponsesCount = results[5];
    networkAvg = results[6]._avg.averageScore ?? 0;
    for (const row of results[7]) {
      if (row.target && row.target in clicksByTarget) {
        clicksByTarget[row.target] = row._count._all;
      }
    }
    crmAvg = results[8]._avg.averageScore ?? 0;
    crmCount = results[8]._count._all;
    for (const row of results[9]) {
      if (!row.branchId) continue;
      const a = branchA(row.branchId);
      if (row.type === "VIEW") a.views = row._count._all;
      else if (row.type === "CLICK") a.clicks = row._count._all;
    }
    for (const row of results[10]) {
      if (!row.branchId || !row.target) continue;
      const a = branchA(row.branchId);
      if (row.target in a.clicksByTarget) a.clicksByTarget[row.target] = row._count._all;
    }
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
  }

  const branchStats = branchesRaw.map((branch) => {
    const scores = branch.surveyResponses.map((r) => r.averageScore);
    const avg =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const a = perBranch[branch.id] ?? {
      views: 0,
      clicks: 0,
      clicksByTarget: { YANDEX: 0, "2GIS": 0, GOOGLE: 0 },
    };
    return {
      id: branch.id,
      name: branch.name,
      avg,
      count: scores.length, // прохождения (успешные ответы)
      views: a.views, // открытия опроса (QR/ссылка)
      clicks: a.clicks, // переходы на карты
      clicksByTarget: a.clicksByTarget,
    };
  });

  // Network loyalty = average of ALL responses in the period (branch + CRM/QR),
  // taken from the DB aggregate above rather than only branch-attached rows.
  const totalMeanValue = networkAvg;
  const globalMean = totalMeanValue.toFixed(1);
  const excellenceStatusMap: { [key: string]: string } = {
    "Excellent": "Отлично",
    "Very Good": "Очень хорошо",
    "Good": "Хорошо",
    "Needs Review": "Требует внимания"
  };
  const statusLabel = totalMeanValue >= 4.8 ? "Excellent" : totalMeanValue >= 4.5 ? "Very Good" : totalMeanValue >= 4 ? "Good" : "Needs Review";
  const excellenceStatus = excellenceStatusMap[statusLabel];
  const statusLegend = "Отлично (≥4.8), Очень хорошо (≥4.5), Хорошо (≥4), Требует внимания (<4)";
  
  const trend = prevResponsesCount > 0 
    ? Math.round(((totalResponses - prevResponsesCount) / prevResponsesCount) * 100) 
    : 0;

  // Conversion calculations
  const openRate = totalViews > 0 ? Math.round((totalResponses / totalViews) * 100) : 0;
  const clickThroughRate = totalResponses > 0 ? Math.round((totalClicks / totalResponses) * 100) : 0;

  // Aggregate history from all branches
  const allHistory = branchesRaw.flatMap((b) => b.ratingHistory);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Дашборд</h1>
          <p className="text-slate-500 text-base md:text-lg font-medium">Аналитика качества сервиса в режиме реального времени</p>
        </div>
        <PeriodFilter />
      </div>

      {/* Overall Network Monitoring */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bento-card min-h-[300px] md:min-h-[450px]">
          <OverallMonitoring data={allHistory} />
        </div>
      </div>

      {/* Bento Grid Layout */}
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
        {/* Row 1: Key Metrics */}
        <BentoMetricCard 
          label="Просмотры опроса" 
          value={totalViews} 
          icon={Eye} 
          color="text-indigo-600" 
          bg="bg-indigo-50" 
          desc="Общее кол-во уникальных просмотров опроса через QR или ссылки."
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Прохождения опроса" 
          value={totalResponses} 
          icon={MessageSquare} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
          desc={`${openRate}% клиентов завершили опрос до конца.`}
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Переход на карты" 
          value={totalClicks} 
          icon={MousePointer2} 
          color="text-amber-600" 
          bg="bg-amber-50" 
          desc={`${clickThroughRate}% перешли на карты после оценки.`}
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Негативная обратная связь" 
          value={negativeResponses} 
          icon={AlertCircle} 
          color="text-rose-600" 
          bg="bg-rose-50" 
          desc="Количество прохождений опросов с оценкой ниже 4.5 звезд."
          className="md:row-span-1"
        />

        {/* Row 2 & 3: Main Funnel Visual & Branch Sidebar */}
        <div className="md:col-span-2 lg:col-span-3 lg:row-span-2 bento-card relative overflow-hidden flex flex-col min-h-[400px] md:min-h-[500px]">
          <div className="relative z-10 flex flex-col h-full">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3 mb-6 md:mb-10">
              <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
              Воронка вовлеченности
            </h2>
            
            <div className="flex-1 space-y-10 max-w-3xl">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Просмотры опроса</span>
                  <span className="text-2xl font-black text-slate-900">{totalViews}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full premium-gradient w-full rounded-full"></div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 pl-4 md:pl-16">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Прохождения ({openRate}%)</span>
                  <span className="text-lg md:text-2xl font-black text-slate-900">{totalResponses}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full rounded-full shadow-lg shadow-emerald-500/20" style={{ width: `${openRate}%` }}></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 pl-8 md:pl-32">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Переход на карты ({clickThroughRate}%)</span>
                  <span className="text-lg md:text-2xl font-black text-slate-900">{totalClicks}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full bg-amber-500 w-full rounded-full shadow-lg shadow-amber-500/20" style={{ width: `${(Number(openRate) * Number(clickThroughRate) / 100) || 0}%` }}></div>
                </div>
                {/* Breakdown: which map service customers opened */}
                <div className="flex flex-wrap gap-2 px-4 pt-1">
                  {[
                    { key: "YANDEX", label: "Яндекс", icon: "yandex" },
                    { key: "2GIS", label: "2ГИС", icon: "2gis" },
                    { key: "GOOGLE", label: "Google", icon: "googlemaps" },
                  ].map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/70 border border-amber-100 rounded-xl shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/icons/${s.icon}.png`} alt="" className="w-3.5 h-3.5 object-contain" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                      <span className="text-xs font-black text-amber-600">{clicksByTarget[s.key] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Лояльность сети</p>
                   <p className="text-3xl font-black text-indigo-600 tracking-tighter">{globalMean}</p>
                   <p className="text-[9px] font-bold text-slate-400 mt-1">средняя оценка</p>
                   <div className="flex items-center gap-0.5 mt-2">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= Number(globalMean) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                   </div>
                </div>
                <div
                  className="p-6 rounded-[2rem] bg-slate-900 text-white relative overflow-hidden group cursor-help"
                  title={statusLegend}
                >
                   <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Общий статус</p>
                      <p className="text-3xl font-black text-white tracking-tighter">{excellenceStatus}</p>
                      <p className="text-[9px] font-bold text-slate-500 mt-1">текстовая оценка</p>
                      <p className={cn(
                        "text-[10px] font-bold mt-2 flex items-center gap-1",
                        trend >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        <TrendingUp className={cn("w-3 h-3", trend < 0 && "rotate-180")} />
                        {trend > 0 ? `+${trend}%` : `${trend}%`} к прошлому периоду
                      </p>
                   </div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full group-hover:bg-indigo-500/20 transition-all" />
                </div>
                <div className="p-6 rounded-[2rem] bg-emerald-50/50 border border-emerald-100/50">
                   <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Оценка из CRM</p>
                   <p className="text-3xl font-black text-emerald-600 tracking-tighter">{crmAvg.toFixed(1)}</p>
                   <p className="text-[9px] font-bold text-slate-400 mt-1">{crmCount} {crmCount === 1 ? "опрос" : "опросов"} по ссылкам из CRM</p>
                   <div className="flex items-center gap-0.5 mt-2">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= Number(crmAvg) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                   </div>
                </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] -mr-64 -mt-64 rounded-full"></div>
        </div>

        <div className="lg:row-span-2 bento-card flex flex-col bg-white/40 min-h-[400px] max-h-[640px] overflow-hidden">
          <div className="flex items-center justify-between mb-8 shrink-0">
             <h3 className="text-xl font-black text-slate-900">По филиалам</h3>
             <Users className="w-6 h-6 text-slate-300" />
          </div>
          
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {branchStats.map((branch) => (
              <div key={branch.id} className="p-5 glass rounded-2xl hover:bg-white/80 transition-all border-white/60 mb-1">
                {/* Header: name (full, wraps) + average rating */}
                <div className="flex justify-between items-start gap-3 mb-4">
                  <p className="font-bold text-slate-800 text-sm leading-snug break-words flex-1">{branch.name}</p>
                  <div className="flex items-center gap-1 text-slate-900 font-black text-sm shrink-0">
                    {branch.avg.toFixed(1)}
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                </div>

                {/* Funnel counts */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="flex flex-col items-center justify-start py-2 px-1 rounded-xl bg-indigo-50/50 border border-indigo-100/40">
                    <Eye className="w-3.5 h-3.5 text-indigo-400 mb-1" />
                    <span className="text-sm font-black text-slate-900 leading-none">{branch.views}</span>
                    <span className="text-[9px] font-bold text-slate-400 text-center leading-tight mt-1">просмотры</span>
                  </div>
                  <div className="flex flex-col items-center justify-start py-2 px-1 rounded-xl bg-emerald-50/50 border border-emerald-100/40">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500 mb-1" />
                    <span className="text-sm font-black text-slate-900 leading-none">{branch.count}</span>
                    <span className="text-[9px] font-bold text-slate-400 text-center leading-tight mt-1">прохождения</span>
                  </div>
                  <div className="flex flex-col items-center justify-start py-2 px-1 rounded-xl bg-amber-50/50 border border-amber-100/40">
                    <MousePointer2 className="w-3.5 h-3.5 text-amber-500 mb-1" />
                    <span className="text-sm font-black text-slate-900 leading-none">{branch.clicks}</span>
                    <span className="text-[9px] font-bold text-slate-400 text-center leading-tight mt-1">переходы</span>
                  </div>
                </div>

                {/* Click breakdown per service */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "YANDEX", label: "Яндекс", icon: "yandex" },
                    { key: "2GIS", label: "2ГИС", icon: "2gis" },
                    { key: "GOOGLE", label: "Google", icon: "googlemaps" },
                  ].map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-1.5 px-2 py-1 bg-white/70 border border-slate-100 rounded-lg"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/icons/${s.icon}.png`} alt="" className="w-3 h-3 object-contain" />
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                      <span className="text-[11px] font-black text-amber-600">{branch.clicksByTarget[s.key] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
