"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Toggles `.dark` on <html> and persists the choice. The no-FOUC inline
// script in the root layout applies the saved theme before hydration.
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable — theme just won't persist
    }
  };

  if (variant === "full") {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all font-bold w-full"
      >
        {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        {dark ? "Светлая тема" : "Тёмная тема"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all shrink-0 mx-auto"
    >
      {dark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
    </button>
  );
}
