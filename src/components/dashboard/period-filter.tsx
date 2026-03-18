"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const periods = [
  { label: "Всё время", value: "all" },
  { label: "Последние 30 дней", value: "30d" },
  { label: "Свой период", value: "custom" },
];

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentPeriod = searchParams.get("period") || "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [startDate, setStartDate] = useState(from || "");
  const [endDate, setEndDate] = useState(to || "");

  const handlePeriodSelect = (value: string) => {
    if (value !== "custom") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", value);
      params.delete("from");
      params.delete("to");
      router.push(`?${params.toString()}`);
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    if (startDate) params.set("from", startDate);
    else params.delete("from");
    if (endDate) params.set("to", endDate);
    else params.delete("to");
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const getActiveLabel = () => {
    if (currentPeriod === "custom") {
      if (from && to) return `${format(new Date(from), "dd.MM.yy")} - ${format(new Date(to), "dd.MM.yy")}`;
      if (from) return `С ${format(new Date(from), "dd.MM.yy")}`;
      if (to) return `По ${format(new Date(to), "dd.MM.yy")}`;
      return "Свой период";
    }
    return periods.find(p => p.value === currentPeriod)?.label || "Всё время";
  };

  return (
    <div className="relative">
      <div className="flex gap-2 p-1.5 glass rounded-2xl w-fit border-white/50">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodSelect(p.value)}
            className={cn(
              "whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all",
              (currentPeriod === p.value) 
                ? "bg-white shadow-xl shadow-indigo-500/10 text-indigo-600" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Picker Popover */}
      {currentPeriod === "custom" && (
        <div className="mt-4 p-6 glass rounded-3xl border-white/50 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row items-end gap-4">
             <div className="space-y-2 flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Начало</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/50 border border-white/20 rounded-xl px-4 py-2.5 outline-none font-bold text-slate-700"
                />
             </div>
             <div className="space-y-2 flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Конец</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/50 border border-white/20 rounded-xl px-4 py-2.5 outline-none font-bold text-slate-700"
                />
             </div>
             <button 
                type="submit"
                className="bg-indigo-500 text-white p-3 rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
             >
                <Check className="w-5 h-5" />
             </button>
          </form>
        </div>
      )}
    </div>
  );
}
