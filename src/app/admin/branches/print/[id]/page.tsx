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
    <div className="min-h-screen bg-slate-50 py-12 md:py-20 flex flex-col items-center">
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
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[20mm] flex flex-col items-center relative overflow-hidden print:shadow-none print:p-0 print:m-0 print:w-full print:min-h-0">
        
        {/* Decorative Top Accent */}
        <div className="w-full h-8 premium-gradient absolute top-0 left-0" />

        {/* Brand Header */}
        <div className="mt-16 mb-20 flex flex-col items-center gap-6">
          <div className="w-40 h-40 bg-white rounded-[3rem] shadow-xl border border-slate-50 p-4 flex items-center justify-center">
             <img src="/logoalleya.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-sm leading-none">Сервис обратной связи</p>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">«Аллея Мебели»</h1>
          </div>
        </div>

        {/* Main Content Box */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center space-y-16">
          <div className="space-y-6">
            <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-normal px-10">
              Ваше мнение <br />
              <span className="text-indigo-600">помогает нам</span> <br />
              стать лучше!
            </h2>
            <p className="text-2xl text-slate-500 font-bold max-w-lg mx-auto leading-relaxed">
              Поделитесь впечатлениями о посещении филиала: <br />
              <span className="text-slate-900 font-black underline decoration-indigo-500/30 underline-offset-8">
                {branch.name}
              </span>
            </p>
          </div>

          <div className="relative group p-10 bg-white rounded-[4rem] border-4 border-slate-100 shadow-inner">
             <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full" />
             <img 
               src={qrImage} 
               alt="Branch QR" 
               className="w-80 h-80 relative z-10"
             />
          </div>

          <div className="space-y-4">
             <p className="inline-flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xl font-black tracking-tight">
               <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm">1</span>
               Наведите камеру телефона
             </p>
             <p className="text-slate-400 font-bold text-lg">
               Или перейдите по ссылке: <br />
               <span className="text-indigo-500">{qrUrl.replace('https://', '')}</span>
             </p>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="mt-20 mb-10 w-full flex flex-col items-center gap-4 opacity-50">
           <div className="h-px bg-slate-200 w-1/3" />
           <p className="font-black text-xl text-slate-400 tracking-tighter">alleya-feedback</p>
        </div>

        {/* Decorative Bottom Accent */}
        <div className="w-full h-8 premium-gradient absolute bottom-0 left-0" />
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .min-h-screen {
            min-height: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
