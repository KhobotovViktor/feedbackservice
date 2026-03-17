import { prisma } from "@/lib/prisma";
import { Star, MessageSquare, Users, TrendingUp } from "lucide-react";

export default async function AdminDashboard() {
  const totalResponses = await prisma.surveyResponse.count();
  const avgScoreRes = await prisma.surveyResponse.aggregate({
    _avg: { averageScore: true }
  });
  const avgScore = avgScoreRes._avg.averageScore?.toFixed(1) || "0.0";
  
  const stats = [
    { label: "Всего ответов", value: totalResponses, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Средний балл", value: avgScore, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Конверсия", value: "24%", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Клиенты", value: totalResponses, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Дашборд</h1>
        <p className="text-slate-500">Обзор результатов опроса и активности</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <h2 className="text-xl font-bold mb-6">Последняя активность</h2>
        <div className="text-center py-12 text-slate-400">
          Здесь будет график активности...
        </div>
      </div>
    </div>
  );
}
