"use client";

import { useState, useEffect } from "react";
import { 
  QrCode, X, Copy, Download, LayoutDashboard, Star, Printer, Play,
  TrendingUp, RefreshCw, BarChart3, Plus, Loader2, Building2, MapPin, Trash2, Edit2,
  Settings, Bot, ExternalLink, Zap
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { parseRating } from "@/lib/rating-parser";
import { Globe } from "lucide-react";

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
  const [editingRating, setEditingRating] = useState<{ branchId: string, service: string, rating: string, reviewCount: string } | null>(null);
  const [showAutomationHub, setShowAutomationHub] = useState(false);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [selectedForQR, setSelectedForQR] = useState<Branch | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Record<string, string>>({});

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
      if (Array.isArray(data)) {
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

  const handleSyncRatings = async (branchId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/rating-sync?branchId=${branchId}&t=${Date.now()}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        await fetchBranches();
        const summary = data.results.map((r: any) => 
          `${r.service.toUpperCase()}: ${r.status === 'success' ? '✅' : '❌ ' + (r.error || 'Ошибка')}`
        ).join('\n');
        alert(`Синхронизация завершена:\n\n${summary}`);
      } else {
        alert("Ошибка синхронизации рейтингов: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Ошибка сети при синхронизации: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRatingSave = async () => {
    if (!editingRating) return;
    try {
      setSaving(true);
      const res = await fetch("/api/admin/rating-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editingRating.branchId,
          service: editingRating.service,
          rating: editingRating.rating,
          reviewCount: editingRating.reviewCount
        }),
      });
      if (res.ok) {
        setEditingRating(null);
        fetchBranches();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const generateGASScript = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://alleyafeedbackservice.vercel.app';
    const apiKey = "alleya-default-key-123"; 
    
    let script = `// --- Alleya Feedback Service Automation Script ---\n`;
    script += `function syncAllRatings() {\n`;
    script += `  const API_URL = "\${baseUrl}/api/admin/rating-manual";\n`;
    script += `  const API_KEY = "\${apiKey}";\n\n`;
    script += `  const branches = [\n`;
    branches.forEach(b => {
      script += `    { id: "\${b.id}", name: "\${b.name}", yandex: "\${b.yandexUrl || ''}", google: "\${b.googleUrl || ''}", dgis: "\${b.dgisUrl || ''}" },\n`;
    });
    script += `  ];\n\n`;
    script += `  branches.forEach(branch => {\n`;
    script += `    if (branch.yandex) syncService(branch.id, "yandex", branch.yandex, API_URL, API_KEY);\n`;
    script += `    if (branch.google) syncService(branch.id, "google", branch.google, API_URL, API_KEY);\n`;
    script += `    if (branch.dgis) syncService(branch.id, "2gis", branch.dgis, API_URL, API_KEY);\n`;
    script += `  });\n`;
    script += `}\n\n`;
    script += `function syncService(branchId, service, url, apiUrl, apiKey) {\n`;
    script += `  try {\n`;
    script += `    const options = {\n`;
    script += `      muteHttpExceptions: true,\n`;
    script += `      headers: {\n`;
    script += `        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'\n`;
    script += `      }\n`;
    script += `    };\n`;
    script += `    const html = UrlFetchApp.fetch(url, options).getContentText();\n`;
    script += `    let rating = 0, count = 0;\n`;
    script += `    if (service === "yandex") {\n`;
    script += `       const rMatch = html.match(/rating-text\\\\\\">([\\\\d,.]+)<\\\\/span>/) || html.match(/class=\\\\\\"Rating-Value\\\\\\">([\\\\d,.]+)<\\\\/div>/);\n`;
    script += `       const cMatch = html.match(/aria-label=\\\\\\"(\\\\d+)\\\\s+оцен/) || html.match(/class=\\\\\\"Rating-Count\\\\\\">[^<]*?(\\\\d+)[^<]*?<\\\\/div>/);\n`;
    script += `       if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));\n`;
    script += `       if (cMatch) count = parseInt(cMatch[1]);\n`;
    script += `    } else if (service === "2gis") {\n`;
    script += `       const rMatch = html.match(/class=\\\\\\"_y10azs\\\\\\">([\\\\d.]+)/);\n`;
    script += `       const cMatch = html.match(/class=\\\\\\"_jspzdm\\\\\\">(\\\\d+)\\\\s+оцен/);\n`;
    script += `       if (rMatch) rating = parseFloat(rMatch[1]);\n`;
    script += `       if (cMatch) count = parseInt(cMatch[1]);\n`;
    script += `    } else if (service === "google") {\n`;
    script += `       const rMatch = html.match(/<span aria-hidden=\\\\\\"true\\\\\\">([0-5][.,]\\\\d)<\\\\/span>/);\n`;
    script += `       const cMatch = html.match(/aria-label=\\\\\\"([\\\\d\\\\s,]+)\\\\s+reviews\\\\\\\"/) || html.match(/aria-label=\\\\\\"([\\\\d\\\\s,]+)\\\\s+отзыв\\\\\\\"/);\n`;
    script += `       if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));\n`;
    script += `       if (cMatch) count = parseInt(cMatch[1].replace(/[^\\\\d]/g, ''));\n`;
    script += `    }\n\n`;
    script += `    if (rating > 0) {\n`;
    script += `      UrlFetchApp.fetch(apiUrl, {\n`;
    script += `        method: "post",\n`;
    script += `        contentType: "application/json",\n`;
    script += `        payload: JSON.stringify({ branchId, service, rating, reviewCount: count, apiKey })\n`;
    script += `      });\n`;
    script += `    }\n`;
    script += `  } catch (e) { console.error(e); }\n`;
    script += `}\n`;
    return script;
  };

  const handleBrowserSync = async (branch: Branch) => {
    try {
      setLoading(true);
      const results: any[] = [];
      const services = [
        { id: 'yandex', url: branch.yandexUrl },
        { id: '2gis', url: branch.dgisUrl },
        { id: 'google', url: branch.googleUrl }
      ].filter(s => s.url);

      if (services.length === 0) {
        alert("У этого филиала не указаны ссылки на карты!");
        return;
      }

      for (const s of services) {
        try {
          const cleanUrl = s.url!.split('?')[0];
          let html = "";
          let lastError = "";
          
          const proxies = [
            { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, mode: 'text' },
            { url: `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`, mode: 'json' },
            { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, mode: 'text' },
            { url: `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`, mode: 'text' },
            { url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(cleanUrl)}`, mode: 'text' }
          ];

          for (const proxy of proxies) {
            try {
              console.log(`Trying browser proxy: ${proxy.url}`);
              const res = await fetch(proxy.url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              
              if (proxy.mode === 'json') {
                const data = await res.json();
                html = data.contents || "";
              } else {
                html = await res.text();
              }

              if (html && html.length > 500 && !html.includes("captcha") && !html.includes("Detected as bot")) {
                console.log(`Successful fetch from proxy: ${proxy.url}`);
                break;
              } else {
                lastError = html.includes("captcha") ? "Captcha" : "Blocked/Empty";
                html = "";
              }
            } catch (e: any) {
              lastError = e.message;
              console.warn(`Browser proxy error: ${proxy.url}`, e);
            }
          }

          if (!html) {
             results.push({ service: s.id, status: 'error', error: `Прокси заблокирован (${lastError})` });
             continue;
          }

          const parsed = parseRating(s.id, html);
          
          if (parsed.success) {
            // Save to server
            await fetch('/api/admin/rating-manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                branchId: branch.id,
                service: s.id,
                rating: parsed.rating,
                reviewCount: parsed.reviewCount
              })
            });
            results.push({ service: s.id, status: 'success' });
          } else {
            // Try widget fallback for Yandex if main failed
            if (s.id === 'yandex') {
              const widgetUrl = `https://yandex.ru/maps-reviews-widget/1/`; // Dummy id, fetcher usually normalizes this, but here we'd need actual id
              // Actually, use same logic as server but on client
            }
            results.push({ service: s.id, status: 'error', error: parsed.error });
          }
        } catch (e: any) {
          results.push({ service: s.id, status: 'error', error: e.message });
        }
      }

      const summary = results.map((r: any) => 
        `${r.service.toUpperCase()}: ${r.status === 'success' ? '✅' : '❌ ' + (r.error || 'Ошибка')}`
      ).join('\n');
      alert(`Синхронизация через браузер завершена:\n\n${summary}`);
      fetchBranches();
    } catch (err: any) {
      alert("Ошибка браузерной синхронизации: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSurvey = (branchId: string) => {
    window.open(`/survey/qr?branchId=${branchId}&test=true`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Филиалы</h1>
          <p className="text-slate-500 text-lg font-medium">Управление точками продаж и их настройками</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setShowAutomationHub(true)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-100 text-indigo-500 rounded-[1.5rem] font-bold shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            <Zap className="w-5 h-5" />
            Автоматизация
          </button>
          <button 
            onClick={() => {
              setEditingBranch(null);
              setNewBranch({ name: "", city: "", yandexUrl: "", dgisUrl: "", googleUrl: "", externalId: "", templateId: "" });
              setShowAdd(true);
            }}
            className="flex items-center justify-center gap-2 px-8 py-4 premium-gradient text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            <Plus className="w-6 h-6" />
            Добавить филиал
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
            <div key={branch.id} className="bento-card group flex flex-col h-full bg-white/60">
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-2 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter truncate leading-none">{branch.name}</h3>
                    <div className="flex gap-2">
                      {branch.externalId && (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-200/50">
                          {branch.externalId}
                        </span>
                      )}
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
                        Редактировать
                      </button>
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
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="w-14 h-14 premium-gradient text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 group-hover:rotate-12 transition-transform duration-500">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <button 
                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                    className="p-3 bg-white/50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm border border-rose-50/50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-auto">
                <div className="p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Вопросов</p>
                  <p className="text-2xl font-black text-slate-900">{(branch as any).template?._count?.questions || 0}</p>
                </div>
                <div className="p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Отзывов</p>
                  <p className="text-2xl font-black text-slate-900">{branch._count?.surveyResponses || 0}</p>
                </div>
                <div className="p-5 glass border-white/40 rounded-2xl text-center group-hover:bg-white/80 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Рейтинг</p>
                  <div className="flex items-center justify-center gap-1">
                     <p className="text-2xl font-black text-slate-900">{branch.averageScore || "0.0"}</p>
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
                    <button 
                      onClick={() => handleSyncRatings(branch.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-500" />
                      Авто
                    </button>
                    <button 
                      onClick={() => handleBrowserSync(branch)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Globe className="w-3 h-3 text-indigo-500" />
                      Браузер
                    </button>
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
                        <button 
                          onClick={() => setEditingRating({ 
                            branchId: branch.id, 
                            service, 
                            rating: latest?.rating?.toString() || "", 
                            reviewCount: latest?.reviewCount?.toString() || "" 
                          })}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-slate-100 rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm hover:text-indigo-500"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
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
                          
                          // If no data for specific service, show a friendly empty state transition
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
        {editingRating && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingRating(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm glass p-8 rounded-[2.5rem] shadow-2xl border-white/60 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 capitalize">
                  <img src={`/icons/${editingRating.service === '2gis' ? '2gis' : editingRating.service === 'yandex' ? 'yandex' : 'googlemaps'}.png`} className="w-5 h-5 object-contain" alt="" />
                  {editingRating.service}
                </h3>
                <button onClick={() => setEditingRating(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Текущая оценка</label>
                   <input 
                     type="number" step="0.1" 
                     className="w-full px-5 py-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-black"
                     value={editingRating.rating}
                     onChange={e => setEditingRating({...editingRating, rating: e.target.value})}
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Всего отзывов</label>
                   <input 
                     type="number"
                     className="w-full px-5 py-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-black"
                     value={editingRating.reviewCount}
                     onChange={e => setEditingRating({...editingRating, reviewCount: e.target.value})}
                   />
                </div>
                <button 
                  onClick={handleManualRatingSave}
                  disabled={saving}
                  className="w-full py-4 premium-gradient text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm flex justify-center items-center"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Сохранить"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAutomationHub && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAutomationHub(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl glass p-10 rounded-[2.5rem] shadow-2xl border-white/60 space-y-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-inner">
                    <Zap className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Центр автоматизации</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">100% стабильный сбор данных</p>
                  </div>
                </div>
                <button onClick={() => setShowAutomationHub(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-3">
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    Для обхода блокировок Яндекса и Google мы рекомендуем использовать «Мост через Google Cloud». 
                    Это бесплатно, надежно и данные будут обновляться автоматически.
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink className="w-3 h-3" />
                      Инструкция (3 шага):
                    </h4>
                    <ul className="text-[11px] font-bold text-slate-500 space-y-2 ml-1">
                      <li>1. Перейдите на <a href="https://script.google.com" target="_blank" className="text-indigo-500 underline">script.google.com</a> и создайте новый проект.</li>
                      <li>2. Удалите весь текст в редакторе и вставьте код ниже.</li>
                      <li>3. Нажмите кнопку «Развернуть» → «Новое развертывание» → «Веб-приложение» → «У кого есть доступ: Все». Либо просто настройте Триггер (часы) на запуск функции <code className="bg-white px-1.5 py-0.5 rounded border">syncAllRatings</code>.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Готовый код для вставки</label>
                     <button 
                       onClick={() => {
                         navigator.clipboard.writeText(generateGASScript());
                         alert("Код скопирован!");
                       }}
                       className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                     >
                       Копировать код
                     </button>
                   </div>
                   <div className="relative">
                     <pre className="w-full p-6 bg-slate-900 text-indigo-100/80 rounded-3xl text-[10px] font-mono overflow-x-auto h-[250px] scrollbar-thin scrollbar-thumb-indigo-500/20">
                       {generateGASScript()}
                     </pre>
                     <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900 to-transparent rounded-b-3xl" />
                   </div>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button 
                  onClick={() => setShowAutomationHub(false)}
                  className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-slate-900/20"
                >
                  Я всё настроил
                </button>
              </div>
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

               <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-500" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Индивидуальный скрипт для ваших филиалов</label>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generateGASScript());
                        alert("Код скопирован! Теперь вставьте его в Google Apps Script.");
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                    >
                      <Copy className="w-3 h-3" />
                      Копировать код
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
