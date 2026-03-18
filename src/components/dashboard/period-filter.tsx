"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Check, Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const periods = [
  { label: "Всё время", value: "all" },
  { label: "30 дней", value: "30d" },
];

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentPeriod = searchParams.get("period") || "all";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const [startDate, setStartDate] = useState(from);
  const [endDate, setEndDate] = useState(to);
  const [showCustom, setShowCustom] = useState(currentPeriod === "custom");

  useEffect(() => {
    setStartDate(from);
    setEndDate(to);
    setShowCustom(currentPeriod === "custom");
  }, [from, to, currentPeriod]);

  const handlePeriodSelect = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    params.delete("from");
    params.delete("to");
    router.push(`?${params.toString()}`);
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
  };

  return (
    <div className="flex flex-col items-end gap-4">
      <div className="flex items-center gap-3">
        {/* Toggle Preset */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200/50 shadow-inner">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodSelect(p.value)}
              className={cn(
                "whitespace-nowrap px-6 py-2 rounded-xl text-sm font-black transition-all",
                (currentPeriod === p.value) 
                  ? "bg-white shadow-md text-indigo-600" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Calendar Button */}
        <button 
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "p-3 rounded-2xl transition-all border shrink-0",
            showCustom || currentPeriod === "custom"
              ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
              : "bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-500"
          )}
          title="Свой период"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Custom Date Picker Popover */}
      {showCustom && (
        <div className="glass p-6 rounded-3xl border-white/60 shadow-2xl animate-in fade-in slide-in-from-top-2 z-50">
          <div className="flex items-center justify-between mb-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Выбор периода</h4>
             <button onClick={() => setShowCustom(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row items-end gap-3">
             <div className="space-y-1.5 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">От</p>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none font-bold text-slate-700 text-xs focus:ring-2 focus:ring-indigo-500/10"
                />
             </div>
             <div className="space-y-1.5 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">До</p>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none font-bold text-slate-700 text-xs focus:ring-2 focus:ring-indigo-500/10"
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
