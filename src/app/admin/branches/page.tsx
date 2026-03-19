"use client";

import { useState, useEffect } from "react";
import { 
  QrCode, X, Copy, Download, LayoutDashboard, Star, Printer, Play,
  TrendingUp, RefreshCw, BarChart3
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
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [selectedForQR, setSelectedForQR] = useState<Branch | null>(null);

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
      const res = await fetch(`/api/admin/rating-sync?branchId=${branchId}`);
      if (res.ok) {
        fetchBranches();
      } else {
        alert("Ошибка синхронизации рейтингов");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Филиалы</h1>
          <p className="text-slate-500 text-lg font-medium">Управление точками продаж и их настройками</p>
        </div>
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
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Мониторинг отзовиков</p>
                  </div>
                  <button 
                    onClick={() => handleSyncRatings(branch.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Обновить
                  </button>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                  {['yandex', '2gis', 'google'].map(service => {
                    const latest = branch.ratingHistory?.filter(h => h.service === service).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    if (!latest && !(branch as any)[`${service}Url`]) return null;
                    
                    return (
                      <div key={service} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm shrink-0">
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
                        data={branch.ratingHistory.map(h => ({
                          date: new Date(h.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
                          rating: h.rating,
                          service: h.service === 'yandex' ? 'Яндекс' : h.service === '2gis' ? '2ГИС' : 'Google'
                        }))}
                      >
                        <defs>
                          <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
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
                          domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '1rem', 
                            border: 'none', 
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="rating" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorRating)" 
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
    </div>
  );
}
