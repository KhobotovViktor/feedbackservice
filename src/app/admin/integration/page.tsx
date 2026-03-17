"use client";

import { useState, useEffect } from "react";
import { Terminal, Link as LinkIcon, Save, MessageSquare, Info, CheckCircle2 } from "lucide-react";

export default function IntegrationPage() {
  const [settings, setSettings] = useState({
    b24_webhook_url: "",
    b24_message_template: "Оцените качество обслуживания по ссылке: {surveyUrl}",
    b24_field_quality: "",
    b24_field_support: "",
    b24_field_average: "",
    b24_field_comment: "",
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
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Интеграция с Битрикс24</h1>
        <p className="text-slate-500">Настройка автоматической отправки опросов и обратной связи в CRM</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Outbound Integration Settings */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-indigo-600 mb-2">
              <Save className="w-6 h-6" />
              <h2 className="text-xl font-bold text-slate-900">Автоматическая отправка</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Входящий вебхук Битрикс24
                </label>
                <input
                  type="text"
                  placeholder="https://your-domain.bitrix24.ru/rest/1/xxxxx/..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm"
                  value={settings.b24_webhook_url}
                  onChange={(e) => setSettings({ ...settings, b24_webhook_url: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Создайте в Битрикс24 (Маркет → Локальные приложения → Входящий вебхук) с правами на CRM.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Шаблон сообщения клиенту
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  value={settings.b24_message_template}
                  onChange={(e) => setSettings({ ...settings, b24_message_template: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Используйте тег <code className="bg-slate-100 px-1 rounded">{"{surveyUrl}"}</code> для вставки ссылки на опрос.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-4">
                  <Terminal className="w-5 h-5" />
                  <h3 className="font-bold">Маппинг полей CRM (ID полей UF_...)</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Качество обслуживания
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      value={settings.b24_field_quality}
                      onChange={(e) => setSettings({ ...settings, b24_field_quality: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Работа сотрудника
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      value={settings.b24_field_support}
                      onChange={(e) => setSettings({ ...settings, b24_field_support: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Средняя оценка
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      value={settings.b24_field_average}
                      onChange={(e) => setSettings({ ...settings, b24_field_average: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Комментарий
                    </label>
                    <input
                      type="text"
                      placeholder="UF_CRM_..."
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      value={settings.b24_field_comment}
                      onChange={(e) => setSettings({ ...settings, b24_field_comment: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Укажите ID пользовательских полей из Битрикс24 (Настройки → Настройки CRM → Настройки форм и отчетов → Пользовательские поля).
                </p>
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200"
                >
                  {saving ? "Сохранение..." : "Сохранить настройки"}
                  {!saving && <Save size={18} />}
                </button>
                {status === "success" && (
                  <span className="text-emerald-600 flex items-center gap-1.5 text-sm font-medium animate-in fade-in slide-in-from-left-4">
                    <CheckCircle2 size={16} /> Настройки сохранены
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-indigo-600 mb-2">
              <LinkIcon className="w-6 h-6" />
              <h2 className="text-xl font-bold text-slate-900">Webhook URL для Роботов</h2>
            </div>
            <p className="text-slate-600 text-sm">Скопируйте этот URL и вставьте его в настройки робота "Webhook" в Битрикс24:</p>
            <div className="bg-slate-900 p-4 rounded-xl font-mono text-sm text-indigo-300 break-all select-all cursor-pointer">
              {webhookUrl}
            </div>
          </div>
        </div>

        {/* Instructions Sidebar */}
        <div className="space-y-6">
          <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
            <h3 className="flex items-center gap-2 font-bold text-indigo-900 mb-4">
              <Info size={18} /> Быстрый старт
            </h3>
            <div className="space-y-4 text-sm text-indigo-800/80">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
                <p>Получите входящий вебхук в Битрикс24 и вставьте его в поле слева.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
                <p>Настройте робота на стадию "Завершено" в CRM, указав наш Webhook URL.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0 font-bold">3</div>
                <p>Система сама сгенерирует ссылку и отправит её в таймлайн сделки.</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100">
            <h3 className="flex items-center gap-2 font-bold text-amber-900 mb-4">
              <MessageSquare size={18} /> Важно
            </h3>
            <p className="text-sm text-amber-800/80 leading-relaxed">
              Для автоматической отправки клиенту в чат Битрикс24 убедитесь, что ваш вебхук имеет права доступа к модулю "CRM" и "Телефония" (для SMS) или "Чат и уведомления".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
