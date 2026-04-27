import { useState, useEffect, useRef } from "react";
import { useMealPlan, useProfile, useFoodPreferences, useSwapIngredient, useGenerateMealPlan, getSwapOptions } from "@/lib/supabase-queries";
import type { MealRow, Ingredient, SwapOption } from "@/lib/supabase-queries";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X, Pencil, ChevronDown, Utensils } from "lucide-react";
import { TrialGate } from "@/components/TrialGate";
import { useAuth } from "@/hooks/useAuth";
import { useT, useLanguage, translateDay } from "@/lib/language";
import { Link } from "wouter";

const DAYS = [
  { id: "monday" },
  { id: "tuesday" },
  { id: "wednesday" },
  { id: "thursday" },
  { id: "friday" },
  { id: "saturday" },
  { id: "sunday" },
];

const PLATE_COLORS: Record<string, string> = {
  protein: "#AAFF45",
  carbs: "#fb923c",
  vegetables: "#60a5fa",
  fats: "#a78bfa",
  fat: "#a78bfa",
  fruit: "#f472b6",
  dairy: "#facc15",
  other: "#555555",
};

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  snack_morning: "🌤️",
  lunch: "☀️",
  snack_afternoon: "🌆",
  dinner: "🌙",
};

const MEAL_COLOR: Record<string, string> = {
  breakfast: "#88ee22",
  snack_morning: "#7B8CDE",
  lunch: "#FFB347",
  snack_afternoon: "#7B8CDE",
  dinner: "#7B8CDE",
};

const PREP_TIME: Record<string, number> = {
  breakfast: 10,
  snack_morning: 5,
  lunch: 15,
  snack_afternoon: 5,
  dinner: 25,
};

const CALORIES_APPROX: Record<string, number> = {
  breakfast: 400,
  snack_morning: 175,
  lunch: 650,
  snack_afternoon: 150,
  dinner: 550,
};

const MEAL_ORDER = ["breakfast", "snack_morning", "lunch", "snack_afternoon", "dinner"];


const GOAL_LABELS: Record<string, string> = {
  lose_fat: "Perder grasa",
  maintain: "Mantenerme",
  gain_muscle: "Ganar músculo",
};

const DIET_LABELS: Record<string, string> = {
  balanced: "Equilibrada",
  high_protein: "Alta en proteínas",
  keto: "Keto",
  vegetarian: "Vegetariana",
  vegan: "Vegana",
};

function getProtein(meals: MealRow[]): number {
  const total = meals.reduce((sum, m) => {
    const p = m.plate_distribution?.protein ?? 0;
    const kcal = CALORIES_APPROX[m.meal_type] ?? 400;
    return sum + Math.round((p / 100) * kcal * 0.25);
  }, 0);
  return total;
}

function getCarbs(meals: MealRow[]): number {
  const total = meals.reduce((sum, m) => {
    const c = (m.plate_distribution?.carbs ?? 0);
    const kcal = CALORIES_APPROX[m.meal_type] ?? 400;
    return sum + Math.round((c / 100) * kcal * 0.25);
  }, 0);
  return total;
}

function getFat(meals: MealRow[]): number {
  const total = meals.reduce((sum, m) => {
    const f = m.plate_distribution?.fats ?? 0;
    const kcal = CALORIES_APPROX[m.meal_type] ?? 400;
    return sum + Math.round((f / 100) * kcal * 0.11);
  }, 0);
  return total;
}

export default function Meals() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_meal_plan")} pageEmoji="🥗">
      <MealsContent />
    </TrialGate>
  );
}

function MealsContent() {
  const { data: mealPlan, isLoading: mealLoading } = useMealPlan();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: foodPrefs } = useFoodPreferences();
  const { session } = useAuth();
  const generateMutation = useGenerateMealPlan();
  const autoGenTriggered = useRef(false);
  const t = useT();
  const { lang } = useLanguage();

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const defaultDay = DAYS.find(d => d.id === todayName)?.id ?? "monday";
  const [activeDay, setActiveDay] = useState(defaultDay);
  const [showConfirm, setShowConfirm] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);
  const [regenFromUrl, setRegenFromUrl] = useState(false);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // update every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const isLoading = mealLoading || profileLoading;

  useEffect(() => {
    if (autoGenTriggered.current) return;
    if (!session?.access_token) return;
    // Wait until language is resolved (avoids generating with stale lang)
    if (!lang) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("regenerate") !== "true") return;
    console.log("[Meals] ?regenerate param found, lang:", lang);
    autoGenTriggered.current = true;
    setRegenFromUrl(true);
    window.history.replaceState({}, "", window.location.pathname);
    generateMutation.mutate(
      { token: session.access_token, lang },
      {
        onSuccess: () => {
          console.log("[Meals] Generation complete");
          setRegenFromUrl(false);
          setGenSuccess(true);
          setTimeout(() => setGenSuccess(false), 3500);
        },
        onError: (err) => {
          console.log("[Meals] Generation failed:", err);
          setRegenFromUrl(false);
        },
      },
    );
  }, [session?.access_token, lang]);

  function handleGenerate() {
    if (!session?.access_token) return;
    setShowConfirm(false);
    generateMutation.mutate(
      { token: session.access_token, lang },
      {
        onSuccess: () => {
          setGenSuccess(true);
          setTimeout(() => setGenSuccess(false), 3500);
        },
      },
    );
  }

  function handleRetry() {
    if (!session?.access_token) return;
    generateMutation.reset();
    generateMutation.mutate(
      { token: session.access_token, lang },
      {
        onSuccess: () => {
          setGenSuccess(true);
          setTimeout(() => setGenSuccess(false), 3500);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--giq-accent)" }} />
      </div>
    );
  }

  const isProfileComplete = !!(profile?.full_name && profile?.goal && profile?.diet_type);

  // Generating with no existing plan yet (first-time onboarding flow)
  if (!mealPlan && generateMutation.isPending) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 mb-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--giq-accent) 15%, transparent)" }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--giq-accent)" }} />
        </div>
        <h2 className="text-2xl font-display font-black uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>
          {lang === "en" ? "Creating your plan..." : "Creando tu plan..."}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--giq-text-secondary)" }}>
          {lang === "en" ? "⏱ ~30 seconds" : "⏱ ~30 segundos"}
        </p>
      </div>
    );
  }

  // Generation failed with no existing plan — show clean error + retry
  if (!mealPlan && generateMutation.isError) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 mb-5 rounded-full flex items-center justify-center bg-red-500/10">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-display font-black uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>
          {lang === "en" ? "Generation failed" : "Error al generar"}
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--giq-text-secondary)" }}>
          {lang === "en"
            ? "Could not create your meal plan. Please try again."
            : "No se pudo crear tu plan de comidas. Inténtalo de nuevo."}
        </p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-colors"
          style={{ backgroundColor: "var(--giq-accent)", color: "#0A0A0A" }}
        >
          <RefreshCw className="w-4 h-4" />
          {lang === "en" ? "Try again" : "Intentar de nuevo"}
        </button>
      </div>
    );
  }

  if (!mealPlan && !isProfileComplete) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <Utensils className="w-16 h-16 mb-5" style={{ color: "var(--giq-accent)" }} />
        <h2 className="text-2xl font-display font-black uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>{t("complete_profile_title")}</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--giq-text-secondary)" }}>
          {t("complete_profile_body")}
        </p>
        <Link
          href="/onboarding?edit=true"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#AAFF45] text-[#0A0A0A] font-bold text-sm hover:bg-[#99EE34] transition-colors"
        >
          <Pencil className="w-4 h-4" />
          {t("complete_my_profile")}
        </Link>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <Utensils className="w-16 h-16 mb-5" style={{ color: "var(--giq-accent)" }} />
        <h2 className="text-2xl font-display font-black uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>{t("no_meal_plan_yet")}</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--giq-text-secondary)" }}>
          {t("no_meal_plan_onboarding")}
        </p>
      </div>
    );
  }

  const activeDayData = mealPlan.days.find(d => d.day === activeDay);
  const isGenerating = generateMutation.isPending;
  const isES = lang !== "en";

  const dietLabel = profile?.diet_type ? (DIET_LABELS[profile.diet_type] ?? profile.diet_type) : null;
  const goalLabel = profile?.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : null;

  const dayMeals = activeDayData?.meals ?? [];
  const kcalTarget = dayMeals.reduce((sum, m) => sum + (CALORIES_APPROX[m.meal_type] ?? 400), 0);

  // Time-based automatic tracking — assumes meals are eaten at these cutoff hours
  const MEAL_CUTOFF_HOURS: Record<string, number> = {
    breakfast:        9,
    snack_morning:   11,
    lunch:           14,
    snack_afternoon: 17,
    dinner:          20,
  };

  // Only track today — past and future days show 0
  const isActiveToday = activeDay === todayName;

  const kcalConsumed = isActiveToday
    ? dayMeals
        .filter(m => currentHour >= (MEAL_CUTOFF_HOURS[m.meal_type] ?? 23))
        .reduce((sum, m) => sum + (CALORIES_APPROX[m.meal_type] ?? 0), 0)
    : 0;

  const kcalLeft = Math.max(kcalTarget - kcalConsumed, 0);
  const kcalPct = kcalTarget > 0 ? Math.min(100, Math.round((kcalConsumed / kcalTarget) * 100)) : 0;

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-32 overflow-x-hidden">

      {/* Generation overlay — shown when regenerating an existing plan */}
      {generateMutation.isPending && (regenFromUrl || mealPlan) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl border p-8 flex flex-col items-center gap-4 max-w-xs mx-4 text-center" style={{ background: "#141414", borderColor: "#1f1f1f" }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--giq-accent)" }} />
            <div>
              <p className="font-bold text-white text-base mb-1">{lang === "en" ? "Creating your plan..." : "Creando tu plan..."}</p>
              <p className="text-sm" style={{ color: "var(--giq-text-muted)" }}>{lang === "en" ? "⏱ ~30 seconds" : "⏱ ~30 segundos"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        {/* Top row: avatar + title + regen button */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl"
            style={{ background: "color-mix(in srgb, var(--giq-accent) 15%, transparent)" }}
          >
            🥗
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--giq-text-primary)" }}>
              {isES ? "Tu plan semanal" : "Your weekly plan"}
            </h1>
            {(dietLabel || goalLabel) && (
              <p className="text-xs truncate" style={{ color: "var(--giq-text-muted)" }}>
                {[dietLabel, goalLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Regenerate button */}
          <div className="relative shrink-0">
            {!isProfileComplete ? (
              <Link
                href="/onboarding?edit=true"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold transition-all hover:bg-amber-500/20"
              >
                <Pencil className="w-3.5 h-3.5" />
                {t("update_profile")}
              </Link>
            ) : !showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#AAFF45]/30 hover:text-[#AAFF45] text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("generating_short")}</>
                ) : genSuccess ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-[#AAFF45]" /> {profile?.full_name?.split(" ")[0] ? t("done_name", { name: profile.full_name.split(" ")[0] }) : t("done")}</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> {t("new_plan")}</>
                )}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-0 z-10 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] shadow-2xl p-3 w-56"
                >
                  <p className="text-xs text-[#A0A0A0] font-medium mb-2.5 leading-snug">
                    {t("replace_plan_confirm")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerate}
                      className="flex-1 py-1.5 rounded-lg bg-[#AAFF45] text-[#0A0A0A] text-xs font-bold hover:bg-[#99EE34] transition-colors"
                    >
                      {t("generate")}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-1.5 rounded-lg bg-[#2A2A2A] text-[#A0A0A0] text-xs font-semibold hover:bg-[#3A3A3A] transition-colors"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Kcal strip + progress bar */}
        {kcalTarget > 0 && (
          <div className="rounded-xl border p-3" style={{ backgroundColor: "#141414", borderColor: "#1f1f1f" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-center flex-1">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>
                  {isES ? "Objetivo" : "Target"}
                </p>
                <p className="text-base font-bold" style={{ color: "var(--giq-text-primary)" }}>{kcalTarget}</p>
              </div>
              <div className="w-px h-8 bg-[#2a2a2a]" />
              <div className="text-center flex-1">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>
                  {isES ? "Consumido" : "Consumed"}
                </p>
                <p className="text-base font-bold" style={{ color: "var(--giq-accent)" }}>{kcalConsumed}</p>
              </div>
              <div className="w-px h-8 bg-[#2a2a2a]" />
              <div className="text-center flex-1">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>
                  {isES ? "Restante" : "Remaining"}
                </p>
                <p className="text-base font-bold" style={{ color: "var(--giq-text-secondary)" }}>{kcalLeft}</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#222" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${kcalPct}%`, backgroundColor: "var(--giq-accent)" }}
              />
            </div>
            <p className="text-[10px] text-right mt-1" style={{ color: "var(--giq-text-muted)" }}>{kcalPct}% kcal</p>
          </div>
        )}
      </div>

      {/* Profile incomplete warning */}
      {!isProfileComplete && !isGenerating && (
        <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">{t("profile_incomplete")}</p>
            <p className="text-xs text-amber-400/70 mt-0.5 leading-snug">
              {t("complete_profile_first")}.{" "}
              <Link href="/onboarding?edit=true" className="underline font-semibold hover:text-amber-300">
                {t("update_now")}
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Generating overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              backgroundColor: "color-mix(in srgb, var(--giq-accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--giq-accent) 20%, transparent)",
            }}
          >
            <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "var(--giq-accent)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--giq-accent)" }}>
              {t("generating_meal_plan")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {generateMutation.isError && (() => {
          const errMsg = (generateMutation.error as Error)?.message ?? "Generation failed";
          const isProfileError = /profile|missing|goal|diet|onboarding/i.test(errMsg);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`mb-5 rounded-lg border px-4 py-3 ${isProfileError ? "bg-amber-500/10 border-amber-500/20" : "bg-[#FF4444]/10 border-[#FF4444]/20"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isProfileError ? "text-amber-400" : "text-[#FF4444]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isProfileError ? "text-amber-300 font-semibold" : "text-[#FF4444]"}`}>
                    {isProfileError ? t("profile_incomplete") : t("generation_failed")}
                  </p>
                  {isProfileError ? (
                    <p className="text-xs text-amber-400/70 mt-0.5 leading-snug">
                      {errMsg.includes("missing required")
                        ? errMsg
                        : t("please_complete_profile")}
                    </p>
                  ) : (
                    <p className="text-xs text-[#FF4444]/80 mt-0.5">{errMsg}</p>
                  )}
                </div>
              </div>
              {isProfileError && (
                <Link
                  href="/onboarding?edit=true"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("update_profile_btn")}
                </Link>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Day Tabs — grid layout, matches Workouts.tsx */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-4 sm:mb-6">
        {DAYS.map(day => {
          const isToday = day.id === todayName;
          const isActive = day.id === activeDay;
          return (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className="flex flex-col items-center px-0 py-1.5 sm:px-3 sm:py-2 rounded-lg font-semibold transition-all relative"
              style={
                isActive
                  ? { backgroundColor: "var(--giq-accent)", color: "var(--giq-accent-text)" }
                  : { backgroundColor: "var(--giq-bg-card)", color: "var(--giq-text-muted)", border: "1px solid var(--giq-border)" }
              }
            >
              <span className="w-full text-center text-[10px] sm:text-xs leading-none">
                {translateDay(day.id, t).substring(0, 2)}
              </span>
              {isToday && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--giq-accent-text) 40%, transparent)" : "var(--giq-accent)" }}
                />
              )}
              {!isToday && <span className="w-1.5 h-1.5 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Macro summary row */}
      {dayMeals.length > 0 && (
        <div className="flex gap-2 mb-4">
          {[
            { label: isES ? "Proteína" : "Protein", value: getProtein(dayMeals), unit: "g", color: "#AAFF45" },
            { label: isES ? "Carbos" : "Carbs", value: getCarbs(dayMeals), unit: "g", color: "#FFB347" },
            { label: isES ? "Grasas" : "Fat", value: getFat(dayMeals), unit: "g", color: "#a78bfa" },
          ].map(({ label, value, unit, color }) => (
            <div
              key={label}
              className="flex-1 rounded-lg px-3 py-2 text-center"
              style={{ backgroundColor: "#141414", border: "1px solid #1f1f1f" }}
            >
              <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--giq-text-muted)" }}>{label}</p>
              <p className="text-sm font-bold" style={{ color }}>{value}{unit}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meals */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {!activeDayData || activeDayData.meals.length === 0 ? (
            <div className="bg-[#151515] rounded-xl border border-[#222222] p-8 text-center">
              <p className="text-[#555555]">{t("no_meals_this_day")}</p>
            </div>
          ) : (
            [...activeDayData.meals]
              .sort((a, b) => {
                const ai = MEAL_ORDER.indexOf(a.meal_type);
                const bi = MEAL_ORDER.indexOf(b.meal_type);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              })
              .map(meal => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  dietType={profile?.diet_type ?? null}
                  goalType={profile?.goal ?? null}
                  dislikedFoods={foodPrefs?.disliked_foods ?? []}
                  allergies={foodPrefs?.allergies ?? []}
                  canSwap={true}
                  lang={lang}
                />
              ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type PickerState = {
  ingredientIndex: number;
  options: SwapOption[];
} | null;

function MealCard({
  meal,
  dietType,
  goalType,
  dislikedFoods,
  allergies,
  canSwap,
  lang,
}: {
  meal: MealRow;
  dietType: string | null;
  goalType: string | null;
  dislikedFoods: string[];
  allergies: string[];
  canSwap: boolean;
  lang: "es" | "en";
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingOptionsIndex, setLoadingOptionsIndex] = useState<number | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [successIndex, setSuccessIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const t = useT();

  const swapMutation = useSwapIngredient();

  const handleRequestSwap = async (ingredient: Ingredient, index: number) => {
    if (loadingOptionsIndex !== null || applyingIndex !== null) return;
    if (picker?.ingredientIndex === index) {
      setPicker(null);
      return;
    }
    setPicker(null);
    setErrorMsg(null);
    setLoadingOptionsIndex(index);
    try {
      const options = await getSwapOptions(
        ingredient.category,
        ingredient.name,
        ingredient.amount,
        dietType,
        goalType,
        dislikedFoods,
        allergies,
        lang,
      );
      if (options.length === 0) {
        setErrorMsg("No se encontraron alternativas para este ingrediente.");
        setLoadingOptionsIndex(null);
        return;
      }
      setLoadingOptionsIndex(null);
      setPicker({ ingredientIndex: index, options });
    } catch {
      setLoadingOptionsIndex(null);
      setErrorMsg("No se pudo cargar. Inténtalo de nuevo.");
    }
  };

  const handleSelectSwap = (index: number, chosen: SwapOption) => {
    setPicker(null);
    setApplyingIndex(index);
    setErrorMsg(null);
    swapMutation.mutate(
      { mealId: meal.id, ingredientIndex: index, chosenSwap: chosen },
      {
        onSuccess: () => {
          setApplyingIndex(null);
          setSuccessIndex(index);
          setTimeout(() => setSuccessIndex(null), 2500);
        },
        onError: (err: Error) => {
          setApplyingIndex(null);
          setErrorMsg(err.message || "Swap failed. Please try again.");
          setTimeout(() => setErrorMsg(null), 3000);
        },
      },
    );
  };

  // ── Snack card (compact style) ────────────────────────────────────────────
  const isSnack = meal.meal_type === "snack_morning" || meal.meal_type === "snack_afternoon";

  if (isSnack) {
    const snackLabel = meal.meal_type === "snack_morning"
      ? (lang === "en" ? "Morning snack" : "Snack mañana")
      : (lang === "en" ? "Afternoon snack" : "Snack tarde");
    const snackCalories = CALORIES_APPROX[meal.meal_type] ?? 175;
    const ingCount = meal.ingredients.length;

    return (
      <div
        className="rounded-xl border overflow-hidden transition-all"
        style={{ backgroundColor: "#0d0d0d", borderColor: "#161616" }}
      >
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left px-4 py-3 transition-colors hover:bg-[#111]"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0 leading-none">{MEAL_EMOJI[meal.meal_type]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(123,140,222,0.12)",
                    border: "1px solid rgba(123,140,222,0.25)",
                    color: "#7B8CDE",
                  }}
                >
                  {snackLabel}
                </span>
                <span className="text-[9px] text-[#444]">{ingCount} {lang === "en" ? "items" : "ingredientes"}</span>
              </div>
              <p className="text-sm font-semibold text-white leading-tight truncate">{meal.meal_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[#555]">🔥 {snackCalories} kcal</span>
              <span
                className="text-[10px] font-semibold transition-colors"
                style={{ color: expanded ? "var(--giq-accent)" : "#555" }}
              >
                {expanded ? (lang === "en" ? "Ver ↑" : "Ver ↑") : (lang === "en" ? "Ver →" : "Ver →")}
              </span>
            </div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 border-t border-[#161616]">
                {errorMsg && (
                  <div className="mt-3 mb-2 flex items-center gap-2 text-xs text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errorMsg}
                  </div>
                )}
                <div className="pt-2 space-y-0.5">
                  {meal.ingredients.map((ing, i) => (
                    <IngredientRow
                      key={i}
                      ingredient={ing}
                      index={i}
                      isLoadingOptions={loadingOptionsIndex === i}
                      isApplying={applyingIndex === i}
                      isSuccess={successIndex === i}
                      pickerOptions={picker?.ingredientIndex === i ? picker.options : null}
                      onRequestSwap={() => handleRequestSwap(ing, i)}
                      onSelectSwap={(opt) => handleSelectSwap(i, opt)}
                      onDismissPicker={() => setPicker(null)}
                      disabled={loadingOptionsIndex !== null || applyingIndex !== null}
                      canSwap={canSwap}
                    />
                  ))}
                </div>
                {meal.notes && (
                  <p className="text-[10px] mt-2 italic" style={{ color: "#7B8CDE" }}>{meal.notes}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Full meal card ─────────────────────────────────────────────────────────
  const plateData = Object.entries(meal.plate_distribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: PLATE_COLORS[name] ?? "#555555",
  }));

  const mealColor = MEAL_COLOR[meal.meal_type] ?? "#AAFF45";
  const mealEmoji = MEAL_EMOJI[meal.meal_type] ?? "🍽️";
  const mealLabel = t(meal.meal_type);
  const prepTime = PREP_TIME[meal.meal_type] ?? 15;
  const calories = CALORIES_APPROX[meal.meal_type] ?? 500;

  // Macro chips from plate distribution
  const proteinPct = meal.plate_distribution?.protein ?? 0;
  const carbsPct = meal.plate_distribution?.carbs ?? 0;
  const fatsPct = meal.plate_distribution?.fats ?? meal.plate_distribution?.fat ?? 0;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "#111", borderColor: "#1a1a1a" }}>

      {/* ── Card top — always visible ── */}
      <div className="px-4 pt-4 pb-3">
        {/* Type row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{mealEmoji}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mealColor }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: mealColor }}>{mealLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px]" style={{ color: "#555" }}>⏱ {prepTime} min</span>
            <span className="text-[10px]" style={{ color: "#555" }}>🔥 {calories} kcal</span>
          </div>
        </div>

        {/* Meal name — full, no truncate */}
        <p className="text-[16px] font-bold leading-snug mb-3" style={{ color: "#e8e8e8" }}>
          {meal.meal_name}
        </p>

        {/* Macro chips */}
        <div className="flex gap-2">
          {proteinPct > 0 && (
            <div className="flex flex-col items-center rounded-lg px-3 py-1.5" style={{ background: "#141414", border: "1px solid #1e1e1e" }}>
              <span className="text-xs font-bold leading-none" style={{ color: "#FF6B6B" }}>{proteinPct}%</span>
              <span className="text-[8px] mt-0.5 uppercase tracking-wide" style={{ color: "#555" }}>{lang === "en" ? "Protein" : "Proteína"}</span>
            </div>
          )}
          {carbsPct > 0 && (
            <div className="flex flex-col items-center rounded-lg px-3 py-1.5" style={{ background: "#141414", border: "1px solid #1e1e1e" }}>
              <span className="text-xs font-bold leading-none" style={{ color: "#FFB347" }}>{carbsPct}%</span>
              <span className="text-[8px] mt-0.5 uppercase tracking-wide" style={{ color: "#555" }}>{lang === "en" ? "Carbs" : "Carbos"}</span>
            </div>
          )}
          {fatsPct > 0 && (
            <div className="flex flex-col items-center rounded-lg px-3 py-1.5" style={{ background: "#141414", border: "1px solid #1e1e1e" }}>
              <span className="text-xs font-bold leading-none" style={{ color: "#7B8CDE" }}>{fatsPct}%</span>
              <span className="text-[8px] mt-0.5 uppercase tracking-wide" style={{ color: "#555" }}>{lang === "en" ? "Fat" : "Grasas"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: "#151515" }}>
        <span className="text-[11px]" style={{ color: "#555" }}>
          {meal.ingredients.length} {lang === "en" ? "ingredients" : "ingredientes"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-[11px] font-bold"
          style={{ color: "var(--giq-accent)" }}
        >
          {expanded ? (lang === "en" ? "Hide ↑" : "Ocultar ↑") : (lang === "en" ? "View recipe →" : "Ver receta →")}
        </button>
      </div>

      {/* ── Expanded recipe panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t" style={{ borderColor: "#1a1a1a" }}>

              {/* 2D Plate chart */}
              {plateData.length > 0 && (
                <div className="flex flex-col items-center py-5 px-4" style={{ background: "#0d0d0d" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "#555" }}>
                    {lang === "en" ? "Plate distribution" : "Distribución del plato"}
                  </p>

                  {/* SVG donut chart — 2D plate */}
                  <div className="relative mb-4" style={{ width: 160, height: 160 }}>
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      {/* Outer plate rim */}
                      <circle cx="80" cy="80" r="78" fill="#1e1e1e" />
                      {/* Segments */}
                      {(() => {
                        const total = plateData.reduce((s, d) => s + d.value, 0);
                        let startAngle = -Math.PI / 2;
                        return plateData.map((seg, i) => {
                          const angle = (seg.value / total) * 2 * Math.PI;
                          const x1 = 80 + 68 * Math.cos(startAngle);
                          const y1 = 80 + 68 * Math.sin(startAngle);
                          const endAngle = startAngle + angle;
                          const x2 = 80 + 68 * Math.cos(endAngle);
                          const y2 = 80 + 68 * Math.sin(endAngle);
                          const largeArc = angle > Math.PI ? 1 : 0;
                          const path = `M 80 80 L ${x1} ${y1} A 68 68 0 ${largeArc} 1 ${x2} ${y2} Z`;
                          const el = <path key={i} d={path} fill={seg.color} opacity="0.9" />;
                          startAngle = endAngle;
                          return el;
                        });
                      })()}
                      {/* Center circle */}
                      <circle cx="80" cy="80" r="38" fill="#141414" />
                      <circle cx="80" cy="80" r="38" fill="none" stroke="#1e1e1e" strokeWidth="2" />
                      {/* Kcal text */}
                      <text x="80" y="75" textAnchor="middle" fill="#e8e8e8" fontSize="16" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{calories}</text>
                      <text x="80" y="89" textAnchor="middle" fill="#555" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif">kcal</text>
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 flex-wrap justify-center">
                    {plateData.map(item => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[10px]" style={{ color: "#888" }}>{t(item.name.toLowerCase())}</span>
                        <span className="text-[11px] font-bold ml-1" style={{ color: item.color }}>{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredients */}
              <div className="px-4 pt-3 pb-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#444" }}>
                  {t("ingredients_portions")}
                </h4>
                {errorMsg && (
                  <div className="mb-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ color: "#FF4444", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)" }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errorMsg}
                  </div>
                )}
                <div className="space-y-0.5">
                  {meal.ingredients.map((ing, i) => (
                    <IngredientRow
                      key={i}
                      ingredient={ing}
                      index={i}
                      isLoadingOptions={loadingOptionsIndex === i}
                      isApplying={applyingIndex === i}
                      isSuccess={successIndex === i}
                      pickerOptions={picker?.ingredientIndex === i ? picker.options : null}
                      onRequestSwap={() => handleRequestSwap(ing, i)}
                      onSelectSwap={(opt) => handleSelectSwap(i, opt)}
                      onDismissPicker={() => setPicker(null)}
                      disabled={loadingOptionsIndex !== null || applyingIndex !== null}
                      canSwap={canSwap}
                    />
                  ))}
                </div>
              </div>

              {/* Notes + close */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: "#1a1a1a" }}>
                {meal.notes
                  ? <p className="text-[10px] italic flex-1 mr-3 leading-snug" style={{ color: "#555" }}>{meal.notes}</p>
                  : <div />}
                <button
                  type="button"
                  className="text-[11px] font-bold shrink-0"
                  style={{ color: "var(--giq-accent)" }}
                  onClick={() => setExpanded(false)}
                >
                  {lang === "en" ? "Close ↑" : "Cerrar ↑"}
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IngredientRow({
  ingredient,
  index,
  isLoadingOptions,
  isApplying,
  isSuccess,
  pickerOptions,
  onRequestSwap,
  onSelectSwap,
  onDismissPicker,
  disabled,
  canSwap,
}: {
  ingredient: Ingredient;
  index: number;
  isLoadingOptions: boolean;
  isApplying: boolean;
  isSuccess: boolean;
  pickerOptions: SwapOption[] | null;
  onRequestSwap: () => void;
  onSelectSwap: (opt: SwapOption) => void;
  onDismissPicker: () => void;
  disabled: boolean;
  canSwap: boolean;
}) {
  const safeName = ingredient?.name?.trim() || null;
  const safeAmount = ingredient?.amount?.trim() || null;

  if (!safeName) return null;

  const isActive = isLoadingOptions || isApplying || pickerOptions !== null;

  return (
    <div>
      <div
        className={`group flex items-center gap-3 py-2 px-3 rounded-lg transition-colors cursor-default ${
          isActive ? "bg-[#1E1E1E]" : "hover:bg-[#1E1E1E]"
        }`}
      >
        {/* Ingredient name */}
        <span className="text-sm font-medium flex-1 min-w-0 sm:truncate break-words">
          {isApplying ? (
            <span className="flex items-center gap-1.5 text-[#555555]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Aplicando…
            </span>
          ) : isSuccess ? (
            <span className="flex items-center gap-1.5 text-[#AAFF45]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="text-white">{safeName}</span>
            </span>
          ) : (
            <span className="text-white">{safeName}</span>
          )}
        </span>

        {/* Amount + visual ref */}
        {safeAmount && (
          <div className="flex flex-col items-end shrink-0 gap-0.5">
            <span className="text-[11px] sm:text-xs text-white font-semibold bg-[#1A1A1A] border border-[#2A2A2A] px-1.5 sm:px-2 py-0.5 rounded-md">
              {safeAmount}
            </span>
            {ingredient.visual_ref && (
              <span className="text-[11px] text-[#555555] italic leading-none">
                {ingredient.visual_ref}
              </span>
            )}
          </div>
        )}

        {/* Swap button */}
        {canSwap && (
          <button
            onClick={onRequestSwap}
            disabled={disabled && !isLoadingOptions}
            title={pickerOptions ? "Close options" : `Swap ${ingredient.name}`}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
              isLoadingOptions
                ? "border-[#AAFF45]/30 text-[#AAFF45] bg-[#AAFF45]/10"
                : pickerOptions !== null
                ? "border-[#AAFF45]/50 text-[#AAFF45] bg-[#AAFF45]/15"
                : disabled
                ? "opacity-30 cursor-not-allowed border-[#2A2A2A] text-[#555555]"
                : "sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 border-[#2A2A2A] text-[#555555] hover:border-[#AAFF45]/30 hover:text-[#AAFF45] hover:bg-[#AAFF45]/10 active:scale-95"
            }`}
          >
            {isLoadingOptions ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{isLoadingOptions ? "…" : "Cambiar"}</span>
          </button>
        )}
      </div>

      {/* Swap options picker panel */}
      <AnimatePresence>
        {pickerOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 mb-2 ml-3 mr-2 bg-[#AAFF45]/5 border border-[#AAFF45]/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-[#AAFF45] uppercase tracking-wide">
                  Elige un sustituto
                </p>
                <button
                  onClick={onDismissPicker}
                  className="text-[#AAFF45]/50 hover:text-[#AAFF45] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {pickerOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectSwap(opt)}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#AAFF45]/30 hover:bg-[#AAFF45]/5 transition-all group/opt active:scale-[0.98]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover/opt:text-[#AAFF45] transition-colors truncate">
                        {opt.name}
                      </p>
                      <p className="text-xs text-[#555555] mt-0.5">{opt.amount}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#AAFF45]/10 text-[#AAFF45] shrink-0 whitespace-nowrap">
                      {opt.reason}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
