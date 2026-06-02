import { Building2, Star, TrendingUp, AlertCircle, Trophy } from "lucide-react";

interface BranchRow {
  id: string;
  name: string;
  avg: number;
  delta: number | null;
  count: number;
  negative: number;
}

function band(score: number): string {
  if (score >= 4.5) return "text-emerald-600";
  if (score >= 4.0) return "text-amber-600";
  return "text-rose-600";
}
function barColor(score: number): string {
  if (score >= 4.5) return "bg-emerald-400";
  if (score >= 4.0) return "bg-amber-400";
  return "bg-rose-400";
}

// Explicit best→worst branch leaderboard by average score, with ПоП delta,
// response volume and negative share. Complements the funnel's "По филиалам"
// panel (which is about views/completions, not a comparison).
export function BranchComparison({ branches }: { branches: BranchRow[] }) {
  if (!branches || branches.length === 0) return null;

  return (
    <div className="bento-card bg-white/60 p-6 md:p-8 space-y-6 border-white/40">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Сравнение филиалов</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Рейтинг по средней оценке за период
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {/* Header (desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span className="col-span-1">#</span>
          <span className="col-span-5">Филиал</span>
          <span className="col-span-3">Средняя</span>
          <span className="col-span-1 text-center">Опр.</span>
          <span className="col-span-2 text-center">Негатив</span>
        </div>

        {branches.map((b, i) => {
          const rank = i + 1;
          const negPct = b.count > 0 ? Math.round((b.negative / b.count) * 100) : 0;
          const widthPct = Math.round((b.avg / 5) * 100);
          return (
            <div
              key={b.id}
              className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-center p-4 glass border-white/60 rounded-2xl hover:bg-white/80 transition-all"
            >
              {/* Rank */}
              <div className="sm:col-span-1 flex items-center">
                {rank <= 3 ? (
                  <span className={
                    "inline-flex items-center gap-1 font-black text-sm " +
                    (rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : "text-amber-700")
                  }>
                    <Trophy className="w-3.5 h-3.5" />{rank}
                  </span>
                ) : (
                  <span className="font-black text-sm text-slate-300">{rank}</span>
                )}
              </div>

              {/* Name */}
              <p className="col-span-2 sm:col-span-5 font-bold text-slate-800 text-sm truncate order-first sm:order-none">{b.name}</p>

              {/* Average + bar + delta */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0 w-12">
                  <span className={`font-black tabular-nums ${band(b.avg)}`}>{b.avg.toFixed(1)}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                  <div className={`h-full rounded-full ${barColor(b.avg)}`} style={{ width: `${widthPct}%` }} />
                </div>
                {b.delta !== null && b.delta !== 0 && (
                  <span className={
                    "inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums shrink-0 " +
                    (b.delta > 0 ? "text-emerald-500" : "text-rose-500")
                  }>
                    <TrendingUp className={`w-2.5 h-2.5 ${b.delta < 0 ? "rotate-180" : ""}`} />
                    {b.delta > 0 ? "+" : ""}{b.delta.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Count */}
              <div className="sm:col-span-1 flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Опросов:</span>
                <span className="font-black text-slate-900 tabular-nums text-sm">{b.count}</span>
              </div>

              {/* Negative */}
              <div className="sm:col-span-2 flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Негатив:</span>
                {b.negative > 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-600 font-black text-sm">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {b.negative} <span className="text-rose-400 font-bold">({negPct}%)</span>
                  </span>
                ) : (
                  <span className="text-emerald-500 font-black text-sm">0</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-bold text-slate-400 px-1">
        Дельта (±★) — изменение средней к прошлому сопоставимому периоду; видна при выборе «30 дней» или своего периода. «Негатив» — оценки ниже 4.5.
      </p>
    </div>
  );
}
