"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Activity } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";

// One rating-history snapshot. RatingHistory rows carry `service` and
// `branchId` too (Prisma returns the full row), so we can filter/aggregate by
// platform and branch on the client. `reviewCount` is the *cumulative* number
// of reviews on the map service at the moment of the snapshot.
export interface RatingPoint {
  createdAt: string | Date;
  rating: number;
  reviewCount: number;
  service?: string | null;
  branchId?: string | null;
}

interface Props {
  data: RatingPoint[];
  branches?: { id: string; name: string }[];
}

type Metric = "rating" | "total" | "delta";
type Granularity = "day" | "week" | "month";

interface ChartPoint {
  label: string;
  ts: number;
  avg: number;
  total: number;
  delta: number;
  pairs: number;
}

const METRICS: { value: Metric; label: string }[] = [
  { value: "rating", label: "Оценка" },
  { value: "total", label: "Отзывы" },
  { value: "delta", label: "Прирост" },
];

const GRANS: { value: Granularity; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

const SERVICE_OPTIONS = [
  { value: "all", label: "Все площадки" },
  { value: "yandex", label: "Яндекс" },
  { value: "2gis", label: "2ГИС" },
  { value: "google", label: "Google" },
];

const METRIC_META: Record<
  Metric,
  { dataKey: keyof ChartPoint; title: string; sub: string; color: string; gradId: string; kind: "area" | "bar" }
> = {
  rating: {
    dataKey: "avg",
    title: "Средняя оценка на картах",
    sub: "Средний рейтинг площадок сети",
    color: "#6366f1",
    gradId: "omRating",
    kind: "area",
  },
  total: {
    dataKey: "total",
    title: "Всего отзывов на картах",
    sub: "Накопленное число отзывов площадок",
    color: "#10b981",
    gradId: "omTotal",
    kind: "area",
  },
  delta: {
    dataKey: "delta",
    title: "Прирост отзывов за период",
    sub: "Новые отзывы между точками",
    color: "#f59e0b",
    gradId: "omDelta",
    kind: "bar",
  },
};

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Bucket a date to the start of its day / ISO-week (Monday) / month, returning
// a stable sort key, a sort timestamp and a short RU label.
function bucketInfo(d: Date, g: Granularity): { key: string; ts: number; label: string } {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  if (g === "week") {
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
  } else if (g === "month") {
    x.setDate(1);
  }
  const ts = x.getTime();
  const label =
    g === "month"
      ? x.toLocaleDateString("ru-RU", { month: "short", year: "2-digit", timeZone: "Europe/Moscow" })
      : x.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" });
  return { key: `${g}:${ts}`, ts, label };
}

function MonitoringChartInner({ data, branches = [] }: Props) {
  const [metric, setMetric] = useState<Metric>("rating");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [service, setService] = useState("all");
  const [branch, setBranch] = useState("all");

  const { chartData, branchOptions } = useMemo(() => {
    // Only offer branches that actually have history, plus an "all" entry.
    const present = new Set<string>();
    for (const p of data) if (p.branchId) present.add(p.branchId);
    const branchOptions = [
      { value: "all", label: "Все филиалы" },
      ...branches.filter((b) => present.has(b.id)).map((b) => ({ value: b.id, label: b.name })),
    ];

    const filtered = data.filter(
      (p) =>
        (service === "all" || p.service === service) &&
        (branch === "all" || p.branchId === branch)
    );

    // Sort chronologically — the parent passes history concatenated per branch,
    // so without this the X axis would not be in time order.
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Group snapshots into buckets.
    const buckets = new Map<string, { ts: number; label: string; snaps: RatingPoint[] }>();
    for (const p of sorted) {
      const bi = bucketInfo(new Date(p.createdAt), granularity);
      let e = buckets.get(bi.key);
      if (!e) {
        e = { ts: bi.ts, label: bi.label, snaps: [] };
        buckets.set(bi.key, e);
      }
      e.snaps.push(p);
    }
    const order = [...buckets.values()].sort((a, b) => a.ts - b.ts);

    // Carry-forward the last known snapshot per (branch, service) pair. Sync is
    // sparse and incomplete (not every pair reports every day), so a per-bucket
    // sum would jump with the *number of synced pairs*, not real reviews. By
    // keeping each pair's latest value we get a correct cumulative network total
    // and a sensible average. Within a bucket the latest snapshot wins (snaps
    // are sorted ascending), which collapses same-day duplicates.
    const lastState = new Map<string, { rating: number; reviewCount: number }>();
    const points: ChartPoint[] = order.map((b) => {
      for (const s of b.snaps) {
        lastState.set(`${s.branchId}|${s.service}`, { rating: s.rating, reviewCount: s.reviewCount });
      }
      const states = [...lastState.values()];
      const pairs = states.length;
      const avg = pairs ? states.reduce((a, s) => a + s.rating, 0) / pairs : 0;
      const total = states.reduce((a, s) => a + s.reviewCount, 0);
      return { label: b.label, ts: b.ts, avg: Math.round(avg * 100) / 100, total, delta: 0, pairs };
    });
    for (let i = 1; i < points.length; i++) {
      points[i].delta = points[i].total - points[i - 1].total;
    }

    return { chartData: points, branchOptions };
  }, [data, branches, service, branch, granularity]);

  const meta = METRIC_META[metric];
  const last = chartData.length ? chartData[chartData.length - 1] : null;
  const fmt = (v: number) =>
    metric === "rating" ? `${v.toFixed(2)} ★` : metric === "delta" ? (v > 0 ? `+${v}` : `${v}`) : `${v}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header + current value */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{meta.title}</h3>
            <p className="text-[11px] font-bold text-slate-400 leading-tight">{meta.sub}</p>
          </div>
        </div>
        {last && (
          <div className="text-right shrink-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Сейчас</p>
            <p className="text-2xl font-black tracking-tighter tabular-nums" style={{ color: meta.color }}>
              {fmt(Number(last[meta.dataKey]))}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Segmented value={metric} onChange={setMetric} options={METRICS} />
        <Segmented value={granularity} onChange={setGranularity} options={GRANS} />
        <CustomSelect className="w-40" value={service} onChange={setService} options={SERVICE_OPTIONS} />
        {branchOptions.length > 1 && (
          <CustomSelect className="w-48" value={branch} onChange={setBranch} options={branchOptions} />
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 w-full min-h-[300px] relative">
        {chartData.length > 0 ? (
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              {meta.kind === "bar" ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} width={44} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", fontSize: "11px", fontWeight: 800 }}
                    labelFormatter={(l) => `Период: ${l}`}
                    formatter={(value) => [fmt(Number(value)), "Прирост отзывов"]}
                  />
                  <Bar dataKey="delta" fill={meta.color} radius={[6, 6, 0, 0]} animationDuration={900} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id={meta.gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={meta.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={meta.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} dy={8} />
                  <YAxis
                    domain={metric === "rating" ? ["dataMin", "dataMax"] : ["auto", "auto"]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    width={44}
                    allowDecimals={metric === "rating"}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", fontSize: "11px", fontWeight: 800 }}
                    labelFormatter={(l) => `Период: ${l}`}
                    // recharts' Tooltip formatter is heavily overloaded across
                    // versions; we narrow to the payload we control.
                    formatter={(value, _name, item) => {
                      const p = (item as { payload?: ChartPoint }).payload;
                      const suffix = p ? ` · ${p.pairs} площадок` : "";
                      return [`${fmt(Number(value))}${suffix}`, meta.title];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={meta.dataKey as string}
                    stroke={meta.color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill={`url(#${meta.gradId})`}
                    dot={{ r: 3, fill: meta.color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    animationDuration={1200}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-sm">Недостаточно данных для графика</p>
            <p className="text-slate-300 font-medium text-[11px] mt-1">Снимки рейтинга появляются после синхронизации с картами</p>
          </div>
        )}
      </div>
    </div>
  );
}

// recharts renders nothing useful on the server (ResponsiveContainer needs a
// real DOM to size to), so we load the inner component dynamically with
// ssr:false — "render on the client only" without any effect or extra state.
export const OverallMonitoring = dynamic(() => Promise.resolve(MonitoringChartInner), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 min-h-[350px]">
      <p className="text-slate-400 font-bold text-sm">Загрузка графика…</p>
    </div>
  ),
});
