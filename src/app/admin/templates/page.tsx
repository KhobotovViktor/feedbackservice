"use client";

import { useState, useEffect } from "react";
import { Plus, LayoutDashboard, Settings, Loader2, Trash2, Edit2, Check, Building2, ChevronLeft, Star, Flag, Smile, Frown, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

interface Template {
  id: string;
  name: string;
  minScore: number;
  startTitle?: string | null;
  startSubtitle?: string | null;
  lowTitle?: string | null;
  lowSubtitle?: string | null;
  commentPlaceholder?: string | null;
  successTitle?: string | null;
  successPositive?: string | null;
  successNegative?: string | null;
  reviewPrompt?: string | null;
  surveyFrequencyHours?: number;
  _count?: { questions: number; branches: number };
}

interface Question {
  id: string;
  text: string;
  order: number;
  type?: string;
  options?: string[];
  showIf?: string | null;
}

const QUESTION_TYPES = [
  { value: "RATING", label: "Звёзды 1–5" },
  { value: "NPS", label: "NPS 0–10" },
  { value: "CHOICE", label: "Выбор варианта" },
  { value: "YESNO", label: "Да / Нет" },
  { value: "TEXT", label: "Свободный текст" },
];

const SHOWIF_OPTIONS = [
  { value: "always", label: "Показывать всегда" },
  { value: "negative", label: "Только при низкой оценке" },
  { value: "positive", label: "Только при высокой оценке" },
];

const QUESTION_TYPE_LABEL: Record<string, string> = {
  RATING: "Звёзды",
  NPS: "NPS",
  CHOICE: "Выбор",
  YESNO: "Да/Нет",
  TEXT: "Текст",
};

interface SlideField {
  key: string;
  label: string;
  ph: string;
  multiline?: boolean;
}

// Slide-text fields grouped by survey stage so admins set them in the order a
// client experiences them: Старт → Позитив (финал) → Негатив. Each group is
// rendered as its own visually separated card.
const SLIDE_GROUPS: {
  key: string;
  title: string;
  desc: string;
  icon: typeof Flag;
  accent: { badge: string; ring: string };
  fields: SlideField[];
}[] = [
  {
    key: "start",
    title: "Старт",
    desc: "Первый экран, который видит клиент",
    icon: Flag,
    accent: { badge: "bg-indigo-50 text-indigo-600 border-indigo-100", ring: "ring-indigo-100/70" },
    fields: [
      { key: "startTitle", label: "Заголовок", ph: "Ваше мнение имеет значение" },
      { key: "startSubtitle", label: "Подзаголовок", ph: "(необязательно)" },
    ],
  },
  {
    key: "positive",
    title: "Позитив",
    desc: "Финальный экран при высокой оценке",
    icon: Smile,
    accent: { badge: "bg-emerald-50 text-emerald-600 border-emerald-100", ring: "ring-emerald-100/70" },
    fields: [
      { key: "successTitle", label: "Заголовок финального слайда", ph: "Огромное спасибо!" },
      { key: "successPositive", label: "Текст благодарности", ph: "Мы счастливы, что вам понравилось! Ваша оценка вдохновляет нашу команду.", multiline: true },
      { key: "reviewPrompt", label: "Призыв оставить отзыв на картах", ph: "Будем очень признательны за отзыв на картах:" },
    ],
  },
  {
    key: "negative",
    title: "Негатив",
    desc: "Экраны при низкой оценке",
    icon: Frown,
    accent: { badge: "bg-rose-50 text-rose-600 border-rose-100", ring: "ring-rose-100/70" },
    fields: [
      { key: "lowTitle", label: "Заголовок слайда", ph: "Расскажите, что вам не понравилось." },
      { key: "lowSubtitle", label: "Подзаголовок слайда", ph: "Оставьте отзыв и получите 500 бонусов! Для начисления бонусов обратитесь к менеджеру.", multiline: true },
      { key: "commentPlaceholder", label: "Плейсхолдер поля комментария", ph: "Расскажите подробнее о вашем опыте..." },
      { key: "successNegative", label: "Текст благодарности", ph: "Мы получили ваш отзыв и уже работаем над тем, чтобы исправить ситуацию.", multiline: true },
    ],
  },
];

const FREQUENCY_OPTIONS = [
  { value: "0", label: "Без ограничений" },
  { value: "24", label: "Раз в 24 часа" },
  { value: "48", label: "Раз в 48 часов" },
  { value: "72", label: "Раз в 72 часа" },
  { value: "168", label: "Раз в неделю" },
  { value: "720", label: "Раз в месяц" },
  { value: "4320", label: "Раз в полгода" },
  { value: "8760", label: "Раз в год" },
];

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
  const [newQuestionType, setNewQuestionType] = useState("RATING");
  const [newQuestionOptions, setNewQuestionOptions] = useState("");
  const [newQuestionShowIf, setNewQuestionShowIf] = useState("always");

  const [view, setView] = useState<"list" | "detail">("list");
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMinScore, setEditMinScore] = useState("4.0");
  // Slide texts + retake frequency for the selected template.
  const [slide, setSlide] = useState<Record<string, string>>({});
  const [freq, setFreq] = useState(0);
  const [savingSlide, setSavingSlide] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      // Guard against {error} responses — .map() in the JSX would crash
      // the page if we let a non-array through.
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchTemplates failed:", err);
      setTemplates([]);
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
        setNewTemplateMinScore("4.0");
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
      const options =
        newQuestionType === "CHOICE"
          ? newQuestionOptions.split("\n").map((s) => s.trim()).filter(Boolean)
          : [];
      const res = await fetch("/api/templates/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newQuestionText,
          templateId: selectedTemplate.id,
          order: questions.length,
          type: newQuestionType,
          options,
          showIf: newQuestionShowIf === "always" ? null : newQuestionShowIf,
        }),
      });
      if (res.ok) {
        setNewQuestionText("");
        setNewQuestionType("RATING");
        setNewQuestionOptions("");
        setNewQuestionShowIf("always");
        fetchQuestions(selectedTemplate.id);
        fetchTemplates(); // To update question count
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditName(template.name);
    setEditMinScore(template.minScore.toString());
    setEditingMetadata(false);
    setSlide({
      startTitle: template.startTitle || "",
      startSubtitle: template.startSubtitle || "",
      lowTitle: template.lowTitle || "",
      lowSubtitle: template.lowSubtitle || "",
      commentPlaceholder: template.commentPlaceholder || "",
      successTitle: template.successTitle || "",
      successPositive: template.successPositive || "",
      successNegative: template.successNegative || "",
      reviewPrompt: template.reviewPrompt || "",
    });
    setFreq(template.surveyFrequencyHours || 0);
    fetchQuestions(template.id);
    setView("detail");
  };

  const handleSaveSlide = async () => {
    if (!selectedTemplate) return;
    setSavingSlide(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...slide, surveyFrequencyHours: freq }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedTemplate(updated);
        fetchTemplates();
        alert("Оформление сохранено");
      } else {
        alert("Не удалось сохранить оформление");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setSavingSlide(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedTemplate || !editName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          minScore: parseFloat(editMinScore)
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedTemplate(updated);
        setEditingMetadata(false);
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
                    "w-full p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border transition-all text-left flex justify-between items-center group",
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
            <div className="bento-card bg-white/60 p-6 md:p-12 space-y-8 md:space-y-10 min-h-[500px] md:min-h-[600px] flex flex-col">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setView("list")}
                  className="lg:hidden p-3 glass border-white/60 rounded-2xl text-slate-500 hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="min-w-0 flex-1">
                  {editingMetadata ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Название шаблона</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Порог оценки</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              step="0.1"
                              min="1"
                              max="5"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold pr-10"
                              value={editMinScore}
                              onChange={e => setEditMinScore(e.target.value)}
                            />
                            <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400" />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setEditingMetadata(false)}
                          className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all text-xs"
                        >
                          Отмена
                        </button>
                        <button 
                          onClick={handleSaveMetadata}
                          disabled={saving || !editName}
                          className="px-6 py-2 premium-gradient text-white rounded-xl font-black shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 text-xs"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[9px] font-black text-indigo-500 uppercase tracking-widest border border-indigo-100/50">
                          Active Template
                        </div>
                        <button 
                          onClick={() => setEditingMetadata(true)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Редактировать название и порог"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight break-words overflow-hidden">{selectedTemplate.name}</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-slate-500 font-medium text-xs md:text-base">Управление вопросами для связанных филиалов</p>
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100 shrink-0">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-black text-amber-700">{selectedTemplate.minScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6 flex-1 flex flex-col">
                <div className="space-y-3 p-5 rounded-2xl bg-white/50 ring-1 ring-inset ring-slate-100">
                  <input
                    type="text"
                    placeholder="Текст нового вопроса..."
                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                    value={newQuestionText}
                    onChange={e => setNewQuestionText(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && newQuestionType !== "CHOICE" && handleAddQuestion()}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Тип ответа</label>
                      <CustomSelect value={newQuestionType} onChange={setNewQuestionType} options={QUESTION_TYPES} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Когда показывать</label>
                      <CustomSelect value={newQuestionShowIf} onChange={setNewQuestionShowIf} options={SHOWIF_OPTIONS} />
                    </div>
                  </div>
                  {newQuestionType === "CHOICE" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Варианты (по одному на строку)</label>
                      <textarea
                        rows={3}
                        placeholder={"Качество товара\nРабота менеджера\nДоставка"}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium resize-none"
                        value={newQuestionOptions}
                        onChange={e => setNewQuestionOptions(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    onClick={handleAddQuestion}
                    disabled={!newQuestionText || (newQuestionType === "CHOICE" && newQuestionOptions.split("\n").map(s => s.trim()).filter(Boolean).length < 2)}
                    className="w-full px-8 py-4 premium-gradient text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-500/20 disabled:opacity-50 text-sm"
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
                          <div className="flex items-center gap-3 md:gap-5 min-w-0 pr-2">
                            <span className="shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-[10px] md:text-xs font-black text-slate-900 shadow-sm">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-slate-800 font-bold text-sm md:text-lg leading-snug break-words overflow-hidden">{q.text}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-500 border border-indigo-100/50 uppercase tracking-wider">
                                  {QUESTION_TYPE_LABEL[q.type ?? "RATING"] ?? "Звёзды"}
                                </span>
                                {q.showIf && (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100/50 uppercase tracking-wider">
                                    {q.showIf === "negative" ? "при низкой оценке" : "при высокой оценке"}
                                  </span>
                                )}
                              </div>
                            </div>
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

              {/* Slide texts + retake frequency */}
              <div className="space-y-5 pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Тексты слайдов и частота</h3>
                  <button
                    onClick={handleSaveSlide}
                    disabled={savingSlide}
                    className="px-6 py-2.5 premium-gradient text-white rounded-xl font-black shadow-lg shadow-indigo-500/10 disabled:opacity-50 flex items-center gap-2 text-xs"
                  >
                    {savingSlide ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Сохранить оформление
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Пустые поля используют тексты по умолчанию (показаны серым в каждом поле).
                </p>

                <div className="space-y-4">
                  {SLIDE_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div
                        key={group.key}
                        className={cn(
                          "rounded-2xl bg-white/50 p-5 space-y-4 ring-1 ring-inset",
                          group.accent.ring
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border shrink-0", group.accent.badge)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-900 tracking-tight">{group.title}</h4>
                            <p className="text-[11px] text-slate-400 font-medium leading-tight">{group.desc}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {group.fields.map((f) => (
                            <div key={f.key} className={cn("space-y-1", f.multiline && "md:col-span-2")}>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{f.label}</label>
                              {f.multiline ? (
                                <textarea
                                  rows={2}
                                  placeholder={f.ph}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold resize-none"
                                  value={slide[f.key] || ""}
                                  onChange={(e) => setSlide((s) => ({ ...s, [f.key]: e.target.value }))}
                                />
                              ) : (
                                <input
                                  type="text"
                                  placeholder={f.ph}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                                  value={slide[f.key] || ""}
                                  onChange={(e) => setSlide((s) => ({ ...s, [f.key]: e.target.value }))}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-2xl bg-white/50 p-5 space-y-4 ring-1 ring-inset ring-violet-100/70">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-violet-50 text-violet-600 border-violet-100 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">Частота прохождения</h4>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Как часто клиент может проходить опрос</p>
                      </div>
                    </div>
                    <CustomSelect
                      className="max-w-xs"
                      value={String(freq)}
                      onChange={(v) => setFreq(parseInt(v, 10))}
                      options={FREQUENCY_OPTIONS}
                    />
                  </div>
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
