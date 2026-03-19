"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Settings, Building2, Star, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

interface Question {
  id: string;
  text: string;
  order: number;
  branchId: string | null;
}

interface Branch {
  id: string;
  name: string;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [adding, setAdding] = useState(false);
  const [minScore, setMinScore] = useState<number>(4);
  const [thresholdLoading, setThresholdLoading] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchQuestions();
    fetchThreshold();
  }, [selectedBranch]);

  const fetchThreshold = async () => {
    setThresholdLoading(true);
    try {
      if (selectedBranch === "all") {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setMinScore(parseFloat(data.review_min_score || "4"));
      } else {
        const res = await fetch(`/api/branches?id=${selectedBranch}`);
        const data = await res.json();
        // Since api/branches usually returns an array, find the one
        const branch = Array.isArray(data) ? data.find((b: any) => b.id === selectedBranch) : data;
        setMinScore(parseFloat(branch?.minScore || "4"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setThresholdLoading(false);
    }
  };

  const handleUpdateThreshold = async (score: number) => {
    setThresholdLoading(true);
    try {
      if (selectedBranch === "all") {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_min_score: score.toString() })
        });
      } else {
        await fetch(`/api/branches/${selectedBranch}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: branches.find(b => b.id === selectedBranch)?.name, minScore: score })
        });
      }
      setMinScore(score);
    } catch (e) {
      console.error(e);
    } finally {
      setThresholdLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBranches(data);
      } else {
        console.error("Branches API error:", data);
        setBranches([]);
      }
    } catch (err) {
      console.error(err);
      setBranches([]);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    const url = selectedBranch === "all" ? "/api/questions" : `/api/questions?branchId=${selectedBranch}`;
    const res = await fetch(url);
    const data = await res.json();
    setQuestions(data);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setAdding(true);
    await fetch("/api/questions", {
      method: "POST",
      body: JSON.stringify({ 
        text: newQuestion, 
        branchId: selectedBranch === "all" ? null : selectedBranch 
      }),
    });
    setNewQuestion("");
    await fetchQuestions();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот вопрос?")) return;
    await fetch(`/api/questions?id=${id}`, { method: "DELETE" });
    await fetchQuestions();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Вопросы</h1>
          <p className="text-slate-500 text-lg font-medium">Индивидуальная настройка опросников</p>
        </div>
        <div className="flex items-center gap-2 p-1.5 glass rounded-[1.5rem] w-full sm:w-auto border-white/50 shadow-xl shadow-indigo-500/5">
          <div className="flex-1 sm:flex-none flex items-center gap-3 px-6 py-3">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:inline">Филиал:</span>
          </div>
          <div className="flex-1 sm:flex-none">
            <CustomSelect 
              options={[
                { value: "all", label: "Все (общие)" },
                ...branches.map(b => ({ value: b.id, label: b.name }))
              ]}
              value={selectedBranch}
              onChange={(val) => setSelectedBranch(val)}
              placeholder="Выберите филиал"
              className="min-w-[180px]"
            />
          </div>
        </div>
      </div>

      {/* Threshold Setting */}
      <div className="bento-card p-8 md:p-10 bg-white/40 border-white/60 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-indigo-500 mb-2">
          <Star className="w-6 h-6" />
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Порог оценки для этого контекста</h3>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((score) => (
              <button
                key={score}
                onClick={() => handleUpdateThreshold(score)}
                disabled={thresholdLoading}
                className={cn(
                  "w-12 h-12 rounded-xl font-black transition-all border text-xs relative overflow-hidden",
                  minScore === score
                    ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                    : "bg-white text-slate-400 border-slate-200 hover:border-indigo-300"
                )}
              >
                {score}
              </button>
            ))}
            {thresholdLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500 ml-2" />}
          </div>
          <p className="text-[10px] text-slate-400 font-medium px-1">
            {selectedBranch === "all" 
              ? "Глобальная настройка: ссылки на карты будут показаны только если средний балл ≥ " + minScore
              : "Настройка для филиала: переопределяет глобальный порог. Сейчас: ≥ " + minScore}
          </p>
        </div>
      </div>

      <div className="bento-card p-8 md:p-12 shadow-sm border-white/40 bg-white/60">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 mb-12">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Введите текст вопроса для филиала..."
            className="flex-1 px-6 py-4 md:py-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm md:text-base font-bold placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={adding || !newQuestion.trim()}
            className="px-10 py-4 md:py-5 premium-gradient text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-sm md:text-base shadow-2xl shadow-indigo-500/20"
          >
            <Plus className="w-6 h-6" /> Добавить
          </button>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-indigo-500 w-16 h-16" /></div>
          ) : questions.length === 0 ? (
            <div className="py-32 text-center space-y-6">
               <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                  <MessageSquare className="w-10 h-10" />
               </div>
               <p className="text-slate-500 font-bold text-lg">Вопросы в этой категории не найдены</p>
            </div>
          ) : (
            <AnimatePresence>
              {questions.map((q) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-4 md:gap-6 p-6 md:p-8 rounded-[2rem] glass border-white/60 hover:border-indigo-100 hover:bg-white transition-all group shadow-sm"
                >
                  <div className="text-slate-200 group-hover:text-indigo-400 transition-colors shrink-0 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-lg md:text-xl tracking-tight leading-tight truncate pr-2">{q.text}</p>
                    {q.branchId && selectedBranch === "all" && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100/30">
                          {branches.find(b => b.id === q.branchId)?.name || "Филиал"}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-4 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all shrink-0 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
