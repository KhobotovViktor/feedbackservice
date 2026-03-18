"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Settings, Building2, Star, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      setBranches(data);
    } catch (err) {
      console.error(err);
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
          <select 
            className="flex-1 sm:flex-none bg-white border-none px-6 py-3 rounded-xl font-black outline-none shadow-sm text-xs md:text-sm appearance-none cursor-pointer hover:bg-slate-50 transition-all"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Все (общие)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
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
