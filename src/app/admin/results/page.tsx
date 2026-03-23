import { prisma } from "@/lib/prisma";
import { Building2, MessageCircle, Star, Calendar, User, TrendingUp, Filter, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BranchFilter } from "@/components/results/branch-filter";
import { TypeFilter } from "@/components/results/type-filter";
import { ClearResultsButton } from "@/components/results/clear-results-button";
import Link from "next/link";

export default async function ResultsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ branchId?: string; type?: string; sortBy?: string; order?: string }> 
}) {
  const { branchId, type = "all", sortBy = "date", order = "desc" } = await searchParams;

  // Helper to get source text
  const getSourceText = (res: any) => {
    const isCRM = res.dealId && res.dealId !== "0" && res.dealId !== "TEST_DEAL" && res.dealId !== "QR_GUEST";
    if (res.branch?.name) {
      return `${res.branch.name} ${isCRM ? "(CRM)" : "(QR)"}`;
    }
    if (isCRM) return "Bitrix24 (CRM)";
    return "Прямая ссылка / QR";
  };

  let responses: any[] = [];
  let branches: any[] = [];

  try {
    const where: any = {};
    if (branchId === "crm") {
      where.branchId = null;
      where.dealId = { not: "QR_GUEST" };
    } else if (branchId && branchId !== "all") {
      where.branchId = branchId;
    }

    if (type === "positive") where.averageScore = { gte: 4 };
    if (type === "negative") where.averageScore = { lt: 4 };

    const results = await Promise.all([
      prisma.surveyResponse.findMany({
        where,
        orderBy: sortBy === "date" 
          ? { createdAt: order as any } 
          : sortBy === "score"
            ? { averageScore: order as any }
            : sortBy === "responsible"
              ? { responsibleName: order as any }
              : undefined,
        include: { branch: true }
      }),
      (prisma as any).branch.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      })
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
        <>
          <div className="hidden xl:block bento-card p-0 overflow-hidden border-white/40 shadow-2xl shadow-indigo-500/5">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="w-[18%] px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Дата</th>
                  <th className="w-[18%] px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Источник</th>
                  <th className="w-[18%] px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Клиент / Сделка</th>
                  <th className="w-[10%] px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Оценка</th>
                  <th className="w-[14%] px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Ответственный</th>
                  <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/40">
                {responses.map((res: any) => (
                  <tr key={res.id} className="hover:bg-white transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-indigo-400/40 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-black text-slate-900 whitespace-nowrap">{new Date(res.createdAt).toLocaleDateString('ru-RU')}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(res.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className={cn(
                        "text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest inline-block transition-transform",
                        res.branch?.name 
                          ? "text-indigo-600 bg-indigo-50 border-indigo-100/30" 
                          : (res.dealId && res.dealId !== "0" && res.dealId !== "TEST_DEAL" && res.dealId !== "QR_GUEST")
                            ? "text-amber-600 bg-amber-50 border-amber-100/30"
                            : "text-slate-400 bg-slate-50 border-slate-100/30"
                      )}>
                        {getSourceText(res)}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 tracking-tight truncate">{res.clientId || "Incognito"}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 opacity-60 truncate">Deal: {res.dealId || "—"}</div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-black text-slate-900 text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{res.responsibleName || "—"}</div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-600 font-medium leading-relaxed italic overflow-hidden text-ellipsis">
                      {res.comment ? `“${res.comment}”` : <span className="text-slate-200">Нет комментария</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
            {responses.map((res: any) => {
              const ratingColor = res.averageScore >= 4 ? "text-emerald-500 bg-emerald-50 border-emerald-100" : "text-rose-500 bg-rose-50 border-rose-100";
              return (
                <div key={res.id} className="bento-card group flex flex-col bg-white/60">
                  <div className="flex justify-between items-start mb-8">
                     <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <Calendar className="w-3.5 h-3.5" />
                           {new Date(res.createdAt).toLocaleDateString()} {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={cn(
                          "text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest inline-block",
                          res.branch?.name 
                            ? "text-indigo-600 bg-indigo-50 border-indigo-100/30" 
                            : (res.dealId && res.dealId !== "0" && res.dealId !== "TEST_DEAL" && res.dealId !== "QR_GUEST")
                              ? "text-amber-600 bg-amber-50 border-amber-100/30"
                              : "text-slate-400 bg-slate-50 border-slate-100/30"
                        )}>
                           {getSourceText(res)}
                        </div>
                     </div>
                     <div className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm group-hover:scale-110 transition-transform", ratingColor)}>
                        <span className="font-black text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                        <Star className="w-4 h-4 fill-current" />
                     </div>
                  </div>

                  <div className="flex items-center gap-4 p-5 glass border-white/60 rounded-3xl mb-6 group-hover:bg-white transition-all">
                     <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <User className="w-6 h-6" />
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-slate-900 tracking-tight truncate">{res.clientId || "Incognito"}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Deal: {res.dealId || "—"}</p>
                          {res.responsibleName && (
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50/50 px-1.5 py-0.5 rounded">Resp: {res.responsibleName}</p>
                          )}
                        </div>
                     </div>
                  </div>

                  {res.comment && (
                     <div className="p-6 bg-indigo-50/20 rounded-3xl border border-indigo-100/20 mt-auto relative overflow-hidden">
                        <MessageCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/5 rotate-12" />
                        <div className="relative z-10 flex gap-4 items-start">
                           <TrendingUp className="w-6 h-6 text-indigo-400 shrink-0 mt-1 opacity-40" />
                           <p className="text-base text-slate-700 font-bold leading-relaxed italic opacity-80">“{res.comment}”</p>
                        </div>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
