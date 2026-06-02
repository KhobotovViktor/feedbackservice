"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

// Free-text search over comment / client / deal id / responsible / phone.
// Submits on Enter or button press (not per-keystroke) since the Results page
// is server-rendered — every push refetches the table.
export function ResultsSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  const apply = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page"); // back to first page on a new search
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply(value);
        }}
        placeholder="Поиск: текст, клиент, № сделки…"
        aria-label="Поиск по результатам"
        className="w-full pl-11 pr-9 py-3 rounded-2xl border border-white/50 glass text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-xl shadow-indigo-500/5"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply("");
          }}
          aria-label="Очистить поиск"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
