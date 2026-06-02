import { Clock } from "lucide-react";

interface Bucket {
  count: number;
  negative: number;
}
interface DowBucket extends Bucket {
  label: string;
}

// Two lightweight bar histograms (no recharts) showing WHEN responses arrive
// and where negatives concentrate — by day of week and by hour. The negative
// share is drawn as a rose overlay at the bottom of each bar.
function Bars({
  data,
  labels,
  height = 120,
}: {
  data: Bucket[];
  labels: string[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.round((d.count / max) * 100);
        const negH = d.count > 0 ? Math.round((d.negative / d.count) * h) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
            {/* Tooltip on hover */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full px-2 py-1 rounded-lg bg-slate-900 text-white text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {labels[i]}: {d.count}{d.negative > 0 ? ` · негатив ${d.negative}` : ""}
            </div>
            <div
              className="w-full rounded-t-md bg-indigo-200 relative overflow-hidden transition-all group-hover:bg-indigo-300"
              style={{ height: `${Math.max(2, h)}%` }}
            >
              {negH > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-rose-400"
                  style={{ height: `${negH}%` }}
                />
              )}
            </div>
            <span className="text-[8px] font-black text-slate-400 tabular-nums">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TimePanel({
  dow,
  hours,
}: {
  dow: DowBucket[];
  hours: Bucket[];
}) {
  const total = dow.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  // Show every 3rd hour label to avoid clutter on 24 bars.
  const hourLabels = hours.map((_, h) => (h % 3 === 0 ? String(h) : ""));

  return (
    <div className="bento-card bg-white/60 p-6 md:p-8 space-y-8 border-white/40">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Когда оставляют отзывы</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Распределение по дням и часам (МСК)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">По дням недели</p>
          <Bars data={dow} labels={dow.map((d) => d.label)} />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">По часам</p>
          <Bars data={hours} labels={hourLabels} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200" /> Все отзывы</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400" /> Из них негатив</span>
      </div>
    </div>
  );
}
