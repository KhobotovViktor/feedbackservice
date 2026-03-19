"use client";

import { useState, useEffect } from "react";
import { Plus, LayoutDashboard, Settings, Loader2, Trash2, Edit2, X, Check, Building2, ChevronLeft, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  minScore: number;
  _count?: { questions: number; branches: number };
}

interface Question {
  id: string;
  text: string;
  order: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateMinScore, setNewTemplateMinScore] = useState("4.0");
  const [saving, setSaving] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");

  const [view, setView] = useState<"list" | "detail">("list");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplateName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newTemplateName,
          minScore: parseFloat(newTemplateMinScore)
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewTemplateName("");
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Вы уверены? Это приведет к отвязке филиалов от этого шаблона.")) return;
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setView("list");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestions = async (templateId: string) => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/templates/questions?templateId=${templateId}`);
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText || !selectedTemplate) return;
    try {
      const res = await fetch("/api/templates/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: newQuestionText, 
          templateId: selectedTemplate.id,
          order: questions.length 
        }),
      });
      if (res.ok) {
        setNewQuestionText("");
        fetchQuestions(selectedTemplate.id);
        fetchTemplates(); // To update question count
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    fetchQuestions(template.id);
    setView("detail");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Шаблоны</h1>
          <p className="text-slate-500 text-lg font-medium">Конструктор универсальных наборов вопросов</p>
        </div>
        <button 
          onClick={() => {
            setShowAdd(true);
            setSelectedTemplate(null);
            setView("list");
          }}
          className="flex items-center justify-center gap-2 px-8 py-4 premium-gradient text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all w-full sm:w-auto"
        >
          <Plus className="w-6 h-6" />
          Создать шаблон
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-8 md:p-12 rounded-[3.5rem] border-white/60 shadow-2xl space-y-8 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100">
                <LayoutDashboard className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Новый шаблон</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Название шаблона</label>
                <input 
                  type="text" 
                  placeholder="Напр: Общий стандарт сервиса"
                  className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Порог положительной оценки (1-5)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    min="1"
                    max="5"
                    className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold pr-10"
                    value={newTemplateMinScore}
                    onChange={e => setNewTemplateMinScore(e.target.value)}
                  />
                  <Star className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 relative z-10">
              <button 
                onClick={() => setShowAdd(false)}
                className="order-2 sm:order-1 px-8 py-4 text-slate-500 font-bold hover:bg-white/50 rounded-2xl transition-all text-sm"
              >
                Отмена
              </button>
              <button 
                onClick={handleAddTemplate}
                disabled={saving || !newTemplateName}
                className="order-1 sm:order-2 px-10 py-4 premium-gradient text-white rounded-2xl font-black shadow-2xl shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Создать шаблон"}
              </button>
            </div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] -mr-48 -mt-48 rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={cn("lg:col-span-1 space-y-4", view === "detail" && "hidden lg:block")}>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Список шаблонов</h3>
          <div className="space-y-4">
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>
            ) : templates.length === 0 ? (
              <div className="bento-card border-dashed border-slate-200 py-12 text-center text-slate-400 text-sm font-medium">
                Шаблонов пока нет
              </div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "w-full p-6 p-8 rounded-[2.5rem] border transition-all text-left flex justify-between items-center group",
                    selectedTemplate?.id === template.id 
                      ? "glass-dark text-white border-white/5 shadow-2xl shadow-indigo-500/20" 
                      : "glass hover:bg-white/80 border-white/40 shadow-sm"
                  )}
                >
                  <div className="space-y-2 min-w-0 pr-2">
                    <p className={cn("font-black text-xl tracking-tight truncate", selectedTemplate?.id === template.id ? "text-white" : "text-slate-900")}>
                      {template.name}
                    </p>
                    <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest opacity-60">
                      <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> {template._count?.questions || 0} вопросов</span>
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {template._count?.branches || 0} филиалов</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className={cn(
                      "p-3 rounded-xl transition-all lg:opacity-0 lg:group-hover:opacity-100",
                      selectedTemplate?.id === template.id ? "text-white/40 hover:text-rose-400 hover:bg-white/10" : "text-slate-300 hover:text-red-500 hover:bg-red-50"
                    )}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={cn("lg:col-span-2", view === "list" && "hidden lg:block")}>
          {selectedTemplate ? (
            <div className="bento-card bg-white/60 p-8 md:p-12 space-y-10 min-h-[600px] flex flex-col">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setView("list")}
                  className="lg:hidden p-3 glass border-white/60 rounded-2xl text-slate-500 hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="min-w-0">
                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2 border border-indigo-100/50">
                      Active Template
                   </div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter truncate leading-tight">{selectedTemplate.name}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-slate-500 font-medium text-sm md:text-base">Управление вопросами для связанных филиалов</p>
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-black text-amber-700">{selectedTemplate.minScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    placeholder="Добавить новый вопрос..."
                    className="flex-1 px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                    value={newQuestionText}
                    onChange={e => setNewQuestionText(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && handleAddQuestion()}
                  />
                  <button 
                    onClick={handleAddQuestion}
                    disabled={!newQuestionText}
                    className="px-8 py-4 premium-gradient text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-500/20 disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Добавить в список
                  </button>
                </div>

                <div className="space-y-3 pt-6 flex-1">
                  {loadingQuestions ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>
                  ) : questions.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-medium italic">В этом шаблоне пока нет вопросов</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {questions.map((q, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={q.id} 
                          className="flex items-center justify-between p-5 glass border-white/60 rounded-2xl group hover:bg-white transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-5 min-w-0 pr-2">
                            <span className="shrink-0 w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-900 shadow-sm">
                              {idx + 1}
                            </span>
                            <p className="text-slate-800 font-bold text-base md:text-lg leading-snug truncate">{q.text}</p>
                          </div>
                          <button 
                            onClick={async () => {
                              await fetch(`/api/questions?id=${q.id}`, { method: "DELETE" });
                              fetchQuestions(selectedTemplate.id);
                              fetchTemplates();
                            }}
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all lg:opacity-0 lg:group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bento-card flex flex-col items-center justify-center py-40 bg-white/20 border-dashed space-y-8">
              <div className="w-24 h-24 glass border-white/60 rounded-[2.5rem] flex items-center justify-center text-slate-300 relative">
                <Settings className="w-10 h-10" />
                <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-full"></div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Выберите шаблон</h3>
                <p className="text-slate-500 font-medium max-w-xs mx-auto">Выберите существующий шаблон или создайте новый для настройки опросника</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
