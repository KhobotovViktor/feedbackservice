import { prisma } from "@/lib/prisma";
import { Star, MessageSquare, Users, TrendingUp, QrCode, Eye, MousePointer2, AlertCircle, ArrowRight } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";

interface BentoCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  bg: string;
  desc: string;
  className?: string;
}

function BentoMetricCard({ label, value, icon: Icon, color, bg, desc, className }: BentoCardProps) {
  return (
    <div className={`bento-card flex flex-col justify-between group h-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 leading-tight tracking-tighter">{value}</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

import { PeriodFilter } from "@/components/dashboard/period-filter";

export default async function AdminDashboard({ 
  searchParams 
}: { 
  searchParams: Promise<{ period?: string; from?: string; to?: string }> 
}) {
  const { period, from, to } = await searchParams;
  
  let dateFilter: any = {};
  if (period === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    dateFilter = { gte: d };
  } else if (period === "custom") {
    if (from || to) {
      dateFilter = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
    }
  }

  const whereWithDate = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [
    totalResponses,
    totalViews,
    totalClicks,
    negativeResponses,
    branchesRaw
  ] = await Promise.all([
    prisma.surveyResponse.count({ where: whereWithDate }),
    prisma.analyticsEvent.count({ where: { ...whereWithDate, type: "VIEW" } }),
    prisma.analyticsEvent.count({ where: { ...whereWithDate, type: "CLICK" } }),
    prisma.surveyResponse.count({ where: { ...whereWithDate, averageScore: { lt: 4 } } }),
    prisma.branch.findMany({
      include: {
        surveyResponses: { 
          where: whereWithDate,
          select: { averageScore: true } 
        }
      }
    })
  ]);

  const branchStats = branchesRaw.map((branch: any) => {
    const scores = (branch.surveyResponses as { averageScore: number }[]).map(r => r.averageScore);
    const avg = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
    return { id: branch.id, name: branch.name, avg, count: scores.length };
  });

  const globalMean = branchStats.length > 0 
    ? (branchStats.reduce((acc: number, curr: any) => acc + curr.avg, 0) / branchStats.length).toFixed(1)
    : "0.0";

  // Conversion calculations
  const openRate = totalViews > 0 ? ((totalResponses / totalViews) * 100).toFixed(1) : "0";
  const clickThroughRate = totalResponses > 0 ? ((totalClicks / totalResponses) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Дашборд</h1>
          <p className="text-slate-500 text-base md:text-lg font-medium">Аналитика качества сервиса в режиме реального времени</p>
        </div>
        <div className="flex gap-2 p-1.5 glass rounded-2xl w-fit border-white/50">
          <button className="whitespace-nowrap px-6 py-2.5 bg-white shadow-xl shadow-indigo-500/10 rounded-xl text-sm font-black text-indigo-600 transition-all">Всё время</button>
          <button className="whitespace-nowrap px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-all">30 дней</button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
        {/* Row 1: Key Metrics */}
        <BentoMetricCard 
          label="Охват" 
          value={totalViews} 
          icon={Eye} 
          color="text-indigo-600" 
          bg="bg-indigo-50" 
          desc="Общее кол-во уникальных просмотров опроса через QR или ссылки."
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Отклики" 
          value={totalResponses} 
          icon={MessageSquare} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
          desc={`${openRate}% клиентов завершили опрос до конца.`}
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Конверсия" 
          value={totalClicks} 
          icon={MousePointer2} 
          color="text-amber-600" 
          bg="bg-amber-50" 
          desc={`${clickThroughRate}% перешли на карты после оценки.`}
          className="md:row-span-1"
        />
        <BentoMetricCard 
          label="Критично" 
          value={negativeResponses} 
          icon={AlertCircle} 
          color="text-rose-600" 
          bg="bg-rose-50" 
          desc="Количество отзывов с оценкой ниже 4 звезд."
          className="md:row-span-1"
        />

        {/* Row 2 & 3: Main Funnel Visual & Branch Sidebar */}
        <div className="md:col-span-2 lg:col-span-3 lg:row-span-2 bento-card relative overflow-hidden flex flex-col min-h-[500px]">
          <div className="relative z-10 flex flex-col h-full">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-10">
              <TrendingUp className="w-8 h-8 text-indigo-500" />
              Воронка вовлеченности
            </h2>
            
            <div className="flex-1 space-y-10 max-w-3xl">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Просмотр</span>
                  <span className="text-2xl font-black text-slate-900">{totalViews}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full premium-gradient w-full rounded-full"></div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 pl-8 md:pl-16">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Заполнение ({openRate}%)</span>
                  <span className="text-2xl font-black text-slate-900">{totalResponses}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full rounded-full shadow-lg shadow-emerald-500/20" style={{ width: `${openRate}%` }}></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 pl-16 md:pl-32">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Переход на карты ({clickThroughRate}%)</span>
                  <span className="text-2xl font-black text-slate-900">{totalClicks}</span>
                </div>
                <div className="h-4 bg-slate-100/50 rounded-full border border-white/40 overflow-hidden">
                  <div className="h-full bg-amber-500 w-full rounded-full shadow-lg shadow-amber-500/20" style={{ width: `${(Number(openRate) * Number(clickThroughRate) / 100) || 0}%` }}></div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-6">
                <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50 flex-1">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Лояльность сети</p>
                   <p className="text-3xl font-black text-indigo-600 tracking-tighter">{globalMean}</p>
                   <div className="flex items-center gap-0.5 mt-2">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= Number(globalMean) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                   </div>
                </div>
                <div className="p-6 rounded-[2rem] bg-slate-900 text-white flex-1 relative overflow-hidden group">
                   <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Общий рейтинг</p>
                      <p className="text-3xl font-black text-white tracking-tighter">Excellent</p>
                      <p className="text-[10px] font-bold text-emerald-400 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> +12% к прошлому месяцу
                      </p>
                   </div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full group-hover:bg-indigo-500/20 transition-all" />
                </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] -mr-64 -mt-64 rounded-full"></div>
        </div>

        <div className="lg:row-span-2 bento-card flex flex-col h-full bg-white/40 min-h-[500px]">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-slate-900">По филиалам</h3>
             <Users className="w-6 h-6 text-slate-300" />
          </div>
          
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {branchStats.map((branch: any) => (
              <div key={branch.id} className="p-5 glass rounded-2xl hover:scale-[1.02] transition-all border-white/60 mb-1">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-slate-800 text-sm truncate pr-2">{branch.name}</p>
                  <div className="flex items-center gap-1 text-slate-900 font-black text-sm shrink-0">
                    {branch.avg.toFixed(1)}
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.15em]">
                  <span className="text-slate-400">{branch.count} ответов</span>
                  <span className={branch.avg >= 4 ? "text-emerald-500" : "text-rose-500"}>
                    {branch.avg >= 4 ? "Excellent" : "Needs Review"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4: QR Access */}
        <div className="md:col-span-2 lg:col-span-4 lg:row-span-2 bg-slate-900 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden group min-h-[400px]">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-3 px-5 py-2 glass-dark rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-white/80 border-white/5">
                <QrCode className="w-4 h-4 text-indigo-400" />
                System QR Control
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tighter">Масштабируйте сбор <br className="hidden md:block"/> лояльности мгновенно</h2>
              <p className="text-slate-400 text-lg font-medium max-w-lg">Единый QR-код для всей сети. Просто разместите его на видном месте.</p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a 
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL || "https://alleyafeedbackservice.vercel.app"}/survey/qr`)}`}
                  target="_blank"
                  className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black hover:scale-[1.03] active:scale-[0.98] transition-all text-center shadow-xl shadow-white/10"
                >
                  Скачать QR
                </a>
                <CopyLinkButton url={`https://alleyafeedbackservice.vercel.app/survey/qr`} />
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full animate-pulse"></div>
              <div className="relative w-48 h-48 md:w-64 md:h-64 bg-white p-6 rounded-[2.5rem] shadow-2xl transform hover:rotate-2 transition-transform duration-700">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL || "https://alleyafeedbackservice.vercel.app"}/survey/qr`)}`}
                  alt="Main QR"
                  className="w-full h-full rounded-2xl"
                />
              </div>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
