import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai";
import { CheckCircle2, AlertTriangle, XCircle, Database, Webhook, Send, MessageSquare, Bot, Star, RefreshCw, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "settings.update": "Настройки",
  "complaint.status": "Жалоба",
  "user.create": "Пользователь +",
  "user.update": "Пользователь ✎",
  "user.delete": "Пользователь ✕",
};

type Level = "ok" | "warn" | "bad";

const LEVEL_META: Record<Level, { cls: string; icon: LucideIcon; label: string }> = {
  ok: { cls: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle2, label: "Работает" },
  warn: { cls: "text-amber-600 bg-amber-50 border-amber-100", icon: AlertTriangle, label: "Внимание" },
  bad: { cls: "text-rose-600 bg-rose-50 border-rose-100", icon: XCircle, label: "Проблема" },
};

function ago(date: Date | null): string {
  if (!date) return "никогда";
  const h = Math.floor((Date.now() - date.getTime()) / 3600_000);
  if (h < 1) return "только что";
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

// Freshness → level. < 2 days = ok, < 7 = warn, older / never = bad.
function freshness(date: Date | null): Level {
  if (!date) return "bad";
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days < 2) return "ok";
  if (days < 7) return "warn";
  return "bad";
}

function StatusCard({
  title,
  icon: Icon,
  level,
  lines,
}: {
  title: string;
  icon: LucideIcon;
  level: Level;
  lines: string[];
}) {
  const m = LEVEL_META[level];
  const Badge = m.icon;
  return (
    <div className="bento-card bg-white/60 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-black text-slate-900 tracking-tight truncate">{title}</h3>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${m.cls}`}>
          <Badge className="w-3.5 h-3.5" />
          {m.label}
        </span>
      </div>
      <div className="space-y-1">
        {lines.map((l, i) => (
          <p key={i} className="text-[12px] text-slate-500 font-medium leading-relaxed">{l}</p>
        ))}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  let dbOk = true;
  let responses = 0;
  let settingsMap: Record<string, string> = {};
  let lastSent: Date | null = null;
  let lastCrmRating: Date | null = null;
  let ratingByService: { service: string; last: Date | null }[] = [];
  let staleBranchSyncs = 0;
  let auditRows: { id: string; username: string | null; action: string; target: string | null; details: string | null; createdAt: Date }[] = [];

  try {
    const [count, settings, sent, crm, grouped, branchesWithRatings, audit] = await Promise.all([
      prisma.surveyResponse.count(),
      prisma.settings.findMany({
        where: { key: { in: ["b24_webhook_url", "b24_group_chat_id", "telegram_bot_token", "telegram_chat_id"] } },
      }),
      prisma.sentSurvey.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.surveyResponse.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.ratingHistory.groupBy({ by: ["service"], _max: { createdAt: true } }),
      // Per (branch, service) latest sync — count how many are stale (> 2 days).
      prisma.ratingHistory.groupBy({ by: ["branchId", "service"], _max: { createdAt: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    ]);
    responses = count;
    settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    lastSent = sent?.createdAt ?? null;
    lastCrmRating = crm?.createdAt ?? null;
    ratingByService = grouped.map((g) => ({ service: g.service, last: g._max.createdAt ?? null }));
    const cutoff = Date.now() - 2 * 86_400_000;
    staleBranchSyncs = branchesWithRatings.filter(
      (b) => !b._max.createdAt || b._max.createdAt.getTime() < cutoff
    ).length;
    auditRows = audit;
  } catch (e) {
    console.error("status page DB error:", e);
    dbOk = false;
  }

  const b24Configured = Boolean(settingsMap.b24_webhook_url);
  const telegramConfigured = Boolean(settingsMap.telegram_bot_token && settingsMap.telegram_chat_id);
  const aiOn = aiConfigured();

  // Overall rating-sync freshness = newest across all services.
  const newestSync = ratingByService.reduce<Date | null>(
    (acc, r) => (r.last && (!acc || r.last > acc) ? r.last : acc),
    null
  );
  const svcLabel = (s: string) => (s === "yandex" ? "Яндекс" : s === "2gis" ? "2ГИС" : s === "google" ? "Google" : s);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Состояние</h1>
        <p className="text-slate-500 text-lg font-medium">Диагностика интеграций и фоновых процессов</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard
          title="База данных"
          icon={Database}
          level={dbOk ? "ok" : "bad"}
          lines={dbOk ? [`Подключение активно.`, `Всего ответов в базе: ${responses}.`] : ["Нет связи с базой данных."]}
        />

        <StatusCard
          title="Bitrix24 (вебхук)"
          icon={Webhook}
          level={b24Configured ? "ok" : "bad"}
          lines={
            b24Configured
              ? [`Вебхук настроен.`, settingsMap.b24_group_chat_id ? "Групповой чат подключён." : "Групповой чат не указан."]
              : ["Вебхук не настроен — раздел «Интеграция»."]
          }
        />

        <StatusCard
          title="Отправка из CRM"
          icon={Send}
          level={!lastSent ? "warn" : freshness(lastSent)}
          lines={[`Последняя отправка ссылки: ${ago(lastSent)}.`, `Последняя оценка из опроса: ${ago(lastCrmRating)}.`]}
        />

        <StatusCard
          title="Синхронизация рейтингов"
          icon={Star}
          level={freshness(newestSync)}
          lines={[
            `Последний синк: ${ago(newestSync)}.`,
            ratingByService.length > 0
              ? ratingByService.map((r) => `${svcLabel(r.service)}: ${ago(r.last)}`).join(" · ")
              : "Данных пока нет.",
            staleBranchSyncs > 0 ? `⚠️ Филиалов без свежего синка (>2 дн): ${staleBranchSyncs}.` : "Все филиалы синхронизированы свежо.",
          ]}
        />

        <StatusCard
          title="Telegram-уведомления"
          icon={MessageSquare}
          level={telegramConfigured ? "warn" : "bad"}
          lines={
            telegramConfigured
              ? ["Токен и chat_id заданы.", "⚠️ С RU-сервера api.telegram.org может быть заблокирован — проверьте кнопкой «Проверить Telegram»."]
              : ["Не настроено (опционально). Основной канал — групповой чат B24."]
          }
        />

        <StatusCard
          title="AI-анализ (Claude)"
          icon={Bot}
          level={aiOn ? "ok" : "warn"}
          lines={
            aiOn
              ? ["Ключ ANTHROPIC_API_KEY задан — авто-теги и сводки работают."]
              : ["Ключ не задан (опционально). Без него теги/AI-сводки отключены."]
          }
        />
      </div>

      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 px-1">
        <RefreshCw className="w-3.5 h-3.5" />
        Данные обновляются при каждом открытии страницы. Зелёный — норма, жёлтый — обратите внимание, красный — требует действий.
      </div>

      {/* Audit trail */}
      <div className="bento-card bg-white/60 p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Журнал действий</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Последние операции администраторов</p>
          </div>
        </div>
        {auditRows.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium italic py-6 text-center">Записей пока нет.</p>
        ) : (
          <div className="space-y-1.5">
            {auditRows.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 glass border-white/60 rounded-xl text-[12px]">
                <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0 w-28">
                  {a.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-500 border border-indigo-100/50 uppercase tracking-wider shrink-0">
                  {ACTION_LABEL[a.action] ?? a.action}
                </span>
                <span className="font-bold text-slate-700 shrink-0">{a.username || "—"}</span>
                <span className="text-slate-500 font-medium leading-snug break-words flex-1">{a.details || a.target || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
