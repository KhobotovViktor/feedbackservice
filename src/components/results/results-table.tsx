"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Star, User, MessageCircle, TrendingUp, Trash2, Loader2, X, AlertCircle, ExternalLink, Phone, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComplaintStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export interface ResultRow {
  id: string;
  clientId: string;
  dealId: string;
  averageScore: number;
  comment: string | null;
  createdAt: string | Date;
  responsibleName: string | null;
  branch: { name: string } | null;
  complaintStatus: ComplaintStatus | null;
  entityType: string | null;
  // AI auto-tags derived from the comment (Claude).
  tags?: string[];
  // Optional contact phone from the negative-feedback step.
  phone?: string | null;
  // Close-the-loop fields.
  resolutionNote?: string | null;
  resolvedAt?: string | Date | null;
}

// SLA thresholds (hours) past which an open complaint is flagged overdue.
const OVERDUE_NEW_H = 24;
const OVERDUE_INPROGRESS_H = 72;

// Deep-link into the deal/lead in Bitrix24, when we know the portal + a real
// CRM id (not a QR scan or test).
function crmLink(portalUrl: string, res: ResultRow): string | null {
  if (!portalUrl) return null;
  const id = res.dealId;
  if (!id || id === "0" || id === "TEST_DEAL" || id.startsWith("QR")) return null;
  const type = res.entityType === "lead" ? "lead" : "deal";
  return `${portalUrl}/crm/${type}/details/${id}/`;
}

const STATUS_META: Record<ComplaintStatus, { label: string; cls: string; next?: ComplaintStatus; nextLabel?: string }> = {
  NEW: {
    label: "Новая",
    cls: "text-rose-600 bg-rose-50 border-rose-200",
    next: "IN_PROGRESS",
    nextLabel: "В работу",
  },
  IN_PROGRESS: {
    label: "В работе",
    cls: "text-amber-600 bg-amber-50 border-amber-200",
    next: "RESOLVED",
    nextLabel: "Решена",
  },
  RESOLVED: {
    label: "Решена",
    cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
    next: "IN_PROGRESS",
    nextLabel: "Вернуть",
  },
};

// Compact RU "how long ago" / "how long it took" helpers for the SLA badge.
function ageText(from: string | Date): string {
  const h = Math.floor((Date.now() - new Date(from).getTime()) / 3600_000);
  if (h < 1) return "только что";
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}
function durationText(from: string | Date, to: string | Date): string {
  const h = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 3600_000);
  if (h < 24) return `${Math.max(1, h)} ч`;
  return `${Math.round(h / 24)} дн`;
}

function sourceText(res: ResultRow): string {
  const isCRM =
    res.dealId &&
    res.dealId !== "0" &&
    res.dealId !== "TEST_DEAL" &&
    res.dealId !== "QR_GUEST";
  if (res.branch?.name) return `${res.branch.name} ${isCRM ? "(CRM)" : "(QR)"}`;
  if (isCRM) return "Bitrix24 (CRM)";
  return "Прямая ссылка / QR";
}

function isCrmSource(res: ResultRow): boolean {
  return Boolean(
    res.dealId &&
      res.dealId !== "0" &&
      res.dealId !== "TEST_DEAL" &&
      res.dealId !== "QR_GUEST"
  );
}

// AI auto-tags as small chips (e.g. #доставка #цена).
function TagChips({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tags.map((t) => (
        <span
          key={t}
          className="text-[9px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-500 border border-indigo-100/50 tracking-wider"
        >
          #{t}
        </span>
      ))}
    </div>
  );
}

export function ResultsTable({
  responses,
  portalUrl = "",
}: {
  responses: ResultRow[];
  portalUrl?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = responses.length > 0 && selected.size === responses.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === responses.length ? new Set() : new Set(responses.map((r) => r.id))
    );

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Удалить выбранные результаты (${selected.size})? Действие необратимо.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Не удалось удалить: ${data.error || res.statusText}`);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети при удалении.");
    } finally {
      setDeleting(false);
    }
  };

  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  // Resolve modal: capturing an optional resolution note when closing a complaint.
  const [resolveTarget, setResolveTarget] = useState<ResultRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const setStatus = async (id: string, complaintStatus: ComplaintStatus, resolutionNote?: string) => {
    setStatusBusy(id);
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintStatus,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
        }),
      });
      if (res.ok) {
        setResolveTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Не удалось обновить статус: ${data.error || res.statusText}`);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети при смене статуса.");
    } finally {
      setStatusBusy(null);
    }
  };

  const openResolve = (res: ResultRow) => {
    setResolveNote(res.resolutionNote || "");
    setResolveTarget(res);
  };

  // Complaint status badge + SLA timer + next-action button for a negative response.
  const Complaint = ({ res }: { res: ResultRow }) => {
    if (!res.complaintStatus) return <span className="text-slate-200">—</span>;
    const meta = STATUS_META[res.complaintStatus];
    const busy = statusBusy === res.id;
    const open = res.complaintStatus !== "RESOLVED";
    const ageH = (Date.now() - new Date(res.createdAt).getTime()) / 3600_000;
    const overdue =
      open &&
      ((res.complaintStatus === "NEW" && ageH > OVERDUE_NEW_H) ||
        (res.complaintStatus === "IN_PROGRESS" && ageH > OVERDUE_INPROGRESS_H));
    return (
      <div className="flex flex-col items-start gap-1.5">
        <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest inline-flex items-center gap-1", meta.cls)}>
          <AlertCircle className="w-3 h-3" />
          {meta.label}
        </span>

        {/* SLA timer: how long it's been open, or how long it took to resolve. */}
        {open ? (
          <span className={cn("text-[9px] font-bold inline-flex items-center gap-1", overdue ? "text-rose-500" : "text-slate-400")}>
            <Clock className="w-3 h-3" />
            {overdue ? "просрочено · " : ""}{ageText(res.createdAt)}
          </span>
        ) : res.resolvedAt ? (
          <span className="text-[9px] font-bold text-emerald-500 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            закрыта за {durationText(res.createdAt, res.resolvedAt)}
          </span>
        ) : null}

        {meta.next && (
          <button
            onClick={() => (meta.next === "RESOLVED" ? openResolve(res) : setStatus(res.id, meta.next!))}
            disabled={busy}
            className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 uppercase tracking-widest inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {meta.nextLabel}
          </button>
        )}

        {/* Stored resolution note. */}
        {res.complaintStatus === "RESOLVED" && res.resolutionNote && (
          <p className="text-[10px] text-slate-500 italic leading-snug max-w-[200px] break-words">«{res.resolutionNote}»</p>
        )}
      </div>
    );
  };

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const fmtTime = (d: string | Date) =>
    new Date(d).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });

  return (
    <div className="space-y-4">
      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Снять выделение"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-black">Выбрано: {selected.size}</span>
          </div>
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить выбранные
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden xl:block bento-card p-0 overflow-hidden border-white/40 shadow-2xl shadow-indigo-500/5">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="w-[5%] px-6 py-6 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Выбрать все"
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </th>
              <th className="w-[13%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Дата</th>
              <th className="w-[15%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Источник</th>
              <th className="w-[14%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Клиент / Сделка</th>
              <th className="w-[8%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60 text-center">Оценка</th>
              <th className="w-[12%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Ответственный</th>
              <th className="w-[13%] px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Жалоба</th>
              <th className="px-6 py-6 font-black text-[10px] uppercase tracking-widest opacity-60">Комментарий</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/40">
            {responses.map((res) => (
              <tr
                key={res.id}
                className={cn(
                  "transition-colors group",
                  selected.has(res.id) ? "bg-indigo-50/60" : "hover:bg-white"
                )}
              >
                <td className="px-6 py-6 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(res.id)}
                    onChange={() => toggle(res.id)}
                    aria-label="Выбрать строку"
                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-indigo-400/40 shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-black text-slate-900 whitespace-nowrap">{fmtDate(res.createdAt)}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fmtTime(res.createdAt)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <div className={cn(
                    "text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest inline-block",
                    res.branch?.name
                      ? "text-indigo-600 bg-indigo-50 border-indigo-100/30"
                      : isCrmSource(res)
                        ? "text-amber-600 bg-amber-50 border-amber-100/30"
                        : "text-slate-400 bg-slate-50 border-slate-100/30"
                  )}>
                    {sourceText(res)}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="text-sm font-black text-slate-900 tracking-tight truncate">{res.clientId || "Incognito"}</div>
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 opacity-60 truncate">
                    {res.entityType === "lead" ? "Лид" : "Сделка"}: {res.dealId || "—"}
                  </div>
                  {res.phone && (
                    <a href={`tel:${res.phone}`} className="text-[11px] font-black text-emerald-600 mt-1 flex items-center gap-1 truncate hover:text-emerald-700 transition-colors">
                      <Phone className="w-3 h-3 shrink-0" /> {res.phone}
                    </a>
                  )}
                  {crmLink(portalUrl, res) && (
                    <a
                      href={crmLink(portalUrl, res)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> В Битрикс24
                    </a>
                  )}
                </td>
                <td className="px-6 py-6 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-black text-slate-900 text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{res.responsibleName || "—"}</div>
                </td>
                <td className="px-6 py-6">
                  <Complaint res={res} />
                </td>
                <td className="px-6 py-6 text-sm text-slate-600 font-medium leading-relaxed">
                  {res.comment ? (
                    <span className="italic">{`“${res.comment}”`}</span>
                  ) : (
                    <span className="text-slate-200 italic">Нет комментария</span>
                  )}
                  <TagChips tags={res.tags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
        {responses.map((res) => {
          const ratingColor = res.averageScore >= 4 ? "text-emerald-500 bg-emerald-50 border-emerald-100" : "text-rose-500 bg-rose-50 border-rose-100";
          return (
            <div
              key={res.id}
              className={cn(
                "bento-card group flex flex-col",
                selected.has(res.id) ? "bg-indigo-50/70 ring-2 ring-indigo-300" : "bg-white/60"
              )}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(res.id)}
                    onChange={() => toggle(res.id)}
                    aria-label="Выбрать"
                    className="w-4 h-4 mt-1 rounded accent-indigo-500 cursor-pointer shrink-0"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" />
                      {fmtDate(res.createdAt)} {fmtTime(res.createdAt)}
                    </div>
                    <div className={cn(
                      "text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest inline-block",
                      res.branch?.name
                        ? "text-indigo-600 bg-indigo-50 border-indigo-100/30"
                        : isCrmSource(res)
                          ? "text-amber-600 bg-amber-50 border-amber-100/30"
                          : "text-slate-400 bg-slate-50 border-slate-100/30"
                    )}>
                      {sourceText(res)}
                    </div>
                  </div>
                </div>
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm", ratingColor)}>
                  <span className="font-black text-xl tracking-tighter">{res.averageScore.toFixed(1)}</span>
                  <Star className="w-4 h-4 fill-current" />
                </div>
              </div>

              <div className="flex items-center gap-4 p-5 glass border-white/60 rounded-3xl mb-6">
                <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black text-slate-900 tracking-tight truncate">{res.clientId || "Incognito"}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                      {res.entityType === "lead" ? "Лид" : "Сделка"}: {res.dealId || "—"}
                    </p>
                    {res.responsibleName && (
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50/50 px-1.5 py-0.5 rounded">Resp: {res.responsibleName}</p>
                    )}
                    {res.phone && (
                      <a href={`tel:${res.phone}`} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {res.phone}
                      </a>
                    )}
                  </div>
                  {crmLink(portalUrl, res) && (
                    <a
                      href={crmLink(portalUrl, res)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Открыть в Битрикс24
                    </a>
                  )}
                </div>
              </div>

              {res.complaintStatus && (
                <div className="flex items-center justify-between gap-3 p-4 bg-rose-50/40 border border-rose-100/40 rounded-2xl mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Жалоба</span>
                  <Complaint res={res} />
                </div>
              )}

              {res.comment && (
                <div className="p-6 bg-indigo-50/20 rounded-3xl border border-indigo-100/20 mt-auto relative overflow-hidden">
                  <MessageCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/5 rotate-12" />
                  <div className="relative z-10 flex gap-4 items-start">
                    <TrendingUp className="w-6 h-6 text-indigo-400 shrink-0 mt-1 opacity-40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-slate-700 font-bold leading-relaxed italic opacity-80">“{res.comment}”</p>
                      <TagChips tags={res.tags} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolve modal: optional note when closing a complaint */}
      {resolveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
          onClick={() => !statusBusy && setResolveTarget(null)}
        >
          <div
            className="glass border-white/60 rounded-[2rem] shadow-2xl p-8 max-w-md w-full space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Решение жалобы</h3>
                <p className="text-[11px] font-bold text-slate-400">
                  {resolveTarget.clientId || "Incognito"} · оценка {resolveTarget.averageScore.toFixed(1)}
                </p>
              </div>
            </div>

            {resolveTarget.comment && (
              <p className="text-xs text-slate-500 italic bg-slate-50/60 rounded-xl p-3 border border-slate-100 leading-relaxed">
                «{resolveTarget.comment}»
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Что сделано для решения (необязательно)</label>
              <textarea
                rows={3}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Связались с клиентом, заменили товар, принесли извинения…"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-medium resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResolveTarget(null)}
                disabled={!!statusBusy}
                className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all text-xs disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => setStatus(resolveTarget.id, "RESOLVED", resolveNote.trim())}
                disabled={!!statusBusy}
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Отметить решённой
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
