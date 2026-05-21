"use client";

import { TrendingUp, Smile, Award, Tag } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface WeekPoint {
  label: string;
  avg: number;
  count: number;
  negative: number;
}

interface Props {
  weekly: WeekPoint[];
  csat: number;
  nps: number;
  total: number;
  topTags: { tag: string; count: number }[];
}

export function TrendsPanel({ weekly, csat, nps, total, topTags }: Props) {
  return (
    <div className="bento-card bg-white/60 p-6 md:p-8 space-y-6 border-white/40">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Динамика и метрики</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">По неделям за период</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-emerald-50/50 border border-emerald-100/50">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Smile className="w-4 h-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">CSAT</p>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{csat}%</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">довольных (оценка ≥ 4.5)</p>
        </div>
        <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-100/50">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Award className="w-4 h-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">NPS</p>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{nps > 0 ? `+${nps}` : nps}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">промоутеры (5★) − детракторы (≤3★)</p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Всего за период</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{total}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">пройденных опросов</p>
        </div>
      </div>

      {/* Weekly average trend */}
      <div className="h-56 w-full">
        {weekly.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }} dy={8} />
              <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", fontSize: "11px", fontWeight: 800 }}
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                formatter={(value: any, _name: any, props: any) => [
                  `${value} ★ · ${props?.payload?.count ?? 0} опр. · ${props?.payload?.negative ?? 0} негатив`,
                  "Средняя",
                ]}
              />
              <Area type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={3} fill="url(#trendAvg)" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-300">Недостаточно данных</p>
          </div>
        )}
      </div>

      {/* Top AI tags */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400 mb-3">
          <Tag className="w-4 h-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Топ тем из комментариев</p>
        </div>
        {topTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topTags.map((t) => (
              <span key={t.tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded-xl text-xs font-black">
                #{t.tag}
                <span className="text-indigo-400">{t.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Авто-теги появятся после подключения AI-анализа (переменная ANTHROPIC_API_KEY на сервере).
          </p>
        )}
      </div>
    </div>
  );
}
