"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Star, User, MessageCircle, TrendingUp, Trash2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResultRow {
  id: string;
  clientId: string;
  dealId: string;
  averageScore: number;
  comment: string | null;
  createdAt: string | Date;
  responsibleName: string | null;
  branch: { name: string } | null;
}

function sourceText(res: ResultRow): string {
  const isCRM =
    res.dealId &&
    res.dealId !== "0" &&
    res.dealId !== "TEST_DEAL" &&
    res.dealId !== "QR_GUEST";
  if (res.branch?.name) return `${res.branch.name} ${isCRM ? "(CRM)" : "(QR)"}`;
  if (isCRM) return "Bitrix24 (CRM)";
  return "Прямая ссылка / QR";
}

function isCrmSource(res: ResultRow): boolean {
  return Boolean(
    res.dealId &&
      res.dealId !== "0" &&
      res.dealId !== "TEST_DEAL" &&
      res.dealId !== "QR_GUEST"
  );
}

export function ResultsTable({ responses }: { responses: ResultRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = responses.length > 0 && selected.size === responses.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === responses.length ? new Set() : new Set(responses.map((r) => r.id))
    );

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Удалить выбранные результаты (${selected.size})? Действие необратимо.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Не удалось удалить: ${data.error || res.statusText}`);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети при удалении.");
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const fmtTime = (d: string | Date) =>
    new Date(d).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });

  return (
    <div className="space-y-4">
      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Снять выделение"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-black">Выбрано: {selected.size}</span>
          </div>
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить выбранные
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden xl:block bento-card p-0 overflow-hidden border-white/40 shadow-2xl shadow-indigo-500/5">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="w-[5%] px-6 py-6 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Выбрать все"
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </th>
              <th className="w-[16%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Дата</th>
              <th className="w-[17%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Источник</th>
              <th className="w-[17%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Клиент / Сделка</th>
              <th className="w-[10%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Оценка</th>
              <th className="w-[14%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Ответственный</th>
              <th className="px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Комментарий</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/40">
            {responses.map((res) => (
              <tr
                key={res.id}
                className={cn(
                  "transition-colors group",
                  selected.has(res.id) ? "bg-indigo-50/60" : "hover:bg-white"
                )}
              >
                <td className="px-6 py-6 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(res.id)}
                    onChange={() => toggle(res.id)}
                    aria-label="Выбрать строку"
                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-indigo-400/40 shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-black text-slate-900 whitespace-nowrap">{fmtDate(res.createdAt)}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fmtTime(res.createdAt)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <div className={cn(
                    "text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest inline-block",
                    res.branch?.name
                      ? "text-indigo-600 bg-indigo-50 border-indigo-100/30"
                      : isCrmSource(res)
                        ? "text-amber-600 bg-amber-50 border-amber-100/30"
                        : "text-slate-400 bg-slate-50 border-slate-100/30"
                  )}>
                    {sourceText(res)}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="text-sm font-black text-slate-900 tracking-tight truncate">{res.clientId || "Incognito"}</div>
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 opacity-60 truncate">Deal: {res.dealId || "—"}</div>
                </td>
                <td className="px-6 py-6 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-black text-slate-900 text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{res.responsibleName || "—"}</div>
                </td>
                <td className="px-6 py-6 text-sm text-slate-600 font-medium leading-relaxed italic overflow-hidden text-ellipsis">
                  {res.comment ? `“${res.comment}”` : <span className="text-slate-200">Нет комментария</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
        {responses.map((res) => {
          const ratingColor = res.averageScore >= 4 ? "text-emerald-500 bg-emerald-50 border-emerald-100" : "text-rose-500 bg-rose-50 border-rose-100";
          return (
            <div
              key={res.id}
              className={cn(
                "bento-card group flex flex-col",
                selected.has(res.id) ? "bg-indigo-50/70 ring-2 ring-indigo-300" : "bg-white/60"
              )}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(res.id)}
                    onChange={() => toggle(res.id)}
                    aria-label="Выбрать"
                    className="w-4 h-4 mt-1 rounded accent-indigo-500 cursor-pointer shrink-0"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" />
                      {fmtDate(res.createdAt)} {fmtTime(res.createdAt)}
                    </div>
                    <div className={cn(
                      "text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest inline-block",
                      res.branch?.name
                        ? "text-indigo-600 bg-indigo-50 border-indigo-100/30"
                        : isCrmSource(res)
                          ? "text-amber-600 bg-amber-50 border-amber-100/30"
                          : "text-slate-400 bg-slate-50 border-slate-100/30"
                    )}>
                      {sourceText(res)}
                    </div>
                  </div>
                </div>
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm", ratingColor)}>
                  <span className="font-black text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                  <Star className="w-4 h-4 fill-current" />
                </div>
              </div>

              <div className="flex items-center gap-4 p-5 glass border-white/60 rounded-3xl mb-6">
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
    </div>
  );
}
