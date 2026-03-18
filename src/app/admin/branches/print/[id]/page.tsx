"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";

export default function QRPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranch() {
      try {
        const res = await fetch(`/api/branches`);
        const data = await res.json();
        const found = data.find((b: any) => b.id === id);
        setBranch(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBranch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-bold text-slate-500">Филиал не найден</p>
      </div>
    );
  }

  const qrUrl = `https://alleyafeedbackservice.vercel.app/survey/qr?branchId=${branch.id}`;
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrUrl)}`;

  return (
    <div className="min-h-screen bg-slate-50 py-12 md:py-20 flex flex-col items-center print:py-0 print:bg-white">
      {/* Print Button (Hidden on Print) */}
      <div className="mb-12 print:hidden flex gap-4">
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-8 py-4 premium-gradient text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all"
        >
          <Printer className="w-6 h-6" />
          Печать шаблона
        </button>
      </div>

      {/* A4 Template Container */}
      <div className="w-[210mm] h-[296mm] bg-white shadow-2xl p-[12mm] flex flex-col items-center relative overflow-hidden print:shadow-none print:p-[12mm] print:m-0 print:border-none">
        
        {/* Decorative Top Accent */}
        <div className="w-full h-6 premium-gradient absolute top-0 left-0" />

        {/* Brand Header */}
        <div className="mt-6 mb-6 flex flex-col items-center gap-3">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-lg border border-slate-50 p-2 flex items-center justify-center">
             <img src="/logoalleya.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[9px] leading-none">Сервис обратной связи</p>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">«Аллея Мебели»</h1>
          </div>
        </div>

        {/* Main Content Box */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center space-y-6">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight px-6">
              Ваше мнение <br />
              <span className="text-indigo-600">помогает нам</span> <br />
              стать лучше!
            </h2>
            <p className="text-xl text-slate-500 font-bold max-w-lg mx-auto leading-tight">
              Поделитесь впечатлениями о филиале: <br />
              <span className="text-slate-900 font-black underline decoration-indigo-500/30 underline-offset-8">
                {branch.name}
              </span>
            </p>
          </div>

          <div className="relative group p-6 bg-white rounded-[3rem] border-4 border-slate-100 shadow-inner">
             <div className="absolute inset-0 bg-indigo-500/5 blur-[60px] rounded-full" />
             <img 
               src={qrImage} 
               alt="Branch QR" 
               className="w-64 h-64 relative z-10"
             />
          </div>

          <div className="space-y-4">
             <p className="inline-flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-lg font-black tracking-tight">
               <span className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-xs">1</span>
               Наведите камеру телефона
             </p>
             <p className="text-slate-400 font-bold text-base">
                Или перейдите по ссылке: <br />
                <span className="text-indigo-500">{qrUrl.replace('https://', '')}</span>
             </p>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="mt-auto mb-4 w-full flex flex-col items-center gap-2 opacity-50">
           <div className="h-px bg-slate-200 w-1/5" />
           <p className="font-black text-xs text-slate-400 tracking-tighter uppercase">alleya-feedback</p>
        </div>

        {/* Decorative Bottom Accent */}
        <div className="w-full h-6 premium-gradient absolute bottom-0 left-0" />
      </div>

      <style jsx global>{`
        @media print {
          body, html {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          .min-h-screen {
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          /* Fix for container shadow and exact sizing */
          div[class*="w-[210mm]"] {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            page-break-after: avoid;
            page-break-before: avoid;
          }
        }
      `}</style>
    </div>
  );
}
