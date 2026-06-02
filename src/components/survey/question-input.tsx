"use client";

import { StarRating } from "@/components/star-rating";

interface Q {
  id: string;
  text: string;
  type?: string;
  options?: string[];
}

// Renders the right control for a survey question by its type. RATING is the
// default (1-5 stars); NPS is a 0-10 scale; CHOICE / YESNO are button picks;
// TEXT is a free-text box.
export function QuestionInput({
  question,
  value,
  onChange,
  commentPlaceholder,
}: {
  question: Q;
  value: number | string | undefined;
  onChange: (val: number | string) => void;
  commentPlaceholder?: string;
}) {
  const type = question.type ?? "RATING";

  if (type === "NPS") {
    return (
      <div className="space-y-2">
        {/* 6 columns on phones (two tidy rows of 6+5, ~48px tap targets),
            all 11 in one row from sm up. grid-cols-11 alone gave ~30px
            buttons on a 375px screen — too small to tap reliably. */}
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 sm:gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Оценка ${n} из 10`}
              onClick={() => onChange(n)}
              className={`aspect-square rounded-xl text-sm font-black transition-all ${
                value === n
                  ? "premium-gradient text-white shadow-lg scale-105"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
          <span>Точно не порекомендую</span>
          <span>Точно порекомендую</span>
        </div>
      </div>
    );
  }

  if (type === "YESNO") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["Да", "Нет"].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`py-4 rounded-2xl font-black transition-all ${
              value === o
                ? "premium-gradient text-white shadow-lg"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (type === "CHOICE") {
    const opts = question.options ?? [];
    return (
      <div className="grid grid-cols-1 gap-2.5">
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`py-4 px-5 rounded-2xl font-bold text-left transition-all ${
              value === o
                ? "premium-gradient text-white shadow-lg"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (type === "TEXT") {
    return (
      <textarea
        rows={3}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={commentPlaceholder || "Ваш ответ..."}
        className="w-full p-5 rounded-2xl bg-slate-50/50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none font-medium placeholder:text-slate-400"
      />
    );
  }

  // RATING (default)
  return (
    <StarRating
      label={question.text}
      value={typeof value === "number" ? value : 0}
      onChange={(val) => onChange(val)}
    />
  );
}
