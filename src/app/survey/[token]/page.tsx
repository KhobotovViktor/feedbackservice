"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/confetti";
import { QuestionInput } from "@/components/survey/question-input";
import { CheckCircle, MessageSquare, ArrowRight, MapPin, Loader2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type?: string;
  options?: string[];
  showIf?: string | null;
}

// True only for finite numeric answers (RATING/NPS); other types are strings.
const isNumVal = (v: unknown): v is number => typeof v === "number" && !isNaN(v);

const DEFAULT_QUESTIONS: Question[] = [
  { id: "1", text: "Как вы оцениваете качество обслуживания?" },
  { id: "2", text: "Оцените, пожалуйста, работу сотрудника службы поддержки." },
];

// Survey-page branding — overridable from Settings → «Интеграция».
// Falls back to these defaults for fresh installs; the QR / login / nav
// pages share the same /logoalleya.png file as a built-in placeholder.
const DEFAULT_BRAND = {
  name: "Сервис обратной связи",
  logoUrl: "/logoalleya.png",
  siteUrl: "",
  accent: "",
};

// Slide texts — overridable per question template (null → these defaults).
const DEFAULT_TEXTS = {
  startTitle: "Ваше мнение имеет значение",
  startSubtitle: "",
  lowTitle: "Расскажите, пожалуйста, что вам не понравилось.",
  lowSubtitle: "Оставьте отзыв и получите 500 бонусов! Для начисления бонусов обратитесь к менеджеру.",
  commentPlaceholder: "Расскажите подробнее о вашем опыте...",
  successTitle: "Огромное спасибо!",
  successPositive: "Мы счастливы, что вам понравилось! Ваша оценка вдохновляет нашу команду.",
  successNegative: "Мы получили ваш отзыв и уже работаем над тем, чтобы исправить ситуацию.",
  reviewPrompt: "Будем очень признательны за отзыв на картах:",
};

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  // `error` is for FATAL load-time failures (bad/expired token) — it replaces
  // the whole page. `submitError` is for recoverable SEND failures — shown
  // inline so the form (and the user's typed comment/phone) survives and they
  // can retry.
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"city" | "rating" | "feedback" | "success">("rating");
  const [isPositive, setIsPositive] = useState(false);
  const [isPositiveThreshold, setIsPositiveThreshold] = useState(4);
  const [reviewLinks, setReviewLinks] = useState<{ yandex?: string; dgis?: string; google?: string }>({});
  // Balancing: which platform to highlight first ("yandex"|"dgis"|"google"|null).
  const [recommended, setRecommended] = useState<"yandex" | "dgis" | "google" | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  // CRM "pick your city" step: list of cities and the one the customer chose.
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [chosenCityId, setChosenCityId] = useState<string | null>(null);
  // Global settings cached at init so a later city pick can reuse the fallback
  // review links without re-fetching.
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  // Survey-page branding pulled from Settings (falls back to defaults).
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  // Slide texts from the active template (falls back to defaults).
  const [texts, setTexts] = useState(DEFAULT_TEXTS);

  // Draft persistence: restore a comment/phone saved before a reload or a
  // failed send, and keep saving them as the user types. Survives connection
  // blips so a long negative comment is never lost. Cleared on success.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`survey_draft:${token}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d?.comment === "string") setComment(d.comment);
        if (typeof d?.phone === "string") setPhone(d.phone);
      }
    } catch {
      // ignore — sessionStorage may be unavailable (privacy mode)
    }
  }, [token]);
  useEffect(() => {
    try {
      if (comment || phone) {
        sessionStorage.setItem(`survey_draft:${token}`, JSON.stringify({ comment, phone }));
      }
    } catch {
      // ignore
    }
  }, [comment, phone, token]);

  // Apply a /check response to the survey UI: questions, review links, the
  // positive-rating threshold, the balancing recommendation and the VIEW
  // event. Setters are stable, so this is safe with an empty dep list.
  const applyConfig = useCallback(
    (data: any, sData: Record<string, string>) => {
      setIsTest(data.isTest || false);
      const bId = data.branchId;
      setBranchId(bId);
      const branchInfo = data.branch;

      // Use template-specific min score or fallback to 4.0
      const minScoreThreshold = branchInfo?.template?.minScore || 4.0;

      // If branch has a template, use template questions
      if (branchInfo?.template?.questions) {
        setQuestions(branchInfo.template.questions);
      }

      // Slide texts from the template (each field falls back to its default).
      const tpl = branchInfo?.template;
      setTexts({
        startTitle: tpl?.startTitle || DEFAULT_TEXTS.startTitle,
        startSubtitle: tpl?.startSubtitle || DEFAULT_TEXTS.startSubtitle,
        lowTitle: tpl?.lowTitle || DEFAULT_TEXTS.lowTitle,
        lowSubtitle: tpl?.lowSubtitle || DEFAULT_TEXTS.lowSubtitle,
        commentPlaceholder: tpl?.commentPlaceholder || DEFAULT_TEXTS.commentPlaceholder,
        successTitle: tpl?.successTitle || DEFAULT_TEXTS.successTitle,
        successPositive: tpl?.successPositive || DEFAULT_TEXTS.successPositive,
        successNegative: tpl?.successNegative || DEFAULT_TEXTS.successNegative,
        reviewPrompt: tpl?.reviewPrompt || DEFAULT_TEXTS.reviewPrompt,
      });

      // Set review links with fallback to global settings
      setReviewLinks({
        yandex: branchInfo?.yandexUrl || sData.review_yandex || "",
        dgis: branchInfo?.dgisUrl || sData.review_2gis || "",
        google: branchInfo?.googleUrl || sData.review_google_maps || "",
      });

      // Balancing: server tells us which platform to highlight (or null).
      if (
        data.recommendedService === "yandex" ||
        data.recommendedService === "dgis" ||
        data.recommendedService === "google"
      ) {
        setRecommended(data.recommendedService);
      }

      setIsPositiveThreshold(minScoreThreshold);

      // Log view event (fire and forget — analytics is not critical).
      // token lets the server dedupe reloads into a single unique view.
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "VIEW", branchId: bId, token }),
      }).catch(() => {});
    },
    [token]
  );

  // CRM "pick your city" step: the customer chose a city, so re-check with
  // that cityId to load the attached branch's survey, then start rating.
  const chooseCity = useCallback(
    async (cityId: string) => {
      setChosenCityId(cityId);
      setLoading(true);
      try {
        const res = await fetch(`/api/surveys/check?token=${token}&cityId=${cityId}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) setAlreadyCompleted(true);
          else setError(data.error || "Ошибка загрузки");
          return;
        }
        applyConfig(data, globalSettings);
        setStep("rating");
      } catch (err) {
        console.error("City selection failed:", err);
        setError("Не удалось загрузить опрос. Проверьте соединение и обновите страницу.");
      } finally {
        setTimeout(() => setLoading(false), 400);
      }
    },
    [token, globalSettings, applyConfig]
  );

  useEffect(() => {
    async function init() {
      try {
        // Fetch global settings for fallback review links once — don't let a
        // settings fetch failure abort the whole init.
        let sData: Record<string, string> = {};
        try {
          const sRes = await fetch("/api/public-settings");
          if (sRes.ok) sData = await sRes.json();
        } catch {
          // best-effort: review links will just fall back to branch values
        }
        setGlobalSettings(sData);
        setBrand({
          name: sData.brand_name || DEFAULT_BRAND.name,
          logoUrl: sData.brand_logo_url || DEFAULT_BRAND.logoUrl,
          siteUrl: sData.brand_site_url || DEFAULT_BRAND.siteUrl,
          accent: sData.brand_accent || "",
        });

        const res = await fetch(`/api/surveys/check?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          // 429 means survey already completed — show "already done" screen.
          if (res.status === 429) setAlreadyCompleted(true);
          else setError(data.error || "Ошибка загрузки");
          return;
        }

        // Per-survey device lock (SKIP IF TEST). Keyed by token so multiple
        // clients on a shared/kiosk device can each take their own survey;
        // the DB-side duplicate check is the real source of truth.
        if (!data.isTest && localStorage.getItem(`survey_completed:${token}`)) {
          setAlreadyCompleted(true);
          return;
        }

        setIsTest(data.isTest || false);

        // CRM "pick your city" step: show city buttons first; the branch is
        // resolved when the customer chooses (chooseCity → applyConfig).
        if (data.needCity) {
          setCities(data.cities || []);
          setStep("city");
          return;
        }

        applyConfig(data, sData);
      } catch (err) {
        // Network failure or unparseable JSON. Show an actual error instead
        // of silently posting bogus submissions with fallback questions.
        console.error("Survey init failed:", err);
        setError("Не удалось загрузить опрос. Проверьте соединение и обновите страницу.");
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    }
    init();
  }, [token, applyConfig]);

  // Average only the RATING answers — NPS / choice / yes-no / text never feed
  // the score. Falls back to any numeric answer when the template has no stars.
  const computeAvg = () => {
    const ratingScores = questions
      .filter((q) => (q.type ?? "RATING") === "RATING")
      .map((q) => answers[q.id])
      .filter(isNumVal);
    const pool = ratingScores.length
      ? ratingScores
      : (Object.values(answers).filter(isNumVal) as number[]);
    return pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
  };

  const handleSubmitRating = async () => {
    const avg = computeAvg();
    // Positive if average is >= threshold
    const positive = avg >= isPositiveThreshold;
    setIsPositive(positive);

    if (positive) {
      // For positive reviews, we submit and go straight to success
      await submitFeedback(avg, true);
    } else {
      // For negative reviews, we ask for a comment first
      setStep("feedback");
    }
  };

  const submitFeedback = async (avg: number, positive: boolean) => {
    if (submitting) return; // guard against double-tap
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Update state immediately to avoid race conditions in UI
      setIsPositive(positive);

      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          answers,
          comment: positive ? "" : comment,
          averageScore: avg,
          cityId: chosenCityId,
          phone: positive ? "" : phone,
        }),
      });

      if (!res.ok) {
        // Try to read a JSON error body, but tolerate non-JSON (e.g. 502 HTML
        // from nginx) — we still want to show *something* to the user.
        let errMsg = "Не удалось отправить ответ. Попробуйте позже.";
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch {
          // body wasn't JSON
        }
        // Inline error — keeps the form mounted so the typed comment/phone
        // aren't lost and the user can simply press the button again.
        setSubmitError(errMsg);
        return;
      }

      if (!isTest) {
        // Per-token device lock — see init() for rationale.
        localStorage.setItem(`survey_completed:${token}`, "true");
        // Clear the saved draft once successfully submitted.
        try { sessionStorage.removeItem(`survey_draft:${token}`); } catch {}
      }

      // Ensure state is updated before showing success
      setStep("success");
    } catch {
      setSubmitError("Не удалось отправить — проверьте соединение и попробуйте ещё раз. Ваш отзыв сохранён.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    await submitFeedback(computeAvg(), false);
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
             <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Сервис обратной связи «{brand.name}»</p>
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
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-xl glass p-8 md:p-12 rounded-[3.5rem] shadow-2xl border-white/50 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton w-16 h-16 rounded-2xl" />
            <div className="skeleton h-7 w-3/4 rounded-2xl" />
            <div className="skeleton h-4 w-1/2 rounded-xl" />
          </div>
          <div className="space-y-6 pt-4">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <div className="skeleton h-5 w-2/3 rounded-xl" />
                <div className="skeleton h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
          <div className="skeleton h-14 w-full rounded-[1.5rem]" />
        </div>
      </div>
    );
  }

  const hasReviewLinks = reviewLinks.yandex || reviewLinks.dgis || reviewLinks.google;

  // Ordered list of configured review platforms. When the branch uses a
  // balancing strategy, the server-recommended platform is moved to the front
  // and rendered as the primary call-to-action.
  const reviewPlatforms = (
    [
      { key: "yandex" as const, label: "Яндекс.Карты", url: reviewLinks.yandex, target: "YANDEX" },
      { key: "dgis" as const, label: "2ГИС", url: reviewLinks.dgis, target: "2GIS" },
      { key: "google" as const, label: "Google Maps", url: reviewLinks.google, target: "GOOGLE" },
    ] as const
  ).filter((p) => p.url);
  const orderedPlatforms = recommended
    ? [
        ...reviewPlatforms.filter((p) => p.key === recommended),
        ...reviewPlatforms.filter((p) => p.key !== recommended),
      ]
    : reviewPlatforms;

  const trackClick = (target: string) =>
    !isTest &&
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CLICK", target, branchId, token }),
    }).catch(() => {});

  // Domain shown as the link label (without protocol / trailing slash).
  const brandDomain = brand.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // When an accent colour is set, override the brand-gradient vars so the
  // premium-gradient CTAs adopt it.
  const accentStyle: CSSProperties | undefined = brand.accent
    ? ({
        "--color-brand-start": brand.accent,
        "--color-brand-mid": brand.accent,
        "--color-brand-end": brand.accent,
      } as CSSProperties)
    : undefined;

  // Conditional display: a showIf question appears only once the base rating
  // questions are answered and the running average matches the condition.
  const threshold = isPositiveThreshold;
  const ratingBase = questions.filter((q) => (q.type ?? "RATING") === "RATING" && !q.showIf);
  const allBaseRatingAnswered =
    ratingBase.length > 0 &&
    ratingBase.every((q) => isNumVal(answers[q.id]) && (answers[q.id] as number) > 0);
  const baseScores = ratingBase.map((q) => answers[q.id]).filter(isNumVal) as number[];
  const runningAvg = baseScores.length ? baseScores.reduce((a, b) => a + b, 0) / baseScores.length : null;
  const condVisible = (q: Question) => {
    if (!q.showIf) return true;
    if (runningAvg === null || !allBaseRatingAnswered) return false;
    if (q.showIf === "negative") return runningAvg < threshold;
    if (q.showIf === "positive") return runningAvg >= threshold;
    return true;
  };
  const visibleQuestions = questions.filter(condVisible);
  const setAnswer = (id: string, val: number | string) =>
    setAnswers((prev) => ({ ...prev, [id]: val }));
  const isAnswered = (q: Question) => {
    const v = answers[q.id];
    const t = q.type ?? "RATING";
    if (t === "TEXT") return true; // optional
    if (t === "RATING") return isNumVal(v) && v > 0;
    if (t === "NPS") return isNumVal(v);
    return typeof v === "string" && v !== ""; // CHOICE / YESNO
  };
  const allAnswered = visibleQuestions.length > 0 && visibleQuestions.every(isAnswered);
  const answeredCount = visibleQuestions.filter(isAnswered).length;

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center" style={accentStyle}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl glass p-8 md:p-12 rounded-[3.5rem] shadow-2xl border-white/50 relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === "city" && (
            <motion.div
              key="city"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-10"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 border border-slate-50 overflow-hidden p-2 transform rotate-3">
                  <img src={brand.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-none tracking-tighter">
                  Выберите ваш город
                </h1>
                <p className="text-slate-500 font-medium">
                  Укажите салон «{brand.name}», работу которого вы хотите оценить
                </p>
                <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px] pt-1">
                  Сервис обратной связи «{brand.name}»
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {cities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => chooseCity(c.id)}
                    className="w-full py-5 px-6 bg-white/50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:scale-[1.02] active:scale-[0.98] transition-all font-black text-slate-700 shadow-sm flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-indigo-400" />
                      {c.name}
                    </span>
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  </button>
                ))}
              </div>

              <div className="pt-4 text-center border-t border-slate-100">
                <a href="/privacy" target="_blank" className="text-[9px] text-slate-400 hover:text-indigo-500 font-bold uppercase tracking-[0.2em] transition-colors">Политика конфиденциальности</a>
              </div>
            </motion.div>
          )}

          {step === "rating" && (
            <motion.div 
              key="rating"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 border border-slate-50 overflow-hidden p-2 transform rotate-3">
                   <img src={brand.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tighter">{texts.startTitle}</h1>
                {texts.startSubtitle && <p className="text-slate-500 font-medium">{texts.startSubtitle}</p>}
                <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px]">Сервис обратной связи «{brand.name}»</p>
                <div className="pt-2">
                  <a href={brand.siteUrl} target="_blank" className="text-[10px] text-slate-400 hover:text-indigo-500 font-bold uppercase tracking-[0.1em] transition-colors border-b border-slate-200 hover:border-indigo-200 pb-0.5">{brandDomain}</a>
                </div>
              </div>

              {/* Per-question progress — only meaningful with 2+ questions. */}
              {visibleQuestions.length > 1 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>Прогресс</span>
                    <span className="tabular-nums">{answeredCount} / {visibleQuestions.length}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full premium-gradient rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((answeredCount / visibleQuestions.length) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-10">
                {visibleQuestions.map((q) => (
                  <div key={q.id} className="space-y-4">
                    <p
                      id={`question-${q.id}`}
                      className="font-bold text-slate-800 text-lg md:text-xl tracking-tight leading-snug"
                    >
                      {q.text}
                    </p>
                    <QuestionInput
                      question={q}
                      value={answers[q.id]}
                      onChange={(val) => setAnswer(q.id, val)}
                      commentPlaceholder={texts.commentPlaceholder}
                    />
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold border border-rose-100">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
              <button
                disabled={!allAnswered || submitting}
                onClick={handleSubmitRating}
                className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all shadow-2xl shadow-indigo-500/20"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Продолжить <ArrowRight className="w-6 h-6" /></>}
              </button>

              <div className="pt-8 text-center border-t border-slate-100">
                <a href="/privacy" target="_blank" className="text-[9px] text-slate-400 hover:text-indigo-500 font-bold uppercase tracking-[0.2em] transition-colors">Политика конфиденциальности</a>
              </div>
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
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">{texts.lowTitle}</h2>
                <p className="text-slate-500 font-medium">{texts.lowSubtitle}</p>
              </div>

              <label htmlFor="survey-comment" className="sr-only">
                Ваш комментарий
              </label>
              <textarea
                id="survey-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={texts.commentPlaceholder}
                aria-label="Ваш комментарий"
                className="w-full h-40 p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none font-medium placeholder:text-slate-400"
              />

              <label htmlFor="survey-phone" className="sr-only">Номер телефона</label>
              <input
                id="survey-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Оставьте номер телефона для связи (необязательно)"
                aria-label="Номер телефона"
                className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-50/50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all font-medium placeholder:text-slate-400"
              />

              {submitError && (
                <div className="flex items-start gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold border border-rose-100">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting}
                className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (submitError ? "Повторить отправку" : "Отправить отзыв")}
              </button>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 relative"
            >
              {isPositive && <Confetti />}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: -3 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-xl shadow-emerald-500/10 relative z-10"
              >
                <CheckCircle className="w-12 h-12" />
              </motion.div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{texts.successTitle}</h2>
                <div className="pb-2">
                  <a href={brand.siteUrl} target="_blank" className="text-xs text-indigo-500 font-bold hover:text-indigo-600 transition-colors">Вернуться на {brandDomain}</a>
                </div>
                <p className="text-slate-600 text-lg font-medium leading-relaxed">
                  {isPositive ? texts.successPositive : texts.successNegative}
                </p>
              </div>

              {isPositive && hasReviewLinks && (
                <div className="space-y-6 pt-8 border-t border-slate-200/50">
                  <p className="font-bold text-slate-800">{texts.reviewPrompt}</p>
                  <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto">
                    {orderedPlatforms.map((p, idx) => {
                      const isPrimary = recommended != null && idx === 0;
                      return (
                        <a
                          key={p.key}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackClick(p.target)}
                          className={
                            isPrimary
                              ? "relative flex items-center justify-center p-5 premium-gradient text-white rounded-2xl hover:scale-[1.03] transition-all font-black shadow-xl shadow-indigo-500/20"
                              : "flex items-center justify-center p-5 bg-white/50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:scale-[1.02] transition-all font-black text-slate-700 shadow-sm"
                          }
                        >
                          {p.label}
                          {isPrimary && (
                            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-400 text-slate-900 text-[8px] font-black uppercase tracking-widest rounded-full shadow">
                              Рекомендуем
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-slate-200/50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">Сервис обратной связи «{brand.name}»</p>
                <a href="/privacy" target="_blank" className="text-[10px] text-indigo-400 hover:text-indigo-600 font-bold uppercase tracking-[0.2em] transition-colors">Политика конфиденциальности</a>
              </div>
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
