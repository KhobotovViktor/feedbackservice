"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Save, Webhook, Zap, Star, MapPin, Bell, Info, CheckCircle2, Link as LinkIcon, Terminal, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function IntegrationPage() {
  const [settings, setSettings] = useState({
    b24_webhook_url: "",
    b24_message_template: "Оцените качество обслуживания по ссылке: {surveyUrl}",
    b24_field_quality: "",
    b24_field_support: "",
    b24_field_average: "",
    b24_field_comment: "",
    review_yandex: "",
    review_2gis: "",
    review_google_maps: "",
    b24_group_chat_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<null | "success" | "error">(null);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/b24/webhook?clientId={{ID}}&dealId={{DEAL_ID}}`;

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings({
          b24_webhook_url: data.b24_webhook_url || "",
          b24_message_template: data.b24_message_template || "Оцените качество обслуживания по ссылке: {surveyUrl}",
          b24_field_quality: data.b24_field_quality || "",
          b24_field_support: data.b24_field_support || "",
          b24_field_average: data.b24_field_average || "",
          b24_field_comment: data.b24_field_comment || "",
          review_yandex: data.review_yandex || "",
          review_2gis: data.review_2gis || "",
          review_google_maps: data.review_google_maps || "",
          b24_group_chat_id: data.b24_group_chat_id || "",
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
      }
    } catch (e) {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Интеграция</h1>
        <p className="text-slate-500 text-lg font-medium">Бесшовная синхронизация с Битрикс24 и внешними сервисами</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Outbound Integration Settings */}
          <div className="bento-card bg-white/60 p-8 md:p-12 space-y-10 flex flex-col h-full border-white/40">
            <div className="flex items-center gap-4 text-indigo-600 mb-2">
              <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                 <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-0.5">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight">Автоматика CRM</h2>
                 <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Bitrix24 Outbound</p>
              </div>
            </div>
            
            <div className="space-y-8 flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Входящий вебхук Битрикс24
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="https://your-domain.bitrix24.ru/rest/1/xxxxx/..."
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all font-mono text-sm font-bold truncate pr-14"
                    value={settings.b24_webhook_url}
                    onChange={(e) => setSettings({ ...settings, b24_webhook_url: e.target.value })}
                  />
                  <Webhook className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-2 px-1 leading-relaxed">
                  Создайте в Битрикс24 (Маркет → Локальные приложения → Входящий вебхук) с правами на <span className="font-bold text-slate-500">CRM</span>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Шаблон сообщения клиенту
                </label>
                <textarea
                  rows={4}
                  className="w-full px-6 py-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold resize-none leading-relaxed"
                  value={settings.b24_message_template}
                  onChange={(e) => setSettings({ ...settings, b24_message_template: e.target.value })}
                />
                <div className="flex items-center gap-2 mt-2 px-1">
                   <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-indigo-500">{"{surveyUrl}"}</div>
                   <p className="text-[10px] text-slate-400 font-medium italic">ссылка на персональный опрос</p>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100/50">
                <div className="flex items-center gap-3 text-indigo-600 mb-6">
                  <Terminal className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Маппинг полей</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Качество обслуживания
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono font-bold"
                      value={settings.b24_field_quality}
                      onChange={(e) => setSettings({ ...settings, b24_field_quality: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Работа сотрудника
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono font-bold"
                      value={settings.b24_field_support}
                      onChange={(e) => setSettings({ ...settings, b24_field_support: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Средняя оценка
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono font-bold"
                      value={settings.b24_field_average}
                      onChange={(e) => setSettings({ ...settings, b24_field_average: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Комментарий
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-mono font-bold"
                      value={settings.b24_field_comment}
                      onChange={(e) => setSettings({ ...settings, b24_field_comment: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-4 leading-relaxed px-1">
                  Укажите ID пользовательских полей из Битрикс24 (Настройки → Настройки CRM → Настройки форм → Пользовательские поля).
                </p>
              </div>

              <div className="pt-8 border-t border-slate-100/50">
                <div className="flex items-center gap-3 text-emerald-500 mb-6">
                  <MapPin className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Маршруты отзывов</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">
                      Яндекс.Карты
                    </label>
                    <input
                      type="text"
                      placeholder="https://yandex.ru/maps/..."
                      className="w-full px-5 py-3 rounded-xl border border-rose-100/30 bg-rose-50/20 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all text-sm font-bold"
                      value={settings.review_yandex}
                      onChange={(e) => setSettings({ ...settings, review_yandex: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">
                      2GIS
                    </label>
                    <input
                      type="text"
                      placeholder="https://2gis.ru/..."
                      className="w-full px-5 py-3 rounded-xl border border-emerald-100/30 bg-emerald-50/20 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold"
                      value={settings.review_2gis}
                      onChange={(e) => setSettings({ ...settings, review_2gis: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">
                      Google Maps
                    </label>
                    <input
                      type="text"
                      placeholder="https://goo.gl/maps/..."
                      className="w-full px-5 py-3 rounded-xl border border-blue-100/30 bg-blue-50/20 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                      value={settings.review_google_maps}
                      onChange={(e) => setSettings({ ...settings, review_google_maps: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/30 mt-6">
                   <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                      <Star className="w-4 h-4 fill-current" />
                   </div>
                   <p className="text-[10px] text-slate-500 font-bold leading-none italic">
                      Эти ссылки будут доступны клиенту только при оценке <span className="text-indigo-600">4-5 звезд</span>.
                   </p>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100/50 pb-2">
                <div className="flex items-center gap-3 text-red-500 mb-6">
                  <Bell className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Центр тревоги</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    ID группового чата Bitrix24
                  </label>
                  <input
                    type="text"
                    placeholder="Например: 123"
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white outline-none transition-all text-sm font-bold"
                    value={settings.b24_group_chat_id || ""}
                    onChange={(e) => setSettings({ ...settings, b24_group_chat_id: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 font-medium mt-2 px-1">
                    В этот чат будут приходить мгновенные уведомления о <span className="font-bold text-rose-500">негативных</span> оценках.
                  </p>
                </div>
              </div>

              <div className="pt-8 flex items-center gap-6">
                <button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="flex items-center gap-3 premium-gradient text-white px-10 py-5 rounded-[1.5rem] font-black shadow-2xl shadow-indigo-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 text-base"
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Сохранить конфигурацию"}
                  {!saving && <Save size={20} />}
                </button>
                <AnimatePresence>
                  {status === "success" && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-emerald-500 flex items-center gap-2 text-sm font-black uppercase tracking-widest"
                    >
                      <CheckCircle2 size={18} /> Сохранено
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="bento-card p-10 md:p-12 space-y-6 flex flex-col bg-slate-900 text-white overflow-hidden relative shadow-2xl shadow-slate-900/40">
            <div className="flex items-center gap-4 text-indigo-400 mb-2 relative z-10">
              <LinkIcon className="w-8 h-8" />
              <div className="space-y-0.5">
                 <h2 className="text-2xl font-black tracking-tight">Входящий Webhook</h2>
                 <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">Entry point for Bitrix24 Robots</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-bold relative z-10 leading-relaxed">
              Скопируйте этот URL и вставьте его в настройки робота <span className="text-indigo-300">"Входящий вебхук"</span> в Битрикс24 для автоматизации сбора отзывов.
            </p>
            <div className="bg-white/5 p-6 rounded-2xl font-mono text-sm text-indigo-300 break-all select-all flex items-center justify-between border border-white/5 group hover:bg-white/10 transition-all relative z-10">
              <span className="truncate">{webhookUrl}</span>
              <Terminal className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity ml-4 shrink-0" />
            </div>

            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full" />
          </div>
        </div>

        {/* Instructions Sidebar */}
        <div className="space-y-8">
          <div className="glass p-8 md:p-10 rounded-[3rem] border-white/60 space-y-8 shadow-xl">
            <h3 className="flex items-center gap-3 font-black text-slate-900 text-xl tracking-tight mb-4">
              <Info className="text-indigo-500 w-6 h-6" /> Инструкция
            </h3>
            <div className="space-y-10">
              <div className="flex gap-5 relative group">
                <div className="w-10 h-10 premium-gradient text-white rounded-xl flex items-center justify-center shrink-0 font-black shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform">1</div>
                <div className="space-y-1 pt-1">
                   <p className="font-black text-slate-800 text-sm uppercase tracking-widest">Шаг первый</p>
                   <p className="text-slate-500 text-sm font-medium leading-relaxed">Получите входящий вебхук в Б24 и вставьте его в поле настройки CRM слева.</p>
                </div>
              </div>
              <div className="flex gap-5 relative group">
                <div className="w-10 h-10 premium-gradient text-white rounded-xl flex items-center justify-center shrink-0 font-black shadow-lg shadow-indigo-500/20 group-hover:-rotate-12 transition-transform">2</div>
                <div className="space-y-1 pt-1">
                   <p className="font-black text-slate-800 text-sm uppercase tracking-widest">Шаг второй</p>
                   <p className="text-slate-500 text-sm font-medium leading-relaxed">Настройте робота на нужную стадию в CRM, указав наш Webhook URL из черного блока.</p>
                </div>
              </div>
              <div className="flex gap-5 relative group">
                <div className="w-10 h-10 premium-gradient text-white rounded-xl flex items-center justify-center shrink-0 font-black shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">3</div>
                <div className="space-y-1 pt-1">
                   <p className="font-black text-slate-800 text-sm uppercase tracking-widest">Финал</p>
                   <p className="text-slate-500 text-sm font-medium leading-relaxed">Система сама сгенерирует ссылку и отправит её в таймлайн сделки.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/40 p-10 rounded-[2.5rem] border border-white/60 space-y-6 shadow-sm overflow-hidden relative group">
            <h3 className="flex items-center gap-3 font-black text-slate-900 text-xl tracking-tight relative z-10">
              <MessageSquare className="text-amber-500 w-6 h-6" /> Важно
            </h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed relative z-10">
              Для автоматической отправки клиенту в чат Битрикс24 убедитесь, что ваш вебхук имеет права доступа к модулю <span className="font-bold text-slate-700">"CRM"</span> и <span className="font-bold text-slate-700">"Чат и уведомления"</span>.
            </p>
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl group-hover:bg-amber-500/10 transition-all rounded-full" />
          </div>

          <div className="premium-gradient p-10 rounded-[3rem] text-white space-y-4 shadow-2xl shadow-indigo-500/30">
             <h3 className="text-xl font-black tracking-tight">Нужна помощь?</h3>
             <p className="text-white/80 font-medium text-sm leading-relaxed">Если у вас возникли трудности с настройкой роботов, напишите в нашу поддержку.</p>
             <button className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                Связаться
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
