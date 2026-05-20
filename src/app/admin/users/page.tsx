"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Loader2, Shield, UserCog, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BranchLite {
  id: string;
  name: string;
}
interface AppUser {
  id: string;
  username: string;
  role: "ADMIN" | "MANAGER";
  branches: BranchLite[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<{
    username: string;
    password: string;
    role: "ADMIN" | "MANAGER";
    branchIds: string[];
  }>({ username: "", password: "", role: "MANAGER", branchIds: [] });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/branches?t=${Date.now()}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([u, b]) => {
        setUsers(Array.isArray(u) ? u : []);
        const list = Array.isArray(b) ? b : b.branches || [];
        setBranches(list.map((x: BranchLite) => ({ id: x.id, name: x.name })));
      })
      .catch(() => setErr("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleBranch = (id: string) =>
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((x) => x !== id)
        : [...f.branchIds, id],
    }));

  const create = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Не удалось создать");
        return;
      }
      setForm({ username: "", password: "", role: "MANAGER", branchIds: [] });
      load();
    } catch {
      setErr("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Не удалось обновить");
    }
  };

  const remove = async (id: string, username: string) => {
    if (!confirm(`Удалить пользователя «${username}»?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Не удалось удалить");
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Пользователи</h1>
        <p className="text-slate-500 text-lg font-medium">Доступ к админке и распределение филиалов</p>
      </div>

      {/* Create form */}
      <div className="bento-card bg-white/60 p-8 md:p-10 space-y-6 border-white/40">
        <div className="flex items-center gap-3 text-indigo-600">
          <Plus className="w-6 h-6" />
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Новый пользователь</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Логин"
            className="px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Пароль (мин. 6 символов)"
            autoComplete="new-password"
            className="px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            {(["MANAGER", "ADMIN"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setForm({ ...form, role: r })}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                  form.role === r ? "bg-white shadow-sm text-indigo-600" : "text-slate-400"
                )}
              >
                {r === "ADMIN" ? <Shield className="w-3.5 h-3.5" /> : <UserCog className="w-3.5 h-3.5" />}
                {r === "ADMIN" ? "Админ" : "Менеджер"}
              </button>
            ))}
          </div>
        </div>

        {/* Branch picker — only relevant for managers */}
        {form.role === "MANAGER" && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Доступные филиалы
            </label>
            <div className="flex flex-wrap gap-2">
              {branches.length === 0 && <p className="text-xs text-slate-400 font-medium">Филиалов пока нет</p>}
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggleBranch(b.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
                    form.branchIds.includes(b.id)
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  )}
                >
                  {form.branchIds.includes(b.id) && <Check className="w-3 h-3" />}
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {err && <p className="text-xs text-rose-600 font-bold">{err}</p>}

        <button
          onClick={create}
          disabled={saving || !form.username || !form.password}
          className="flex items-center gap-3 premium-gradient text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 text-sm"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Создать
        </button>
      </div>

      {/* Users list */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-slate-400">
          <Users className="w-5 h-5" />
          <h2 className="text-sm font-black uppercase tracking-widest">Все пользователи ({users.length})</h2>
        </div>
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => (
              <div key={u.id} className="bento-card bg-white/60 p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg",
                      u.role === "ADMIN" ? "bg-slate-900" : "premium-gradient"
                    )}>
                      {u.role === "ADMIN" ? <Shield className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">{u.username}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {u.role === "ADMIN" ? "Администратор" : "Менеджер"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(u.id, u.username)}
                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Role toggle */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  {(["MANAGER", "ADMIN"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => u.role !== r && updateUser(u.id, { role: r })}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        u.role === r ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {r === "ADMIN" ? "Админ" : "Менеджер"}
                    </button>
                  ))}
                </div>

                {/* Branch assignment for managers */}
                {u.role === "MANAGER" && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Филиалы</p>
                    <div className="flex flex-wrap gap-1.5">
                      {branches.map((b) => {
                        const has = u.branches.some((x) => x.id === b.id);
                        return (
                          <button
                            key={b.id}
                            onClick={() => {
                              const next = has
                                ? u.branches.filter((x) => x.id !== b.id).map((x) => x.id)
                                : [...u.branches.map((x) => x.id), b.id];
                              updateUser(u.id, { branchIds: next });
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                              has
                                ? "bg-indigo-500 text-white border-indigo-500"
                                : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                            )}
                          >
                            {b.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
