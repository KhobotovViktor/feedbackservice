"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Lock, User, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Ошибка входа");
      }
    } catch (err) {
      setError("Произошла ошибка. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-slate-50 to-indigo-50/30">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-[2rem] p-10 shadow-2xl shadow-indigo-100 border border-slate-100 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-50/50 rounded-full -ml-12 -mb-12 blur-2xl"></div>

          <div className="relative z-10 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-100 border border-slate-50 overflow-hidden p-2">
                <img src="/logoalleya.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-1">
                <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px] leading-none mb-1">Сервис обратной связи</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">«Аллея Мебели»</h1>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Имя пользователя"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Пароль"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 premium-gradient text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200/50 hover:opacity-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Авторизоваться"}
              </button>
            </form>

            <p className="text-center text-slate-400 text-xs font-medium pt-4">
              &copy; {new Date().getFullYear()} ИП Шевелёв Е.Н. Доступ только для сотрудников компании.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
