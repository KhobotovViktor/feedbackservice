import { prisma } from "@/lib/prisma";
import { Star } from "lucide-react";

export default async function ResultsPage() {
  const responses = await prisma.surveyResponse.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Результаты опросов</h1>
        <p className="text-slate-500">История всех полученных отзывов</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">Дата</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Client ID / Deal ID</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Средний балл</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Комментарий</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {responses.map((res) => (
              <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(res.createdAt).toLocaleDateString()} {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900">{res.clientId}</div>
                  <div className="text-xs text-slate-400">Deal: {res.dealId}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{res.averageScore.toFixed(1)}</span>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                  {res.comment || <span className="text-slate-300 italic">Нет комментария</span>}
                </td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  Ответов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
