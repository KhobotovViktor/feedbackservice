"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { StarRating } from "@/components/star-rating";
import { CheckCircle, MessageSquare, ArrowRight, Loader2 } from "lucide-react";

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

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/surveys/check?token=${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Ошибка загрузки");
        }
      } catch (err) {
        // Fallback for demo if API not fully ready
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
    
    const positive = avg >= 4.5 && allHigh;
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center space-y-4">
          <div className="text-red-500 text-5xl font-bold">!</div>
          <h2 className="text-2xl font-bold text-slate-800">Ошибка</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl glass p-8 rounded-3xl"
      >
        <AnimatePresence mode="wait">
          {step === "rating" && (
            <motion.div 
              key="rating"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-slate-900 leading-tight">Ваше мнение важно для нас</h1>
                <p className="text-slate-500">Пожалуйста, ответьте на несколько вопросов</p>
              </div>

              <div className="space-y-8">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-3">
                    <p className="font-medium text-slate-800 text-lg">{q.text}</p>
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
                className="w-full py-4 premium-gradient text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
              >
                Далее <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === "feedback" && (
            <motion.div 
              key="feedback"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <MessageSquare className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Что мы могли бы улучшить?</h2>
                <p className="text-slate-500">Мы ценим честную обратную связь</p>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ваш отзыв..."
                className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              />

              <button
                onClick={handleSubmitFeedback}
                className="w-full py-4 premium-gradient text-white rounded-2xl font-semibold text-lg shadow-lg shadow-indigo-200"
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
              className="text-center space-y-6"
            >
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Спасибо!</h2>
                <p className="text-slate-600 text-lg">
                  {isPositive 
                    ? "Мы рады, что вам понравилось!" 
                    : "Мы получили ваш отзыв и обязательно над ним поработаем."}
                </p>
              </div>

              {isPositive && (
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <p className="font-semibold text-slate-800">Оставьте отзыв на картах и получите 500 бонусов!</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a href="#" className="flex items-center justify-center gap-2 p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                      Яндекс.Карты
                    </a>
                    <a href="#" className="flex items-center justify-center gap-2 p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                      2GIS
                    </a>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">
                    Для начисления бонусов обратитесь к менеджеру.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
