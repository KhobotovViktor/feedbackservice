"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";

interface BranchLite {
  id: string;
  name: string;
}

interface SummaryResult {
  summary: string;
  count: number;
  days: number;
  branchName: string | null;
  configured?: boolean;
}

const PERIODS = [
  { value: 7, label: "7 дней" },
  { value: 30, label: "Месяц" },
  { value: 90, label: "3 месяца" },
];

export function AiInsights({ branches }: { branches: BranchLite[] }) {
  const [branchId, setBranchId] = useState("all");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сформировать сводку");
        return;
      }
      setResult(data);
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bento-card bg-white/60 p-6 md:p-8 space-y-6 border-white/40">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl premium-gradient text-white flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">AI-аналитика комментариев</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Топ-3 проблемы за период</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Филиал</label>
          <CustomSelect
            options={[{ value: "all", label: "Все филиалы" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            value={branchId}
            onChange={setBranchId}
            placeholder="Все филиалы"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Период</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={
                  "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all " +
                  (days === p.value ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-6 py-3 premium-gradient text-white rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          Сформировать
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50/60 border border-rose-100 rounded-2xl text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-bold leading-relaxed">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 p-6 bg-indigo-50/30 border border-indigo-100/50 rounded-3xl">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="px-2.5 py-1 bg-white rounded-lg text-indigo-600">{result.branchName || "Все филиалы"}</span>
            <span className="px-2.5 py-1 bg-white rounded-lg">за {result.days} дн.</span>
            <span className="px-2.5 py-1 bg-white rounded-lg">{result.count} комм.</span>
          </div>
          <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">{result.summary}</p>
        </div>
      )}

      {!result && !error && (
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed px-1">
          Claude проанализирует текстовые комментарии за выбранный период и выделит главные
          повторяющиеся проблемы. Помогает не читать сотни отзывов вручную.
        </p>
      )}
    </div>
  );
}
