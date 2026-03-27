"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Activity } from "lucide-react";

interface Props {
  data: any[];
}

export function OverallMonitoring({ data }: Props) {
  const [metric, setMetric] = useState<'rating' | 'reviews'>('rating');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Aggregation logic: group by date
  const aggregated = data.reduce((acc: any, curr: any) => {
    const date = new Date(curr.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' });
    if (!acc[date]) acc[date] = { date, ratings: [], reviews: 0 };
    
    acc[date].ratings.push(curr.rating);
    acc[date].reviews += curr.reviewCount;
    return acc;
  }, {});

  const chartData = Object.values(aggregated).map((d: any) => ({
    date: d.date,
    value: metric === 'rating' 
      ? parseFloat((d.ratings.reduce((a: number, b: number) => a + b, 0) / d.ratings.length).toFixed(2))
      : d.reviews,
    label: metric === 'rating' ? 'Средняя оценка' : 'Всего отзывов'
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-500" />
          Общий мониторинг
        </h3>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setMetric('rating')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${metric === 'rating' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Оценка
          </button>
          <button 
            onClick={() => setMetric('reviews')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${metric === 'reviews' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Отзывы
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[350px] relative">
        {(isMounted && chartData.length > 0) ? (
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValueOverall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  hide={true} 
                  domain={metric === 'rating' ? [1, 5] : ['auto', 'auto']} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '1.25rem', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    fontWeight: 'black'
                  }}
                  formatter={(value: any, name: any, props: any) => [value, props.payload.label]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorValueOverall)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
             <p className="text-slate-400 font-bold text-sm">
               {!isMounted ? "Загрузка графика..." : "Недостаточно данных для графика"}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
