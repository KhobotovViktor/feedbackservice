import { Users, Star, AlertCircle } from "lucide-react";

interface StaffRow {
  name: string;
  count: number;
  avg: number;
  negative: number;
}

// Colour band for the average score, matching the Results table convention.
function band(score: number): string {
  if (score >= 4.5) return "text-emerald-600";
  if (score >= 4.0) return "text-amber-600";
  return "text-rose-600";
}

export function StaffPanel({ staff }: { staff: StaffRow[] }) {
  if (!staff || staff.length === 0) return null;

  // Network average across all listed operators, weighted by response count —
  // a baseline to compare each operator against.
  const totalCount = staff.reduce((s, r) => s + r.count, 0);
  const weightedAvg =
    totalCount > 0 ? staff.reduce((s, r) => s + r.avg * r.count, 0) / totalCount : 0;

  return (
    <div className="bento-card bg-white/60 p-6 md:p-8 space-y-6 border-white/40">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">По сотрудникам</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Эффективность ответственных за период
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span className="col-span-5">Сотрудник</span>
          <span className="col-span-2 text-center">Опросов</span>
          <span className="col-span-2 text-center">Средняя</span>
          <span className="col-span-3 text-center">Негатив</span>
        </div>

        {staff.map((s) => {
          const negPct = s.count > 0 ? Math.round((s.negative / s.count) * 100) : 0;
          return (
            <div
              key={s.name}
              className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-center p-4 glass border-white/60 rounded-2xl hover:bg-white/80 transition-all"
            >
              <p className="col-span-2 sm:col-span-5 font-bold text-slate-800 text-sm truncate">{s.name}</p>
              <div className="sm:col-span-2 flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Опросов:</span>
                <span className="font-black text-slate-900 tabular-nums">{s.count}</span>
              </div>
              <div className="sm:col-span-2 flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Средняя:</span>
                <span className={`font-black tabular-nums ${band(s.avg)}`}>{s.avg.toFixed(1)}</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <div className="sm:col-span-3 flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Негатив:</span>
                {s.negative > 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-600 font-black text-sm">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {s.negative} <span className="text-rose-400 font-bold">({negPct}%)</span>
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
        Средняя по всем ответственным: <span className="text-slate-600">{weightedAvg.toFixed(1)} ★</span> · всего {totalCount} опросов.
        «Негатив» — ответы с оценкой ниже 4.5.
      </p>
    </div>
  );
}
