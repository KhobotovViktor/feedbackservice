"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  id: string;
  text: string;
  order: number;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const res = await fetch("/api/questions");
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
      body: JSON.stringify({ text: newQuestion }),
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Управление вопросами</h1>
          <p className="text-slate-500">Настройте опросник для ваших клиентов</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <form onSubmit={handleAdd} className="flex gap-4 mb-8">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Введите текст вопроса..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={adding || !newQuestion.trim()}
            className="px-6 py-3 premium-gradient text-white rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Plus className="w-5 h-5" /> Добавить
          </button>
        </form>

        <div className="space-y-3">
          <AnimatePresence>
            {questions.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
              >
                <div className="text-slate-300 group-hover:text-indigo-300 transition-colors">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{q.text}</p>
                </div>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
