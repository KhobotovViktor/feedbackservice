"use client";

import { useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ClearResultsButton() {
  const [isClearing, setIsClearing] = useState(false);
  const router = useRouter();

  const handleClear = async () => {
    if (!confirm("Вы уверены, что хотите полностью очистить результаты? Это действие необратимо.")) {
      return;
    }

    try {
      setIsClearing(true);
      const res = await fetch("/api/surveys", { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Ошибка при очистке данных");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <button 
      type="button"
      disabled={isClearing}
      className="flex items-center gap-3 px-6 py-4 bg-white hover:bg-rose-50 border border-slate-100 text-rose-500 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/5 group disabled:opacity-50"
      onClick={handleClear}
    >
      {isClearing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <TrendingUp className="w-4 h-4 text-rose-400 group-hover:scale-125 transition-transform" />
      )}
      {isClearing ? "Очистка..." : "Очистить"}
    </button>
  );
}
