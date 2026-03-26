"use client";

import { useState, useEffect } from "react";
import { 
  QrCode, X, Copy, Download, LayoutDashboard, Star, Printer, Play,
  TrendingUp, BarChart3, Plus, Loader2, Building2, MapPin, Trash2, 
  Settings, Bot, ExternalLink, Zap, AlertTriangle
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

interface RatingHistory {
  id: string;
  service: string;
  rating: number;
  reviewCount: number;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
  city: string | null;
  yandexUrl: string | null;
  dgisUrl: string | null;
  googleUrl: string | null;
  externalId: string | null;
  templateId?: string | null;
  template?: { name: string } | null;
  averageScore?: string;
  ratingHistory?: RatingHistory[];
  _count?: { questions: number; surveyResponses: number };
}

interface QuestionTemplate {
  id: string;
  name: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: "",
    city: "",
    yandexUrl: "",
    dgisUrl: "",
    googleUrl: "",
    externalId: "",
    templateId: ""
  });

  const [showAutomationHub, setShowAutomationHub] = useState(false);
  const [supabaseKey, setSupabaseKey] = useState("");
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [selectedForQR, setSelectedForQR] = useState<Branch | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Record<string, string>>({});
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://alleyafeedbackservice.vercel.app';

  const METRIC_OPTIONS = [
    { label: "Рейтинг Яндекс", value: "yandex-rating" },
    { label: "Отзывы Яндекс", value: "yandex-reviewCount" },
    { label: "Рейтинг 2ГИС", value: "2gis-rating" },
    { label: "Отзывы 2ГИС", value: "2gis-reviewCount" },
    { label: "Рейтинг Google", value: "google-rating" },
    { label: "Отзывы Google", value: "google-reviewCount" },
  ];

  useEffect(() => {
    fetchBranches();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`/api/branches?t=${Date.now()}`);
      const data = await res.json();
      if (data.branches && Array.isArray(data.branches)) {
        setBranches(data.branches);
      } else if (Array.isArray(data)) {
        setBranches(data);
      } else {
        console.error("Branches API error:", data);
        setBranches([]);
      }
    } catch (err) {
      console.error(err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (branch: Branch) => {
    setEditingBranch(branch);
    setNewBranch({
      name: branch.name,
      city: branch.city || "",
      yandexUrl: branch.yandexUrl || "",
      dgisUrl: branch.dgisUrl || "",
      googleUrl: branch.googleUrl || "",
      externalId: branch.externalId || "",
      templateId: branch.templateId || ""
    });
    setShowAdd(true);
  };

  const handleSaveBranch = async () => {
    if (!newBranch.name) return;
    setSaving(true);
    try {
      const url = editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches";
      const method = editingBranch ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBranch),
      });
      if (res.ok) {
        setShowAdd(false);
        setEditingBranch(null);
        setNewBranch({ name: "", city: "", yandexUrl: "", dgisUrl: "", googleUrl: "", externalId: "", templateId: "" });
        fetchBranches();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить филиал "${name}"? Это удалит все связанные вопросы и отзывы.`)) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
      if (res.ok) fetchBranches();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateGASScript = () => {
    const supabaseProjectId = "wzwiuveclaldltkthbhl";
    const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;
    const sKey = supabaseKey || "ВСТАВЬТЕ_SUPABASE_SERVICE_ROLE_KEY";
    
    const branchesJson = JSON.stringify(branches.map(b => ({
      id: b.id,
      name: b.name,
      yandex: b.yandexUrl || '',
      googleSearch: b.name + " отзывы",
      dgis: b.dgisUrl || ''
    })));

    const scriptLines = [
      '// --- Alleya Feedback: Direct Supabase Sync ---',
      '// Записывает данные НАПРЯМУЮ в Supabase, минуя Vercel.',
      '',
      'function syncAllRatings() {',
      '  const SUPABASE_URL = "' + supabaseUrl + '";',
      '  const SUPABASE_KEY = "' + sKey + '";',
      '  const SCRAPER_KEY = "06eeb0519264e083ad4b9da58a7f6902";',
      '  const branches = ' + branchesJson + ';',
      '',
      '  branches.forEach(function(branch) {',
      '    console.log("--- Синхронизация: " + branch.name + " ---");',
      '    if (branch.yandex) syncService(branch.id, "yandex", branch.yandex, SUPABASE_URL, SUPABASE_KEY, SCRAPER_KEY);',
      '    if (branch.googleSearch) {',
      '      var gUrl = "https://www.google.com/search?q=" + encodeURIComponent(branch.googleSearch) + "&hl=ru";',
      '      syncService(branch.id, "google", gUrl, SUPABASE_URL, SUPABASE_KEY, SCRAPER_KEY);',
      '    }',
      '    if (branch.dgis) syncService(branch.id, "2gis", branch.dgis, SUPABASE_URL, SUPABASE_KEY, SCRAPER_KEY);',
      '  });',
      '}',
      '',
      'function syncService(branchId, service, url, supabaseUrl, supabaseKey, scraperKey) {',
      '  if (!url || !supabaseUrl) {',
      '    console.warn("⚠️ [" + (service || "UNKNOWN") + "] Пропуск: Отсутствует URL.");',
      '    return;',
      '  }',
      '  try {',
      '    const options = {',
      '      muteHttpExceptions: true,',
      '      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }',
      '    };',
      '    ',
      '    let finalUrl = url;',
      '    if (service === "google" && scraperKey) {',
      '      finalUrl = "http://api.scraperapi.com/?api_key=" + scraperKey + "&country_code=ru&url=" + encodeURIComponent(url);',
      '    }',
      '',
      '    let response;',
      '    let retries = 2;',
      '    while(retries > 0) {',
      '      response = UrlFetchApp.fetch(finalUrl, options);',
      '      if (response.getResponseCode() === 200) break;',
      '      if (response.getResponseCode() >= 500) {',
      '        console.warn("⚠️ [" + (service || "UNKNOWN") + "] Код " + response.getResponseCode() + ". Повтор через 1 сек...");',
      '        Utilities.sleep(1000);',
      '        retries--;',
      '      } else {',
      '        break;',
      '      }',
      '    }',
      '',
      '    if (response.getResponseCode() !== 200) {',
      '      console.warn("❌ [" + (service || "UNKNOWN") + "] Ошибка извлечения: Код " + response.getResponseCode());',
      '      return;',
      '    }',
      '',
      '    const html = response.getContentText();',
      '    let rating = null, count = null;',
      '',
      '    if (service === "yandex") {',
      '      const rMatch = html.match(/ratingValue["\']:\\s*["\']?([0-9.]+)/) || html.match(/class=\\s*["\']?business-rating-badge-view__rating-value["\']?\\s*>([0-9.]+)/) || html.match(/rating-text">([0-9.]+)/);',
      '      const cMatch = html.match(/reviewCount["\']:\\s*["\']?(\\d+)/) || html.match(/class=\\s*["\']?business-rating-amount-view["\']?\\s*>(\\d+)/) || html.match(/rating-count">(\d+)/);',
      '      if (rMatch) rating = rMatch[1];',
      '      if (cMatch) count = cMatch[1];',
      '    } else if (service === "google") {',
      '      // Google SERP: specifically match "N отзывов в Google" to avoid Yandex data',
      '      var gBlock = html.match(/(\\d[\\.,]\\d)[\\s\\S]{0,200}?(\\d[\\s\\d]*)\\s*отзыв\\S*\\s+в\\s+Google/);',
      '      if (gBlock) { rating = gBlock[1].replace(",", "."); count = gBlock[2].replace(/\\D/g, ""); }',
      '      // Fallback: generic patterns',
      '      if (!rating) {',
      '        var rMatch = html.match(/data-rating="(\\d[\\.,]\\d)"/) || html.match(/aria-label="[^"]*?(\\d[\\.,]\\d)\\s/);',
      '        var cMatch = html.match(/(\\d+)\\s+Google\\s+reviews/) || html.match(/(\\d+)\\s*отзыв/);',
      '        if (rMatch) rating = rMatch[1].replace(",", ".");',
      '        if (cMatch) count = cMatch[1].replace(/\\D/g, "");',
      '      }',
      '    } else if (service === "2gis") {',
      '      // 2GIS: primary — og:description meta tag ("Оценка X.X ... N отзыв")',
      '      var ogMatch = html.match(/content="[^"]*Оценка\\s*(\\d[\\.,]\\d)[^"]*?(\\d+)\\s*отзыв/);',
      '      if (ogMatch) { rating = ogMatch[1].replace(",", "."); count = ogMatch[2]; }',
      '      // Fallback 1: JSON-LD schema.org',
      '      if (!rating) {',
      '        var rMatch = html.match(/"ratingValue"\\s*:\\s*"?(\\d[\\.,]?\\d*)/);',
      '        var cMatch = html.match(/"reviewCount"\\s*:\\s*"?(\\d+)/);',
      '        if (rMatch) rating = rMatch[1].replace(",", ".");',
      '        if (cMatch) count = cMatch[1];',
      '      }',
      '      // Fallback 2: text patterns',
      '      if (!rating) {',
      '        var rMatch2 = html.match(/>(\\d[\\.,]\\d)<\\/span>/);',
      '        var cMatch2 = html.match(/>(\\d+)\\s*оцен\\S*/);',
      '        if (rMatch2) rating = rMatch2[1].replace(",", ".");',
      '        if (cMatch2) count = cMatch2[1];',
      '      }',
      '    }',
      '',
      '    if (!rating) {',
      '      console.warn("❌ [" + service.toUpperCase() + "] Данные не найдены на странице.");',
      '      return;',
      '    }',
      '',
      '    // Округление до 1 знака (фикс 4.5999...)',
      '    rating = Math.round(parseFloat(rating) * 10) / 10;',
      '    console.log("📍 [" + service.toUpperCase() + "] Найдено: " + rating + " (" + (count || 0) + " отз.)");',
      '',
      '    // Запись напрямую в Supabase (минуя Vercel)',
      '    const payload = {',
      '      id: Utilities.getUuid(),',
      '      branchId: branchId,',
      '      service: service,',
      '      rating: parseFloat(rating),',
      '      reviewCount: parseInt(count || 0),',
      '      createdAt: new Date().toISOString()',
      '    };',
      '',
      '    const resp = UrlFetchApp.fetch(supabaseUrl + "/rest/v1/RatingHistory", {',
      '      method: "POST",',
      '      contentType: "application/json",',
      '      headers: {',
      '        "apikey": supabaseKey,',
      '        "Authorization": "Bearer " + supabaseKey,',
      '        "Prefer": "return=representation"',
      '      },',
      '      payload: JSON.stringify(payload),',
      '      muteHttpExceptions: true',
      '    });',
      '',
      '    if (resp.getResponseCode() === 201 || resp.getResponseCode() === 200) {',
      '      console.log("✅ [" + service.toUpperCase() + "] Записано в Supabase: " + rating + " (" + (count || 0) + " отз.)");',
      '    } else {',
      '      console.error("❌ [" + service.toUpperCase() + "] Ошибка Supabase: " + resp.getResponseCode());',
      '      console.error("   " + resp.getContentText().substring(0, 200));',
      '    }',
      '  } catch (e) {',
      '    console.error("🛑 Критическая ошибка " + service + ": " + e.toString());',
      '  }',
      '}'
    ];

    return scriptLines.join('\\n');
  };

  const handleTestSurvey = (branchId: string) => {
    window.open(`/survey/qr?branchId=${branchId}&test=true`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Управление филиалами</h1>
          <p className="text-slate-500 text-sm font-medium">Настройка мониторинга и опросных листов</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowAutomationHub(true)}
            className="px-4 md:px-6 py-3 bg-white border border-slate-100 text-indigo-500 rounded-2xl font-black shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all text-xs md:text-sm flex-1 sm:flex-none"
          >
            <Zap className="w-4 h-4" />
            <span className="hidden xs:inline">Автоматизация</span>
            <span className="xs:hidden">Хаб</span>
          </button>
          <button 
            onClick={() => {
              setEditingBranch(null);
              setNewBranch({ name: "", city: "", yandexUrl: "", dgisUrl: "", googleUrl: "", externalId: "", templateId: "" });
              setShowAdd(true);
            }}
            className="px-4 md:px-6 py-3 premium-gradient text-white rounded-2xl font-black shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-xs md:text-sm flex-1 sm:flex-none"
          >
            <Plus className="w-5 h-5 text-white/80" />
            Добавить
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-8 md:p-12 rounded-[3.5rem] border-white/60 shadow-2xl space-y-8 relative overflow-hidden"
          >
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {editingBranch ? "Редактировать филиал" : "Новый филиал"}
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-30">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Название</label>
                <input 
                  type="text" 
                  placeholder="Напр: Аллея Мебели Глобус"
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.name}
                  onChange={e => setNewBranch({...newBranch, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Город</label>
                <input 
                  type="text" 
                  placeholder="Напр: Владимир"
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.city}
                  onChange={e => setNewBranch({...newBranch, city: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID в Bitrix24</label>
                <input 
                  type="text" 
                  placeholder="Напр: BRANCH_123"
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.externalId}
                  onChange={e => setNewBranch({...newBranch, externalId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Яндекс Карты</label>
                <input 
                  type="text" 
                  placeholder="https://yandex.ru/maps/..."
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.yandexUrl}
                  onChange={e => setNewBranch({...newBranch, yandexUrl: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">2GIS</label>
                <input 
                  type="text" 
                  placeholder="https://2gis.ru/..."
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.dgisUrl}
                  onChange={e => setNewBranch({...newBranch, dgisUrl: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Google Maps</label>
                <input 
                  type="text" 
                  placeholder="https://goo.gl/maps/..."
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                  value={newBranch.googleUrl}
                  onChange={e => setNewBranch({...newBranch, googleUrl: e.target.value})}
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Шаблон вопросов</label>
                <CustomSelect 
                  className="w-full"
                  options={[
                    { value: "", label: "Без шаблона (свои вопросы)" },
                    ...templates.map(t => ({ value: t.id, label: t.name }))
                  ]}
                  value={newBranch.templateId || ""}
                  onChange={val => setNewBranch({...newBranch, templateId: val})}
                  placeholder="Выберите шаблон"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-end pt-8 relative z-10">
              <button 
                onClick={() => setShowAdd(false)}
                className="order-2 sm:order-1 px-8 py-4 text-slate-500 font-bold hover:bg-white/50 rounded-2xl transition-all text-sm"
              >
                Отмена
              </button>
              <button 
                onClick={handleSaveBranch}
                disabled={saving || !newBranch.name}
                className="order-1 sm:order-2 px-10 py-4 premium-gradient text-white rounded-2xl font-black shadow-2xl shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-3 text-sm"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : (editingBranch ? "Обновить филиал" : "Сохранить филиал")}
              </button>
            </div>

            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] -mr-48 -mt-48 rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {loading ? (
          <div className="col-span-full py-40 flex justify-center">
            <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
          </div>
        ) : branches.length === 0 ? (
          <div className="col-span-full bento-card border-dashed border-slate-200 py-32 text-center space-y-6">
            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
               <Building2 className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Филиалов пока нет</h3>
              <p className="text-slate-500 font-medium">Добавьте свой первый филиал, чтобы начать собирать отзывы</p>
            </div>
          </div>
        ) : (
          branches.map((branch) => (
            <div key={branch.id} className="bento-card group flex flex-col h-full bg-white/60 p-6 md:p-8">
              <div className="flex flex-col-reverse sm:flex-row justify-between items-start mb-10 gap-6">
                <div className="space-y-4 flex-1 min-w-0 w-full">
                  <div className="flex items-start justify-between sm:justify-start gap-4 flex-wrap sm:flex-nowrap">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight break-words overflow-hidden">{branch.name}</h3>
                    <div className="flex gap-2 shrink-0">
                      {branch.externalId && (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-200/50">
                          {branch.externalId}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleTestSurvey(branch.id)}
                          className="p-1 px-2.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-emerald-100/50 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                          title="Пройти тест опраса для этого филиала"
                        >
                          <Play className="w-3 h-3" />
                          Тест
                        </button>
                        <button 
                          onClick={() => handleEditClick(branch)}
                          className="p-1 px-2.5 bg-indigo-50 text-indigo-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100/50 hover:bg-indigo-500 hover:text-white transition-all"
                        >
                          Ред.
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    {branch.city || "Город не указан"}
                  </div>
                  {branch.template && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 rounded-xl text-indigo-500 text-[10px] font-black uppercase tracking-widest border border-indigo-100/30">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      {branch.template.name}
                    </div>
                  )}
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 shrink-0 self-end sm:self-start">
                  <div className="w-12 h-12 md:w-14 md:h-14 premium-gradient text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 group-hover:rotate-12 transition-transform duration-500">
                    <Building2 className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <button 
                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                    className="p-3 bg-white/50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm border border-rose-50/50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 md:gap-4 mb-auto">
                <div className="p-3 md:p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3">Вопросов</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900">{(branch as any).template?._count?.questions || 0}</p>
                </div>
                <div className="p-3 md:p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3">Отзывов</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900">{branch._count?.surveyResponses || 0}</p>
                </div>
                <div className="p-3 md:p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3">Рейтинг</p>
                  <div className="flex items-center justify-center gap-1">
                     <p className="text-xl md:text-2xl font-black text-slate-900">{branch.averageScore || "0.0"}</p>
                     <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                </div>
              </div>

              <div className="mt-12 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Центр управления</p>
                <div className="flex flex-col xsm:flex-row gap-3">
                  <button 
                    onClick={() => setSelectedForQR(branch)}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all text-sm shadow-xl shadow-slate-200"
                  >
                    <QrCode className="w-5 h-5" />
                    Контроль QR
                  </button>
                </div>
              </div>

              {/* Rating Monitoring Section */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Мониторинг отзовиков</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-48">
                      <CustomSelect
                        value={selectedMetrics[branch.id] || "yandex-rating"}
                        onChange={(val) => setSelectedMetrics(prev => ({ ...prev, [branch.id]: val }))}
                        options={METRIC_OPTIONS}
                        placeholder="Выберите метрику"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                  {['yandex', '2gis', 'google'].map(service => {
                    const latest = branch.ratingHistory?.filter(h => h.service === service).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    if (!latest && !(branch as any)[`${service}Url`]) return null;
                    
                    return (
                      <div key={service} className="group/item flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm shrink-0 relative">
                        <img src={`/icons/${service === '2gis' ? '2gis' : service === 'yandex' ? 'yandex' : 'googlemaps'}.png`} className="w-4 h-4 object-contain" alt="" />
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-black text-slate-900">{latest?.rating || '—'}</span>
                          <span className="text-[9px] font-bold text-slate-400">/ {latest?.reviewCount || 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="h-40 w-full mb-6">
                  {branch.ratingHistory && branch.ratingHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={(() => {
                          const selection = selectedMetrics[branch.id] || 'yandex-rating';
                          const [service, metric] = selection.split('-');
                          const filtered = (branch.ratingHistory || [])
                            .filter(h => h.service === service)
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                            .map(h => ({
                              date: new Date(h.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
                              value: metric === 'rating' ? h.rating : h.reviewCount,
                              label: metric === 'rating' ? 'Оценка' : 'Отзывы'
                            }));
                          
                          if (filtered.length === 0) return [];
                          return filtered;
                        })()}
                      >
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                          dy={10}
                        />
                        <YAxis 
                          hide={true} 
                          domain={selectedMetrics[branch.id]?.includes('rating') ? ['dataMin - 0.5', 'dataMax + 0.5'] : ['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '1.25rem', 
                            border: 'none', 
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'black'
                          }}
                          formatter={(value: any, name: any, props: any) => [value, props.payload.label]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <BarChart3 className="w-8 h-8 text-slate-200 mb-2" />
                      <p className="text-[10px] uppercase tracking-widest font-black text-slate-300">Данные отсутствуют</p>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a 
                    href={branch.yandexUrl || "#"} 
                    target={branch.yandexUrl ? "_blank" : undefined} 
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border",
                      branch.yandexUrl 
                        ? "bg-white border-rose-100 text-rose-600 hover:bg-rose-50 shadow-sm" 
                        : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-40"
                    )}
                  >
                    <img src="/icons/yandex.png" alt="" className="w-4 h-4 object-contain" />
                    Яндекс
                  </a>
                  <a 
                    href={branch.dgisUrl || "#"} 
                    target={branch.dgisUrl ? "_blank" : undefined} 
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border",
                      branch.dgisUrl 
                        ? "bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-50 shadow-sm" 
                        : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-40"
                    )}
                  >
                    <img src="/icons/2gis.png" alt="" className="w-4 h-4 object-contain" />
                    2ГИС
                  </a>
                  <a 
                    href={branch.googleUrl || "#"} 
                    target={branch.googleUrl ? "_blank" : undefined} 
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border",
                      branch.googleUrl 
                        ? "bg-white border-blue-100 text-blue-600 hover:bg-blue-50 shadow-sm" 
                        : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-40"
                    )}
                  >
                    <img src="/icons/googlemaps.png" alt="" className="w-4 h-4 object-contain" />
                    Google
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedForQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedForQR(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md glass p-10 md:p-12 rounded-[3.5rem] shadow-2xl border-white/60 space-y-10 overflow-hidden"
            >
              <div className="flex justify-between items-center relative z-10">
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">QR-код филиала</h3>
                <button 
                  onClick={() => setSelectedForQR(null)}
                  className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="text-center space-y-3 relative z-10">
                <div className="inline-block px-4 py-1.5 premium-gradient text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/20 mb-2">
                   {selectedForQR.name}
                </div>
                <p className="text-slate-500 font-bold">Разместите этот код в торговой точке</p>
              </div>

              <div className="aspect-square glass border-white/60 rounded-[3rem] p-8 md:p-10 flex items-center justify-center shadow-inner relative z-10">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(`https://alleyafeedbackservice.vercel.app/survey/qr?branchId=${selectedForQR.id}`)}`}
                  alt="Branch QR"
                  className="w-full h-full rounded-2xl shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <button 
                  onClick={() => {
                    const url = `https://alleyafeedbackservice.vercel.app/survey/qr?branchId=${selectedForQR.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Ссылка скопирована!");
                  }}
                  className="flex items-center justify-center gap-3 px-6 py-4 glass text-slate-700 bg-white/40 border-white/80 rounded-2xl font-black hover:bg-white transition-all text-sm shadow-sm"
                >
                  <Copy className="w-5 h-5" />
                  Ссылка
                </button>
                <a 
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`https://alleyafeedbackservice.vercel.app/survey/qr?branchId=${selectedForQR.id}`)}`}
                  target="_blank"
                  download={`qr-${selectedForQR.name}.png`}
                  className="flex items-center justify-center gap-3 px-6 py-4 premium-gradient text-white rounded-2xl font-black shadow-2xl shadow-indigo-500/20 hover:scale-[1.03] transition-all text-sm"
                >
                  <Download className="w-5 h-5" />
                  PNG
                </a>
                <button 
                  onClick={() => window.open(`/admin/branches/print/${selectedForQR.id}`, '_blank')}
                  className="sm:col-span-2 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl font-black hover:bg-indigo-100 transition-all text-sm shadow-sm"
                >
                  <Printer className="w-5 h-5" />
                  Распечатать шаблон (A4)
                </button>
              </div>

              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -ml-32 -mb-32 rounded-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAutomationHub && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAutomationHub(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-3xl glass p-10 rounded-[3rem] shadow-2xl border-white/60 space-y-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.5rem] premium-gradient flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <Zap className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Хаб Автоматизации</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">100% стабильный сбор данных через Google Cloud</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowAutomationHub(false)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"><X className="w-5 h-5" /></button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                   { step: "01", title: "Создайте скрипт", desc: "Перейдите в script.google.com и создайте новый проект.", link: "https://script.google.com" },
                   { step: "02", title: "Вставьте код", desc: "Удалите весь старый код и вставьте сгенерированный ниже фрагмент.", icon: Copy },
                   { step: "03", title: "Запустите", desc: "Настройте триггер (часы) на выполнение функции syncAllRatings.", icon: Settings }
                 ].map((s, idx) => (
                   <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100/50 space-y-3 relative group overflow-hidden">
                     <span className="text-4xl font-black text-indigo-500/10 absolute -right-2 -top-2 group-hover:scale-110 transition-transform">{s.step}</span>
                     <h4 className="text-sm font-black text-slate-900">{s.title}</h4>
                     <p className="text-[11px] font-bold text-slate-500 leading-relaxed">{s.desc}</p>
                     {s.link && (
                       <a href={s.link} target="_blank" className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:gap-2 transition-all">
                         Открыть <ExternalLink className="w-3 h-3" />
                       </a>
                     )}
                   </div>
                 ))}
               </div>

               <div className="space-y-4">
                   <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-200/50 space-y-3">
                     <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                       <AlertTriangle className="w-3.5 h-3.5" />
                       Supabase Service Role Key
                     </label>
                     <input
                       type="password"
                       placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                       className="w-full px-5 py-3 bg-white border border-amber-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-xs font-mono"
                       value={supabaseKey}
                       onChange={e => setSupabaseKey(e.target.value)}
                     />
                     <p className="text-[10px] text-amber-600/70 font-bold">{"Supabase Dashboard \u2192 Settings \u2192 API \u2192 service_role (secret)"}</p>
                   </div>

                   <div className="flex justify-between items-center px-1">
                     <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-500" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Supabase Sync Script</label>
                     </div>
                     <button
                       onClick={() => {
                         if (!supabaseKey) { alert("Paste Supabase service_role key first!"); return; }
                         navigator.clipboard.writeText(generateGASScript());
                         alert("Code copied!");
                       }}
                       className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                     >
                       <Copy className="w-3 h-3" />
                       Copy
                     </button>
                   </div>
                   <div className="relative group">
                     <pre className="w-full p-8 bg-slate-900 text-indigo-100/70 rounded-[2rem] text-[10px] font-mono overflow-auto h-[350px] border border-white/10 shadow-2xl scrollbar-thin scrollbar-thumb-indigo-500/20">
                       {generateGASScript()}
                     </pre>
                     <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent rounded-b-[2rem] pointer-events-none opacity-60" />
                   </div>
                </div>

               <div className="p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 flex items-start gap-4">
                 <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                   <TrendingUp className="w-5 h-5 text-white" />
                 </div>
                 <div>
                   <h4 className="text-xs font-black text-indigo-900 tracking-tight">Почему это работает?</h4>
                   <p className="text-[11px] font-bold text-indigo-700/70 leading-relaxed mt-1">
                     Google Apps Script работает на серверах Google, которые считаются «доверенными». Яндекс и Google Maps не блокируют их, что гарантирует 100% стабильность ваших данных.
                   </p>
                 </div>
               </div>

               <div className="text-center">
                 <button 
                   onClick={() => setShowAutomationHub(false)}
                   className="px-12 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm active:scale-95 transition-all shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:bg-slate-800"
                 >
                   Я настроил автоматизацию
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
