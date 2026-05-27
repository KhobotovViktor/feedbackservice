"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Save, Webhook, Zap, Star, MapPin, Bell, Info, CheckCircle2, Link as LinkIcon, Terminal, Loader2, Users, Plus, Trash2, Building2, Play, Power, Palette, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

export default function IntegrationPage() {
  const [settings, setSettings] = useState({
    b24_webhook_url: "",
    b24_message_template: "Оцените качество обслуживания по ссылке: {surveyUrl}",
    b24_field_quality: "",
    b24_field_support: "",
    b24_field_average: "",
    b24_field_comment: "",
    b24_template_id: "",
    review_yandex: "",
    review_2gis: "",
    review_google_maps: "",
    b24_group_chat_id: "",
    city_selection_enabled: "false",
    brand_name: "",
    brand_logo_url: "",
    brand_site_url: "",
    brand_accent: "",
    brand_company_full: "",
    brand_privacy_contact: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  // Per-operator webhooks
  type OpWebhook = { id: string; userId: string; displayName: string | null; url: string };
  const [opWebhooks, setOpWebhooks] = useState<OpWebhook[]>([]);
  const [newOp, setNewOp] = useState({ userId: "", displayName: "", url: "" });
  const [opSaving, setOpSaving] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // ONSESSIONFINISH event binding — survey link on Open Line dialog close.
  const [eventBound, setEventBound] = useState<boolean | null>(null);
  const [eventBusy, setEventBusy] = useState(false);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  // Cities for the "pick your city" CRM scenario.
  type City = { id: string; name: string; branchId: string | null; branch: { id: string; name: string } | null };
  const [cities, setCities] = useState<City[]>([]);
  const [newCity, setNewCity] = useState({ name: "", branchId: "" });
  const [citySaving, setCitySaving] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Two robot URLs — Bitrix24's {{ID}} macro resolves to the current
  // document's id (the deal in a Deals funnel, the lead in a Leads funnel).
  const webhookUrlDeal = `${origin}/api/b24/webhook?clientId={{ID}}&dealId={{ID}}`;
  const webhookUrlLead = `${origin}/api/b24/webhook?clientId={{ID}}&leadId={{ID}}&entityType=lead`;

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((res) => res.json()),
      fetch(`/api/branches?t=${Date.now()}`).then((res) => res.json()),
      fetch("/api/templates").then((res) => res.json()),
      fetch("/api/admin/b24-webhooks").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/cities").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([settingsData, branchesData, templatesData, webhooksData, citiesData]) => {
        setSettings({
          b24_webhook_url: settingsData.b24_webhook_url || "",
          b24_message_template:
            settingsData.b24_message_template ||
            "Оцените качество обслуживания по ссылке: {surveyUrl}",
          b24_field_quality: settingsData.b24_field_quality || "",
          b24_field_support: settingsData.b24_field_support || "",
          b24_field_average: settingsData.b24_field_average || "",
          b24_field_comment: settingsData.b24_field_comment || "",
          b24_template_id: settingsData.b24_template_id || "",
          review_yandex: settingsData.review_yandex || "",
          review_2gis: settingsData.review_2gis || "",
          review_google_maps: settingsData.review_google_maps || "",
          b24_group_chat_id: settingsData.b24_group_chat_id || "",
          city_selection_enabled: settingsData.city_selection_enabled || "false",
          brand_name: settingsData.brand_name || "",
          brand_logo_url: settingsData.brand_logo_url || "",
          brand_site_url: settingsData.brand_site_url || "",
          brand_accent: settingsData.brand_accent || "",
          brand_company_full: settingsData.brand_company_full || "",
          brand_privacy_contact: settingsData.brand_privacy_contact || "",
          telegram_bot_token: settingsData.telegram_bot_token || "",
          telegram_chat_id: settingsData.telegram_chat_id || "",
        });

        const bList = Array.isArray(branchesData)
          ? branchesData
          : branchesData.branches || [];
        if (Array.isArray(bList)) setBranches(bList);
        if (Array.isArray(templatesData)) setTemplates(templatesData);
        if (Array.isArray(webhooksData)) setOpWebhooks(webhooksData);
        if (Array.isArray(citiesData)) setCities(citiesData);
      })
      .catch((err) => {
        // Without this catch, a network blip during initial load would leave
        // `loading` stuck on true forever — the page would render nothing
        // and the user would think the site is broken.
        console.error("Integration page initial load failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Check whether the dialog-close event is currently bound (best-effort).
  useEffect(() => {
    fetch("/api/admin/b24-bind-event")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.bound === "boolean") setEventBound(d.bound);
      })
      .catch(() => {});
  }, []);

  const toggleSessionEvent = async () => {
    setEventBusy(true);
    setEventMsg(null);
    try {
      const res = await fetch("/api/admin/b24-bind-event", {
        method: eventBound ? "DELETE" : "POST",
      });
      const d = await res.json();
      if (res.ok) {
        setEventBound(Boolean(d.bound));
        setEventMsg(
          d.bound
            ? "Готово: ссылка будет отправляться клиенту при завершении диалога."
            : "Отправка по завершению диалога отключена."
        );
      } else {
        setEventMsg(d.error || "Не удалось изменить привязку события.");
      }
    } catch {
      setEventMsg("Ошибка сети.");
    } finally {
      setEventBusy(false);
    }
  };

  const handleAddWebhook = async () => {
    setOpError(null);
    // Client-side validation — give immediate feedback instead of waiting
    // for the round-trip rejection. The same checks live on the backend
    // (src/app/api/admin/b24-webhooks/route.ts) and are the source of truth.
    const userIdTrim = newOp.userId.trim();
    const urlTrim = newOp.url.trim();
    if (!/^\d{1,12}$/.test(userIdTrim)) {
      setOpError("ID должен состоять только из цифр (например, 706).");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(urlTrim);
    } catch {
      setOpError("URL некорректен — ожидается полный https://… адрес.");
      return;
    }
    if (parsed.protocol !== "https:" || !parsed.hostname.toLowerCase().includes("bitrix24.")) {
      setOpError("URL должен начинаться с https:// и указывать на *.bitrix24.* домен.");
      return;
    }
    const m = urlTrim.match(/\/rest\/(\d+)\//);
    if (m && m[1] !== userIdTrim) {
      setOpError(`ID (${userIdTrim}) не совпадает с пользователем в URL (${m[1]}).`);
      return;
    }

    setOpSaving(true);
    try {
      const res = await fetch("/api/admin/b24-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdTrim,
          displayName: newOp.displayName.trim() || null,
          url: urlTrim,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOpError(data.error || "Не удалось добавить вебхук");
        return;
      }
      setOpWebhooks((prev) => {
        const without = prev.filter((w) => w.userId !== data.userId);
        return [...without, data];
      });
      setNewOp({ userId: "", displayName: "", url: "" });
    } catch {
      setOpError("Ошибка соединения");
    } finally {
      setOpSaving(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Удалить этот вебхук?")) return;
    const res = await fetch(`/api/admin/b24-webhooks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOpWebhooks((prev) => prev.filter((w) => w.id !== id));
    }
  };

  // ── "Pick your city" scenario ───────────────────────────────────────────
  // Cities save immediately (own API), so the whole block is self-contained.
  const handleAddCity = async () => {
    setCityError(null);
    const name = newCity.name.trim();
    if (!name) { setCityError("Введите название города."); return; }
    if (!newCity.branchId) { setCityError("Выберите филиал для привязки."); return; }
    setCitySaving(true);
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, branchId: newCity.branchId }),
      });
      const data = await res.json();
      if (!res.ok) { setCityError(data.error || "Не удалось добавить город"); return; }
      setCities((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "ru")));
      setNewCity({ name: "", branchId: "" });
    } catch {
      setCityError("Ошибка соединения");
    } finally {
      setCitySaving(false);
    }
  };

  const handleDeleteCity = async (id: string) => {
    if (!confirm("Удалить этот город?")) return;
    const res = await fetch(`/api/cities/${id}`, { method: "DELETE" });
    if (res.ok) setCities((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleCitySelection = async () => {
    const next = settings.city_selection_enabled === "true" ? "false" : "true";
    setSettings((s) => ({ ...s, city_selection_enabled: next }));
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city_selection_enabled: next }),
      });
    } catch {
      // Revert the optimistic toggle if the save failed.
      setSettings((s) => ({ ...s, city_selection_enabled: next === "true" ? "false" : "true" }));
    }
  };

  const handleTestCityScenario = () => {
    window.open("/api/admin/test/generate-city-survey-token", "_blank");
  };

  // ── Survey-page branding (own save, like the cities block) ───────────────
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandStatus, setBrandStatus] = useState<null | "success" | "error">(null);
  const handleSaveBrand = async () => {
    setBrandSaving(true);
    setBrandStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: settings.brand_name,
          brand_logo_url: settings.brand_logo_url,
          brand_site_url: settings.brand_site_url,
          brand_accent: settings.brand_accent,
          brand_company_full: settings.brand_company_full,
          brand_privacy_contact: settings.brand_privacy_contact,
        }),
      });
      setBrandStatus(res.ok ? "success" : "error");
      if (res.ok) setTimeout(() => setBrandStatus(null), 3000);
    } catch {
      setBrandStatus("error");
    } finally {
      setBrandSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      const res = await fetch("/api/admin/test/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: settings.telegram_bot_token,
          chatId: settings.telegram_chat_id,
        }),
      });
      const data = await res.json();
      if (res.ok) alert("✅ Тестовое сообщение отправлено в Telegram!");
      else alert("❌ " + (data.error || "Не удалось отправить"));
    } catch {
      alert("❌ Ошибка при отправке теста");
    }
  };

// No global questions anymore

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
    } catch {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {/* Outbound Integration Settings */}
          <div className="bento-card bg-white/60 p-8 md:p-12 space-y-10 flex flex-col border-white/40">
            <div className="flex items-center gap-4 text-indigo-600 mb-2">
              <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                 <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-0.5">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight">Автоматика CRM</h2>
                 <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Bitrix24 Outbound</p>
              </div>
            </div>
            
            <div className="space-y-8">
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

              <div className="relative z-50 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Шаблон вопросов для Bitrix24
                </label>
                <CustomSelect 
                  options={templates.map(t => ({ value: t.id, label: t.name }))}
                  value={settings.b24_template_id}
                  onChange={(val) => setSettings({ ...settings, b24_template_id: val })}
                  placeholder="Выберите основной шаблон"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-2 px-1 leading-relaxed italic">
                  Этот шаблон будет применяться ко всем опросам, отправленным через вебхук CRM.
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

              {/* Survey on dialog close (ONSESSIONFINISH) */}
              <div className="pt-8 border-t border-slate-100/50">
                <div className="flex items-center gap-3 text-indigo-600 mb-2">
                  <Power className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Опрос по завершению диалога</h3>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-1 mb-4">
                  Ссылка отправляется клиенту в чат Открытой линии, когда оператор{" "}
                  <span className="font-bold text-slate-600">закрывает диалог</span> (без робота на стадии).
                  Филиал — по линии (если задан маппинг), ответственный — по оператору. Поля сделки при этом
                  не заполняются.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={toggleSessionEvent}
                    disabled={eventBusy || !settings.b24_webhook_url}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all disabled:opacity-50 ${
                      eventBound
                        ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                        : "premium-gradient text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02]"
                    }`}
                  >
                    {eventBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    {eventBound ? "Отключить" : "Включить отправку по завершению"}
                  </button>
                  {eventBound !== null && (
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${
                        eventBound ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {eventBound ? "Активно" : "Выключено"}
                    </span>
                  )}
                </div>
                {eventMsg && <p className="text-[11px] text-slate-500 font-medium mt-2 px-1">{eventMsg}</p>}
                {!settings.b24_webhook_url && (
                  <p className="text-[11px] text-amber-600 font-medium mt-2 px-1">
                    Сначала укажите входящий вебхук Битрикс24 выше и сохраните настройки.
                  </p>
                )}
              </div>

              {/* Per-operator webhooks */}
              <div className="pt-8 border-t border-slate-100/50">
                <div className="flex items-center gap-3 text-indigo-600 mb-2">
                  <Users className="w-6 h-6" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Вебхуки операторов
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-1 mb-6">
                  Для отправки сообщения клиенту в Открытую линию нужно, чтобы автор сообщения был
                  оператором этой линии. Добавьте сюда отдельный вебхук для каждого менеджера —
                  сервис выберет вебхук ответственного за сделку, а если его права не подойдут —
                  переберёт остальные.
                  <span className="block mt-1 text-slate-400">
                    Основной вебхук (поле выше) используется для CRM-операций
                    и как последний fallback.
                  </span>
                </p>

                {opWebhooks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {opWebhooks.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black shrink-0">
                          {w.userId}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 truncate">
                            {w.displayName || `Пользователь ${w.userId}`}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {w.url}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteWebhook(w.id)}
                          className="opacity-40 group-hover:opacity-100 text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ID, напр. 706"
                    className="px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-mono font-bold"
                    value={newOp.userId}
                    onChange={(e) => setNewOp({ ...newOp, userId: e.target.value.replace(/\D/g, "") })}
                  />
                  <input
                    type="text"
                    placeholder="Имя сотрудника (опционально, для удобства)"
                    className="px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                    value={newOp.displayName}
                    onChange={(e) => setNewOp({ ...newOp, displayName: e.target.value })}
                  />
                </div>
                <div className="mt-3 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="https://am35.bitrix24.ru/rest/706/xxxxxxxxxxxxxxxx/"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-mono font-bold"
                    value={newOp.url}
                    onChange={(e) => setNewOp({ ...newOp, url: e.target.value })}
                  />
                  <button
                    onClick={handleAddWebhook}
                    disabled={opSaving || !newOp.userId || !newOp.url}
                    className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {opSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Добавить
                  </button>
                </div>
                {opError && (
                  <p className="text-xs text-rose-600 font-bold mt-2 px-1">{opError}</p>
                )}
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
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                        Яндекс.Карты
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="https://yandex.ru/maps/..."
                      className="w-full px-5 py-3 rounded-xl border border-rose-100/30 bg-rose-50/20 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all text-sm font-bold"
                      value={settings.review_yandex}
                      onChange={(e) => setSettings({ ...settings, review_yandex: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        2GIS
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="https://2gis.ru/..."
                      className="w-full px-5 py-3 rounded-xl border border-emerald-100/30 bg-emerald-50/20 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold"
                      value={settings.review_2gis}
                      onChange={(e) => setSettings({ ...settings, review_2gis: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                        Google Maps
                      </label>
                    </div>
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
                      Эти ссылки будут доступны клиенту только при достижении <span className="text-indigo-600">порога положительной оценки</span>, заданного в шаблоне.
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
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="text"
                      placeholder="Например: 123"
                      className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white outline-none transition-all text-sm font-bold"
                      value={settings.b24_group_chat_id || ""}
                      onChange={(e) => setSettings({ ...settings, b24_group_chat_id: e.target.value })}
                    />
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/test-b24-notification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              chatId: settings.b24_group_chat_id,
                              webhookUrl: settings.b24_webhook_url
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert("✅ Тестовое сообщение отправлено! Проверьте чат в Битрикс24.");
                          } else {
                            alert("❌ Ошибка: " + (data.error || "Неизвестная ошибка"));
                          }
                        } catch {
                          alert("❌ Ошибка при отправке теста");
                        }
                      }}
                      className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Bell size={14} className="text-rose-500" />
                      Проверить
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-2 px-1">
                    В этот чат будут приходить мгновенные уведомления о <span className="font-bold text-rose-500">негативных</span> оценках.
                  </p>
                </div>

                {/* Telegram — duplicate channel for negative alerts */}
                <div className="space-y-2 mt-8 pt-6 border-t border-slate-100/50">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Telegram-бот (дубль уведомлений о негативе)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="Токен бота (от @BotFather)"
                      autoComplete="off"
                      className="px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white outline-none transition-all text-sm font-mono font-bold"
                      value={settings.telegram_bot_token}
                      onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="chat_id (напр. -1001234567890)"
                      className="px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white outline-none transition-all text-sm font-mono font-bold"
                      value={settings.telegram_chat_id}
                      onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                    />
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={handleTestTelegram}
                      className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <Bell size={14} className="text-sky-500" />
                      Проверить Telegram
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-1 px-1 leading-relaxed">
                    Создайте бота через <span className="font-bold">@BotFather</span>, добавьте его в нужный чат/группу и укажите
                    токен и chat_id. Пусто — Telegram-уведомления выключены. Не забудьте «Сохранить конфигурацию».
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
                  {status === "error" && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-rose-500 flex items-center gap-2 text-sm font-black uppercase tracking-widest"
                    >
                      Не удалось сохранить
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* City selection for CRM survey links.
              relative z-20: each bento-card is its own stacking context (glass
              uses backdrop-filter), so without an explicit z-index the later
              "Входящий Webhook" card paints over this card's open dropdown.
              z-20 lifts the whole card (and its dropdown) above it. */}
          <div className="bento-card bg-white/60 p-8 md:p-12 space-y-8 flex flex-col border-white/40 relative z-20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                  <MapPin className="w-8 h-8" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Выбор города</h2>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Для опросов из CRM</p>
                </div>
              </div>
              <button
                onClick={handleTestCityScenario}
                className="px-5 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 shrink-0"
                title="Пройти тестовый сценарий выбора города"
              >
                <Play className="w-4 h-4" />
                Тест
              </button>
            </div>

            <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-1">
              Когда сценарий включён, клиент, перешедший по ссылке из CRM, сначала выбирает свой
              город. К каждому городу привязан филиал — его вопросы и ссылки на карты (Яндекс, 2ГИС,
              Google) используются в опросе. На QR-коды филиалов это не влияет.
            </p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50/40">
              <div className="flex items-center gap-3">
                <Power className={cn("w-5 h-5", settings.city_selection_enabled === "true" ? "text-emerald-500" : "text-slate-300")} />
                <div>
                  <p className="text-sm font-black text-slate-800">Включить выбор города</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {settings.city_selection_enabled === "true" ? "Активно для CRM-ссылок" : "Отключено"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.city_selection_enabled === "true"}
                onClick={toggleCitySelection}
                className={cn(
                  "relative w-14 h-8 rounded-full transition-colors shrink-0",
                  settings.city_selection_enabled === "true" ? "bg-emerald-500" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform",
                    settings.city_selection_enabled === "true" ? "translate-x-6" : ""
                  )}
                />
              </button>
            </div>

            {/* Existing cities */}
            {cities.length > 0 && (
              <div className="space-y-2">
                {cities.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{c.name}</div>
                      <div className="text-[11px] font-bold text-slate-400 truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {c.branch?.name || <span className="text-rose-400">Филиал не привязан</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCity(c.id)}
                      className="opacity-40 group-hover:opacity-100 text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                      title="Удалить город"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add a city */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Название города, напр. Владимир"
                  className="px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-bold"
                  value={newCity.name}
                  onChange={(e) => setNewCity({ ...newCity, name: e.target.value })}
                />
                <div className="relative z-30">
                  <CustomSelect
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    value={newCity.branchId}
                    onChange={(val) => setNewCity({ ...newCity, branchId: val })}
                    placeholder="Привязать филиал"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCity}
                disabled={citySaving || !newCity.name.trim() || !newCity.branchId}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {citySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Добавить город
              </button>
              {cityError && <p className="text-xs text-rose-600 font-bold px-1">{cityError}</p>}
            </div>
          </div>

          {/* Survey-page branding */}
          <div className="bento-card bg-white/60 p-8 md:p-12 space-y-8 flex flex-col border-white/40">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                <Palette className="w-8 h-8" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Брендинг опроса</h2>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Логотип · название · цвет</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-1">
              {"Как страница опроса и шаблон печати QR-кода (в разделе «Филиалы») выглядят для клиента. Эти же название и логотип подставляются в шапку A4-листовки для печати. Пустые поля показывают встроенные значения по умолчанию."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Название бренда</label>
                <input
                  type="text"
                  placeholder={"Например: «Название компании»"}
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                  value={settings.brand_name}
                  onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ссылка на сайт</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                  value={settings.brand_site_url}
                  onChange={(e) => setSettings({ ...settings, brand_site_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{"Логотип"}</label>
                <div className="flex items-start gap-3">
                  {/* Preview — same chip we draw on the survey/print page so
                      admins see exactly what the QR overlay will look like. */}
                  <div className="w-16 h-16 shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden p-1.5 shadow-sm">
                    {settings.brand_logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={settings.brand_logo_url} alt="logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center leading-tight">{"Нет лого"}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black hover:bg-indigo-100 transition-colors">
                        <Upload className="w-4 h-4" />
                        {"Загрузить файл"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = ""; // allow re-picking the same file
                            if (!file) return;
                            // Soft cap: 300 KB. Bigger files inflate the
                            // Settings row in DB and slow every page that
                            // reads brand_logo_url. The default Alleya logo
                            // is ~30 KB for comparison.
                            const MAX = 300 * 1024;
                            if (file.size > MAX) {
                              alert(`Файл слишком большой (${Math.round(file.size / 1024)} КБ). Максимум: 300 КБ. Сожмите изображение в любом онлайн-конвертере.`);
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = typeof reader.result === "string" ? reader.result : "";
                              if (!result.startsWith("data:image/")) {
                                alert("Не удалось прочитать файл как изображение.");
                                return;
                              }
                              setSettings({ ...settings, brand_logo_url: result });
                            };
                            reader.onerror = () => alert("Ошибка чтения файла.");
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {settings.brand_logo_url && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, brand_logo_url: "" })}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          {"Очистить"}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="/logo.png или https://…"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-xs font-mono font-bold"
                      value={settings.brand_logo_url.startsWith("data:") ? "" : settings.brand_logo_url}
                      onChange={(e) => setSettings({ ...settings, brand_logo_url: e.target.value })}
                    />
                    <p className="text-[10px] text-slate-400 leading-snug ml-1">
                      {"Загрузите PNG/JPG/SVG (до 300 КБ) или вставьте прямую ссылку. Этот логотип отображается в центре QR-кода, в шапке шаблона печати A4 и на странице опроса."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Акцентный цвет</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Акцентный цвет"
                    className="w-12 h-11 rounded-xl border border-slate-200 bg-white cursor-pointer shrink-0"
                    value={settings.brand_accent || "#6366f1"}
                    onChange={(e) => setSettings({ ...settings, brand_accent: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="#6366f1 (пусто = градиент по умолчанию)"
                    className="flex-1 px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-mono font-bold"
                    value={settings.brand_accent}
                    onChange={(e) => setSettings({ ...settings, brand_accent: e.target.value })}
                  />
                  {settings.brand_accent && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, brand_accent: "" })}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors shrink-0"
                    >
                      Сброс
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{"Полное юридическое название"}</label>
                <input
                  type="text"
                  placeholder={"Например: ООО «Название компании», ИНН 1234567890"}
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                  value={settings.brand_company_full}
                  onChange={(e) => setSettings({ ...settings, brand_company_full: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 leading-snug ml-1">
                  {"Используется на страницах «Политика конфиденциальности» и «Пользовательское соглашение» как «Оператор», а также в подвале шаблона печати A4."}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{"Контакт по персональным данным"}</label>
                <input
                  type="text"
                  placeholder={"Например: privacy@example.com или +7 (000) 000-00-00"}
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold"
                  value={settings.brand_privacy_contact}
                  onChange={(e) => setSettings({ ...settings, brand_privacy_contact: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 leading-snug ml-1">
                  {"Адрес или телефон, по которому клиент может направить запрос про обработку персональных данных. Показывается на странице «Политика конфиденциальности»."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveBrand}
                disabled={brandSaving}
                className="flex items-center gap-2 premium-gradient text-white px-7 py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 text-sm"
              >
                {brandSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                Сохранить брендинг
              </button>
              <AnimatePresence>
                {brandStatus === "success" && (
                  <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-emerald-500 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                    <CheckCircle2 size={18} /> Сохранено
                  </motion.span>
                )}
                {brandStatus === "error" && (
                  <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-rose-500 text-sm font-black uppercase tracking-widest">
                    Не удалось сохранить
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
              {"Логотип задаётся файлом через «Загрузить» либо ссылкой (путь вроде "}<span className="font-mono">/logo.png</span>{" или внешний "}<span className="font-mono">https://…</span>{"). Цвет применяется к кнопкам опроса; пусто — стандартный фиолетовый градиент."}
            </p>
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
              Вставьте нужный URL в робота <span className="text-indigo-300">«Исходящий вебхук»</span> в Битрикс24: один — для воронки <span className="text-indigo-300">Сделок</span>, другой — для воронки <span className="text-indigo-300">Лидов</span>.
            </p>

            <div className="space-y-2 relative z-10">
              <p className="text-[10px] font-black text-indigo-300/70 uppercase tracking-widest ml-1">Для робота в воронке Сделок</p>
              <div className="bg-white/5 p-5 rounded-2xl font-mono text-xs md:text-sm text-indigo-300 break-all select-all flex items-center justify-between border border-white/5 group hover:bg-white/10 transition-all">
                <span className="break-all">{webhookUrlDeal}</span>
                <Terminal className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity ml-4 shrink-0" />
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <p className="text-[10px] font-black text-emerald-300/70 uppercase tracking-widest ml-1">Для робота в воронке Лидов</p>
              <div className="bg-white/5 p-5 rounded-2xl font-mono text-xs md:text-sm text-emerald-200 break-all select-all flex items-center justify-between border border-white/5 group hover:bg-white/10 transition-all">
                <span className="break-all">{webhookUrlLead}</span>
                <Terminal className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity ml-4 shrink-0" />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium relative z-10 leading-relaxed">
              Метод запроса — GET. Не вешайте оба робота сразу (на сделку и на лид одного клиента), иначе клиент получит две ссылки.
            </p>

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
             <a 
               href="mailto:hobotov.viktor92@gmail.com"
               className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all inline-flex items-center justify-center"
             >
                Связаться
             </a>
          </div>
        </div>
      </div>
    </div>
  );
}
