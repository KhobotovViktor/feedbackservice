"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MessageSquare, Settings, LogOut, Star, Link as LinkIcon, Building2, Menu, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { label: "Дашборд", href: "/admin", icon: LayoutDashboard },
    { label: "Интеграция", href: "/admin/integration", icon: LinkIcon },
    { label: "Вопросы", href: "/admin/questions", icon: Settings },
    { label: "Результаты", href: "/admin/results", icon: MessageSquare },
    { label: "Филиалы", href: "/admin/branches", icon: Building2 },
    { label: "Шаблоны", href: "/admin/templates", icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen noise-overlay selection:bg-indigo-100 selection:text-indigo-600">
      <div className="mesh-gradient" />
      
      {/* Floating Header / Brand (Mobile) */}
      <header className="md:hidden sticky top-0 z-[60] p-4">
        <div className="glass rounded-2xl p-4 flex items-center justify-between border-white/40 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg p-1">
              <img src="/logo_alleya.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight leading-none text-slate-900">Аллея Мебели</span>
              <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Feedback Service</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Floating Navigation (Desktop) */}
      <nav className="fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
        <div className="glass-dark rounded-[2.5rem] p-3 flex flex-col gap-3 shadow-2xl border-white/5">
          <div className="py-4 mb-2 flex justify-center">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6 shrink-0 p-1.5 border border-white/10">
                <img src="/logo_alleya.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "w-12 h-12 rounded-2xl transition-all relative group flex items-center justify-center shrink-0 mx-auto",
                  isActive 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                )}
                title={item.label}
              >
                <Icon className="w-6 h-6 shrink-0" />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 transition-all pointer-events-none group-hover:opacity-100 whitespace-nowrap shadow-xl">
                    {item.label}
                </span>
              </Link>
            );
          })}
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
             <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-12 h-12 flex items-center justify-center text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all disabled:opacity-50 shrink-0 mx-auto"
             >
                {isLoggingOut ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
             </button>
          </div>
        </div>
      </nav>

      {/* Side Drawer (Mobile/Tablet) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-4 left-4 w-72 glass-dark z-[80] md:hidden rounded-[2.5rem] p-6 border-white/10 shadow-2xl flex flex-col"
            >
              <div className="flex items-center gap-4 mb-10 px-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl p-1.5">
                  <img src="/logo_alleya.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-xl text-white tracking-tight leading-none">Аллея Мебели</span>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">Feedback Service</span>
                </div>
              </div>
              
              <nav className="space-y-2 flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold",
                        isActive 
                          ? "bg-indigo-500 text-white shadow-xl shadow-indigo-500/20" 
                          : "text-slate-400 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-4 px-6 py-4 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all font-bold mt-auto border-t border-white/5 disabled:opacity-50"
              >
                {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                Выйти
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:pl-32 p-4 md:p-8 pt-6 md:pt-12 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
