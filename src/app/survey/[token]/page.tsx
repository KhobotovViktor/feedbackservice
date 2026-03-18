"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { StarRating } from "@/components/star-rating";
import { CheckCircle, MessageSquare, ArrowRight, Loader2, Star } from "lucide-react";

interface Question {
  id: string;
  text: string;
}

const DEFAULT_QUESTIONS: Question[] = [
  { id: "1", text: "Как вы оцениваете качество обслуживания в “Аллея Мебели”?" },
  { id: "2", text: "Оцените, пожалуйста, работу сотрудника службы поддержки." },
];

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"rating" | "feedback" | "success">("rating");
  const [isPositive, setIsPositive] = useState(false);
  const [reviewLinks, setReviewLinks] = useState<{ yandex?: string; dgis?: string; google?: string }>({});
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    // Check for device lock
    if (localStorage.getItem("survey_completed")) {
      setAlreadyCompleted(true);
      setLoading(false);
      return;
    }

    async function init() {
      try {
        const res = await fetch(`/api/surveys/check?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Ошибка загрузки");
          return;
        }

        const bId = data.branchId;
        setBranchId(bId);
        const branchInfo = data.branch;
        
        // If branch has a template, use template questions
        if (branchInfo?.template?.questions) {
          setQuestions(branchInfo.template.questions);
        } else {
          // Fallback to branch-specific or global questions
          const qRes = await fetch(bId ? `/api/questions?branchId=${bId}` : "/api/questions");
          const qData = await qRes.json();
          setQuestions(qData);
        }

        // Set branch-specific links if they exist, otherwise use global settings
        if (data.branch) {
          setReviewLinks({
            yandex: data.branch.yandexUrl || "",
            dgis: data.branch.dgisUrl || "",
            google: data.branch.googleUrl || ""
          });
        } else {
          const sRes = await fetch("/api/settings");
          const sData = await sRes.json();
          setReviewLinks({
            yandex: sData.review_yandex || "",
            dgis: sData.review_2gis || "",
            google: sData.review_google_maps || ""
          });
        }

        // Log view event
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "VIEW", branchId: bId }),
        });
      } catch (err) {
        console.warn("API check failed, continuing for demo");
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    }
    init();
  }, [token]);

  const handleSubmitRating = async () => {
    const scores = Object.values(answers);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const allHigh = scores.every((s) => s >= 4);
    
    // Positive if average is high OR all scores are high
    const positive = avg >= 4 || allHigh;
    setIsPositive(positive);
    
    if (positive) {
      await submitFeedback(avg, positive);
    } else {
      setStep("feedback");
    }
  };

  const submitFeedback = async (avg: number, positive: boolean) => {
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          answers,
          comment: positive ? "" : comment,
          averageScore: avg
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }
      localStorage.setItem("survey_completed", "true");
      setStep("success");
    } catch (err) {
      setError("Ошибка при отправке. Попробуйте позже.");
    }
  };

  const handleSubmitFeedback = async () => {
    const scores = Object.values(answers);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    await submitFeedback(avg, false);
  };

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-10 rounded-[3rem] text-center space-y-8 shadow-2xl shadow-indigo-500/10">
          <div className="w-24 h-24 premium-gradient rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20 transform -rotate-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Спасибо!</h2>
            <p className="text-slate-500 font-medium leading-relaxed">Вы уже проходили опрос. Ваше мнение очень важно для нас!</p>
          </div>
          <div className="pt-4">
             <div className="h-px bg-slate-200/50 w-full mb-6"></div>
             <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Alleya Feedback</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-8 rounded-[2.5rem] text-center space-y-4 shadow-2xl border-rose-100">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
             <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ошибка</h2>
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
           <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
           <div className="absolute inset-0 flex items-center justify-center">
              <Star className="w-4 h-4 text-indigo-600 animate-pulse" />
           </div>
        </div>
      </div>
    );
  }

  const hasReviewLinks = reviewLinks.yandex || reviewLinks.dgis || reviewLinks.google;

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl glass p-8 md:p-12 rounded-[3.5rem] shadow-2xl border-white/50 relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === "rating" && (
            <motion.div 
              key="rating"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-3">
                <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 transform rotate-3">
                   <Star className="w-8 h-8 text-white fill-white/20" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-none tracking-tighter">Ваше мнение <br/> имеет значение</h1>
                <p className="text-slate-500 font-medium">Это займет не более минуты</p>
              </div>

              <div className="space-y-10">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-4">
                    <p className="font-bold text-slate-800 text-lg md:text-xl tracking-tight leading-snug">{q.text}</p>
                    <StarRating 
                      value={answers[q.id] || 0} 
                      onChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))} 
                    />
                  </div>
                ))}
              </div>

              <button
                disabled={Object.keys(answers).length < questions.length}
                onClick={handleSubmitRating}
                className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all shadow-2xl shadow-indigo-500/20"
              >
                Продолжить <ArrowRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {step === "feedback" && (
            <motion.div 
              key="feedback"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Что мы можем улучшить?</h2>
                <p className="text-slate-500 font-medium">Ваш отзыв поможет нам стать лучше</p>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Расскажите подробнее о вашем опыте..."
                className="w-full h-40 p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none font-medium placeholder:text-slate-400"
              />

              <button
                onClick={handleSubmitFeedback}
                className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] transition-all"
              >
                Отправить отзыв
              </button>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-xl shadow-emerald-500/10 transform -rotate-3">
                <CheckCircle className="w-12 h-12" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter tracking-tight">Огромное спасибо!</h2>
                <p className="text-slate-600 text-lg font-medium leading-relaxed">
                  {isPositive 
                    ? "Мы счастливы, что вам понравилось! Ваша оценка вдохновляет нашу команду." 
                    : "Мы получили ваш отзыв и уже работаем над тем, чтобы исправить ситуацию."}
                </p>
              </div>

              {isPositive && hasReviewLinks && (
                <div className="space-y-6 pt-8 border-t border-slate-200/50">
                  <p className="font-bold text-slate-800">Будем очень признательны за отзыв на картах:</p>
                  <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto">
                    {reviewLinks.yandex && (
                      <a 
                        href={reviewLinks.yandex} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={() => fetch("/api/analytics", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "CLICK", target: "YANDEX", branchId }),
                        })}
                        className="flex items-center justify-center gap-3 p-4 bg-white/50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:scale-[1.02] transition-all font-bold text-slate-700 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20"></span> Яндекс.Карты
                      </a>
                    )}
                    {reviewLinks.dgis && (
                      <a 
                        href={reviewLinks.dgis} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={() => fetch("/api/analytics", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "CLICK", target: "2GIS", branchId }),
                        })}
                        className="flex items-center justify-center gap-3 p-4 bg-white/50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:scale-[1.02] transition-all font-bold text-slate-700 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></span> 2GIS
                      </a>
                    )}
                    {reviewLinks.google && (
                      <a 
                        href={reviewLinks.google} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={() => fetch("/api/analytics", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "CLICK", target: "GOOGLE", branchId }),
                        })}
                        className="flex items-center justify-center gap-3 p-4 bg-white/50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:scale-[1.02] transition-all font-bold text-slate-700 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20"></span> Google Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {!isPositive && (
                <div className="pt-6">
                   <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <p className="text-sm text-indigo-600 font-bold italic">Ваш отзыв передан руководству компании.</p>
                   </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Background blobs for Survey container */}
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/5 blur-[60px] rounded-full" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/5 blur-[60px] rounded-full" />
      </motion.div>
    </div>
  );
}

function AlertCircle(props: any) {
   return (
      <svg
         {...props}
         xmlns="http://www.w3.org/2000/svg"
         width="24"
         height="24"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
      >
         <circle cx="12" cy="12" r="10" />
         <line x1="12" y1="8" x2="12" y2="12" />
         <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
   );
}
