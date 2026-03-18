import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-6 md:p-12 relative overflow-hidden">
      <div className="mesh-gradient" />
      
      <main className="max-w-4xl mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-indigo-600 font-bold mb-12 hover:gap-4 transition-all"
        >
          <ArrowLeft size={20} />
          Назад к входу
        </Link>

        <div className="glass p-8 md:p-16 rounded-[3rem] shadow-2xl border-white/50 space-y-12">
          <div className="flex flex-col md:flex-row md:items-center gap-6 pb-8 border-b border-indigo-100/30">
            <div className="w-20 h-20 premium-gradient rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 transform -rotate-12">
              <ShieldCheck size={40} />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">Политика конфиденциальности</h1>
              <p className="text-slate-500 text-lg font-medium">Ваша безопасность и приватность — наш приоритет</p>
            </div>
          </div>

          <div className="prose prose-indigo prose-lg max-w-none text-slate-600 font-medium leading-relaxed space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Общие положения</h2>
              <p>
                Настоящая политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006. №152-ФЗ «О персональных данных» и определяет порядок обработки персональных данных и меры по обеспечению их безопасности в сервисе «Аллея Фидбек» (далее — Оператор).
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. Какие данные мы собираем</h2>
              <p>Оператор может обрабатывать следующие персональные данные, которые пользователь добровольно вводит в форму обратной связи:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-indigo-500">
                <li>Имя (для обращения к клиенту);</li>
                <li>Номер телефона или Адрес электронной почты (для предоставления ответа на отзыв);</li>
                <li>Текст отзыва и информация о заказе.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Цели обработки данных</h2>
              <p>
                Цель обработки персональных данных пользователя — качественное обслуживание клиентов компании «Аллея Мебели», сбор обратной связи о работе сервиса и разрешение спорных ситуаций.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Правовые основания</h2>
              <p>
                Оператор обрабатывает персональные данные пользователя только в случае их заполнения и/или отправки пользователем самостоятельно через специальные формы, расположенные на сайте alleyafeedbackservice.vercel.app. Отправляя данные, пользователь выражает свое согласие с данной Политикой.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">5. Порядок сбора и передачи данных</h2>
              <p>Безопасность персональных данных обеспечивается путем реализации правовых, организационных и технических мер:</p>
              <ul className="list-disc pl-6 space-y-4 marker:text-indigo-500">
                <li>Использование защищенного протокола передачи данных HTTPS.</li>
                <li>Данные не передаются третьим лицам, за исключением случаев, связанных с исполнением действующего законодательства.</li>
                <li>Срок обработки персональных данных является неограниченным. Пользователь может в любой момент отозвать свое согласие, направив уведомление Оператору.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">6. Заключительные положения</h2>
              <p>
                Пользователь может получить любые разъяснения по интересующим вопросам, касающимся обработки его персональных данных, обратившись к Оператору через форму на данном сайте или по официальным контактам компании «Аллея Мебели».
              </p>
            </section>
          </div>

          <div className="pt-12 border-t border-indigo-100/30 flex flex-col items-center gap-6">
            <p className="text-slate-400 text-sm font-bold">© 2026 ИП Шевелёв Е.Н.</p>
            <Link 
              href="/login" 
              className="px-8 py-4 premium-gradient text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 hover:scale-105 transition-transform"
            >
              Вернуться на главную
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
