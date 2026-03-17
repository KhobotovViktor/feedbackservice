import Link from "next/link";
import { Star, LayoutDashboard, Settings as SettingsIcon, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl mb-4">
          <Star className="w-12 h-12 text-indigo-600 fill-indigo-600" />
        </div>
        
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-slate-900">
          Feedback <span className="text-indigo-600">Service</span>
        </h1>
        
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Профессиональная система сбора обратной связи для клиентов Битрикс24. 
          Автоматизируйте оценку качества обслуживания и повышайте лояльность.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12">
          <Link 
            href="/admin" 
            className="group p-8 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <LayoutDashboard size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Панель управления</h3>
            <p className="text-slate-500 mb-6">Управляйте вопросами, просматривайте результаты и настраивайте интеграцию.</p>
            <div className="flex items-center text-indigo-600 font-semibold">
              Перейти в админку <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link 
            href="/admin/integration" 
            className="group p-8 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <SettingsIcon size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Настройка Bitrix24</h3>
            <p className="text-slate-500 mb-6">Инструкции по подключению вебхуков и автоматизации отправки ссылок.</p>
            <div className="flex items-center text-indigo-600 font-semibold">
              Как настроить? <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        <div className="pt-16 text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Feedback Service. Разработано для улучшения клиентского опыта.
        </div>
      </div>
    </div>
  );
}
