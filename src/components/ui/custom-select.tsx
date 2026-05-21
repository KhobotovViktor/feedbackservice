"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CustomSelect({ options, value, onChange, className, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    // While open, jump to z-50 so the dropdown's stacking context sits above
    // sibling elements that come later in the DOM (e.g. the modal's
    // Отмена/Сохранить buttons) — otherwise the bottom option overlaps a
    // button and the click is swallowed, so it can't be selected.
    <div className={cn("relative z-20", className, isOpen && "z-50")} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/50 border border-slate-200 flex items-center justify-between px-5 py-3 rounded-xl shadow-sm hover:bg-white hover:border-indigo-300 transition-all font-bold text-sm text-slate-900 group"
      >
        <span className="truncate">{selectedOption?.label || placeholder || "Выберите..."}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-all", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            // min-w-full keeps the menu at least as wide as the trigger, while
            // w-max + max-w let it grow to fit long option labels (branch names,
            // "Битрикс24 (Самара)" etc.) instead of truncating them. right-0
            // anchors it to the trigger's right edge so it doesn't overflow the
            // viewport for right-aligned filters.
            className="absolute top-full right-0 min-w-full w-max max-w-[min(20rem,80vw)] mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden py-1 z-[100]"
          >
            <div className="max-h-48 overflow-y-auto custom-scrollbar px-1.5 space-y-0.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 justify-between px-4 py-2 rounded-lg transition-all text-left font-bold text-xs",
                    value === option.value
                      ? "bg-indigo-500 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="whitespace-nowrap">{option.label}</span>
                  {value === option.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
