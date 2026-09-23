"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DateRangeFilterProps {
  defaultFrom?: string;
  defaultTo?: string;
}

// Format YYYY-MM-DD to DD.MM.YYYY
function formatRuDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

// Format YYYY-MM-DD to DD.MM
function formatShortDate(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}

function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateRangeFilter({ defaultFrom = "", defaultTo = "" }: DateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlFrom = searchParams.get("from") || defaultFrom;
  const urlTo = searchParams.get("to") || defaultTo;

  const [isOpen, setIsOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(urlFrom);
  const [draftTo, setDraftTo] = useState(urlTo);

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronise drafts when URL changes
  useEffect(() => {
    setDraftFrom(urlFrom);
    setDraftTo(urlTo);
  }, [urlFrom, urlTo]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyRange = (newFrom: string, newTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newFrom) params.set("from", newFrom);
    else params.delete("from");

    if (newTo) params.set("to", newTo);
    else params.delete("to");

    params.delete("page"); // reset pagination
    setIsOpen(false);
    router.push(`?${params.toString()}`);
  };

  const handleClear = () => {
    setDraftFrom("");
    setDraftTo("");
    applyRange("", "");
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    applyRange(draftFrom, draftTo);
  };

  // Quick presets
  const handlePreset = (preset: "today" | "yesterday" | "7d" | "30d" | "month" | "all") => {
    const now = new Date();
    if (preset === "all") {
      handleClear();
      return;
    }
    if (preset === "today") {
      const todayStr = toLocalIsoDate(now);
      setDraftFrom(todayStr);
      setDraftTo(todayStr);
      applyRange(todayStr, todayStr);
      return;
    }
    if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toLocalIsoDate(y);
      setDraftFrom(yStr);
      setDraftTo(yStr);
      applyRange(yStr, yStr);
      return;
    }
    if (preset === "7d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      const fromStr = toLocalIsoDate(start);
      const toStr = toLocalIsoDate(now);
      setDraftFrom(fromStr);
      setDraftTo(toStr);
      applyRange(fromStr, toStr);
      return;
    }
    if (preset === "30d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      const fromStr = toLocalIsoDate(start);
      const toStr = toLocalIsoDate(now);
      setDraftFrom(fromStr);
      setDraftTo(toStr);
      applyRange(fromStr, toStr);
      return;
    }
    if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const fromStr = toLocalIsoDate(start);
      const toStr = toLocalIsoDate(now);
      setDraftFrom(fromStr);
      setDraftTo(toStr);
      applyRange(fromStr, toStr);
      return;
    }
  };

  // Label calculation
  let label = "Все даты";
  const hasActiveDates = Boolean(urlFrom || urlTo);

  if (urlFrom && urlTo) {
    if (urlFrom === urlTo) {
      label = formatRuDate(urlFrom);
    } else {
      label = `${formatShortDate(urlFrom)} — ${formatShortDate(urlTo)}`;
    }
  } else if (urlFrom) {
    label = `от ${formatShortDate(urlFrom)}`;
  } else if (urlTo) {
    label = `до ${formatShortDate(urlTo)}`;
  }

  return (
    <div className={cn("relative z-20", isOpen && "z-50")} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-white/50 border flex items-center justify-between gap-2 px-4 md:px-5 py-3 rounded-xl shadow-sm transition-all font-bold text-sm text-slate-900 group",
          hasActiveDates
            ? "border-indigo-400 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50"
            : "border-slate-200 hover:bg-white hover:border-indigo-300"
        )}
      >
        <span className="truncate whitespace-nowrap">{label}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-all shrink-0",
            isOpen && "rotate-180",
            hasActiveDates && "text-indigo-500"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 min-w-[280px] sm:min-w-[340px] mt-1 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 z-[100] text-slate-800"
          >
            {/* Presets */}
            <div className="mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Быстрый выбор
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "today", label: "Сегодня" },
                  { id: "yesterday", label: "Вчера" },
                  { id: "7d", label: "7 дней" },
                  { id: "30d", label: "30 дней" },
                  { id: "month", label: "Этот месяц" },
                  { id: "all", label: "Всё время" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id as any)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-center truncate"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range Form */}
            <form onSubmit={handleApplyCustom} className="space-y-3 pt-3 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Интервал дат
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block ml-0.5">
                    От
                  </label>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block ml-0.5">
                    До
                  </label>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Применить
                </button>
                {hasActiveDates && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-2 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-black transition-all flex items-center gap-1"
                    title="Сбросить интервал"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Сброс
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
