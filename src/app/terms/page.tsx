import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 py-16 px-6 md:py-24 animate-in fade-in duration-700">
      <div className="max-w-3xl mx-auto space-y-12">
        <Link 
          href="/login"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Вернуться назад
        </Link>

        <div className="space-y-4">
          <div className="w-16 h-16 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-6">
             <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Пользовательское соглашение</h1>
          <p className="text-slate-400 font-medium">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
        </div>

        <div className="prose prose-slate prose-lg max-w-none space-y-8 font-medium text-slate-600 leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Термины и определения</h2>
            <p>
              В настоящем Соглашении используются следующие термины:
              <br />
              <b>Сервис</b> — программный комплекс «Аллея Фидбек», расположенный по адресу alleyafeedbackservice.vercel.app.
              <br />
              <b>Пользователь</b> — любое физическое лицо, использующее интерфейс Сервиса для отправки отзыва.
              <br />
              <b>Оператор</b> — администрация сети «Аллея Мебели», ответственная за обработку полученных данных.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. Предмет соглашения</h2>
            <p>
              Сервис предоставляет Пользователю возможность оставить добровольный и анонимный (или персонализированный, по желанию) отзыв о качестве обслуживания в филиалах «Аллея Мебели».
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Права и обязанности сторон</h2>
            <p>
              Пользователь обязуется не использовать ненормативную лексику и не предоставлять заведомо ложную информацию, порочащую честь и достоинство сотрудников.
            </p>
            <p>
              Оператор обязуется использовать полученную информацию исключительно для повышения качества сервиса и внутренних аналитических целей.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Интеллектуальная собственность</h2>
            <p>
              Все права на дизайн, логотипы и программный код Сервиса принадлежат исключительно Оператору. Любое копирование без разрешения запрещено.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">5. Заключительные положения</h2>
            <p>
              Использование Сервиса (нажатие кнопки «Отправить») означает полное согласие Пользователя с условиями настоящего Соглашения и Политикой конфиденциальности.
            </p>
          </section>
        </div>

        <div className="pt-12 border-t border-slate-100 flex flex-col items-center gap-6">
           <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Аллея Мебели © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
