import { useState, useEffect, useRef } from "react";
import { useMealPlan, useProfile, useFoodPreferences, useSwapIngredient, useGenerateMealPlan, getSwapOptions } from "@/lib/supabase-queries";
import type { MealRow, Ingredient, SwapOption } from "@/lib/supabase-queries";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X, Pencil, ChevronDown, Utensils } from "lucide-react";
import { TrialGate } from "@/components/TrialGate";
import { useAuth } from "@/hooks/useAuth";
import { useT, translateDay } from "@/lib/language";
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
  fruit: "#f472b6",
  dairy: "#facc15",
  other: "#555555",
};

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🥙",
  dinner: "🍽️",
  snack: "🍎",
};

const MEAL_COLOR: Record<string, string> = {
  breakfast: "#AAFF45",
  lunch: "#FFB347",
  dinner: "#7B8CDE",
  snack: "#888888",
};

const MEAL_LABEL_ES: Record<string, string> = {
  breakfast: "DESAYUNO",
  lunch: "COMIDA",
  dinner: "CENA",
  snack: "SNACK",
};

const PREP_TIME: Record<string, number> = {
  breakfast: 10,
  lunch: 15,
  dinner: 25,
  snack: 5,
};

const CALORIES_APPROX: Record<string, number> = {
  breakfast: 400,
  lunch: 650,
  dinner: 550,
  snack: 200,
};

const NUTRIENT_ES: Record<string, string> = {
  protein: "Proteína",
  carbs: "Carbohidratos",
  carbohydrates: "Carbohidratos",
  fat: "Grasas",
  fats: "Grasas",
  vegetables: "Verduras",
  fruit: "Fruta",
  fruits: "Fruta",
  dairy: "Lácteos",
  other: "Otros",
};

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

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const defaultDay = DAYS.find(d => d.id === todayName)?.id ?? "monday";
  const [activeDay, setActiveDay] = useState(defaultDay);
  const [showConfirm, setShowConfirm] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);

  const isLoading = mealLoading || profileLoading;

  useEffect(() => {
    if (autoGenTriggered.current) return;
    if (!session?.access_token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("regenerate") !== "true") return;
    autoGenTriggered.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    generateMutation.mutate(
      { token: session.access_token },
      {
        onSuccess: () => {
          setGenSuccess(true);
          setTimeout(() => setGenSuccess(false), 3500);
        },
      },
    );
  }, [session?.access_token]);

  function handleGenerate() {
    if (!session?.access_token) return;
    setShowConfirm(false);
    generateMutation.mutate(
      { token: session.access_token },
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

  const dietLabel = profile?.diet_type ? (DIET_LABELS[profile.diet_type] ?? profile.diet_type) : null;
  const goalLabel = profile?.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : null;

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-black uppercase flex items-center gap-2" style={{ color: "var(--giq-text-primary)" }}>
            <Utensils className="w-6 h-6" style={{ color: "var(--giq-accent)" }} /> {t("weekly_menu")}
          </h1>
          {dietLabel && goalLabel ? (
            <p className="text-sm mt-1" style={{ color: "var(--giq-text-muted)" }}>
              Tu plan personalizado · {dietLabel} · {goalLabel}
            </p>
          ) : (
            <p className="text-sm text-[#555555] mt-1">
              {t("week_of")} {new Date(mealPlan.weekStart + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
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

      {/* Day Tabs — redesigned */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 mb-6 scrollbar-hide">
        {DAYS.map(day => {
          const isToday = day.id === todayName;
          const isActive = day.id === activeDay;
          return (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-all relative flex flex-col items-center gap-0.5"
              style={
                isActive
                  ? { backgroundColor: "var(--giq-accent)", color: "var(--giq-accent-text)", fontWeight: 900 }
                  : { backgroundColor: "var(--giq-bg-card)", color: "var(--giq-text-muted)", border: "1px solid var(--giq-border)", fontWeight: 600 }
              }
            >
              {isToday && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--giq-accent-text) 40%, transparent)" : "var(--giq-accent)" }}
                />
              )}
              <span>{translateDay(day.id, t)}</span>
              {!isToday && <span className="w-1.5 h-1.5" />}
            </button>
          );
        })}
      </div>

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
            activeDayData.meals.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                dietType={profile?.diet_type ?? null}
                goalType={profile?.goal ?? null}
                dislikedFoods={foodPrefs?.disliked_foods ?? []}
                allergies={foodPrefs?.allergies ?? []}
                canSwap={true}
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
}: {
  meal: MealRow;
  dietType: string | null;
  goalType: string | null;
  dislikedFoods: string[];
  allergies: string[];
  canSwap: boolean;
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

  const plateData = Object.entries(meal.plate_distribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: PLATE_COLORS[name] ?? "#555555",
  }));

  const mealColor = MEAL_COLOR[meal.meal_type] ?? "#AAFF45";
  const mealLabel = MEAL_LABEL_ES[meal.meal_type] ?? meal.meal_type.toUpperCase();
  const prepTime = PREP_TIME[meal.meal_type] ?? 15;
  const calories = CALORIES_APPROX[meal.meal_type] ?? 500;

  return (
    <div
      className="rounded-xl border border-[#222222] overflow-hidden transition-all hover:border-[#333333]"
      style={{ backgroundColor: "#151515", borderLeftWidth: 3, borderLeftColor: mealColor }}
    >
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-5 py-4 transition-colors hover:bg-[#111111]"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Meal type label */}
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-1"
              style={{ color: mealColor }}
            >
              {mealLabel}
            </p>
            {/* Meal name */}
            <p className="text-[22px] font-bold text-white leading-tight">
              {meal.meal_name}
            </p>
          </div>

          {/* Info pills + chevron */}
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-[#A0A0A0] bg-[#2A2A2A] px-2 py-1 rounded-full whitespace-nowrap">
              ⏱ {prepTime} min
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#A0A0A0] bg-[#2A2A2A] px-2 py-1 rounded-full whitespace-nowrap">
              🔥 {calories} kcal
            </span>
            <ChevronDown
              className="w-4 h-4 text-[#555555] transition-transform duration-300 shrink-0"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-[#222222]">
              <div className="flex flex-col sm:flex-row gap-5 pt-4">

                {/* Ingredients */}
                <div className="flex-1">
                  <h4 className="text-[10px] font-bold text-[#444444] uppercase tracking-widest mb-3">
                    {t("ingredients_portions")}
                  </h4>

                  {errorMsg && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errorMsg}
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

                {/* Donut chart — hidden on mobile, visible on sm+ */}
                {plateData.length > 0 && (
                  <div className="shrink-0">
                    {/* Mobile: compact inline pills */}
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                      {plateData.map(item => (
                        <span
                          key={item.name}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${item.color}18`, color: item.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          {NUTRIENT_ES[item.name.toLowerCase()] ?? item.name} {item.value}%
                        </span>
                      ))}
                    </div>

                    {/* Desktop: full chart + legend */}
                    <div className="hidden sm:flex flex-col items-center w-[130px]">
                      <h4 className="text-[10px] font-bold text-[#444444] uppercase tracking-widest mb-2 self-center">
                        {t("distribution")}
                      </h4>
                      <div className="w-[110px] h-[110px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={plateData}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={48}
                              dataKey="value"
                              stroke="none"
                            >
                              {plateData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => [`${v}%`]}
                              contentStyle={{
                                borderRadius: 8,
                                border: "1px solid #2A2A2A",
                                backgroundColor: "#1A1A1A",
                                fontSize: 12,
                                padding: "6px 10px",
                                color: "#FFFFFF",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1 mt-1 w-full">
                        {plateData.map(item => (
                          <div key={item.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[#555555] flex-1 truncate">{NUTRIENT_ES[item.name.toLowerCase()] ?? item.name}</span>
                            <span className="font-bold text-white">{item.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
        <span className="text-sm font-medium flex-1 min-w-0 truncate">
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
            <span className="text-xs text-white font-semibold bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5 rounded-md">
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
                : "opacity-0 group-hover:opacity-100 focus:opacity-100 border-[#2A2A2A] text-[#555555] hover:border-[#AAFF45]/30 hover:text-[#AAFF45] hover:bg-[#AAFF45]/10 active:scale-95"
            }`}
          >
            {isLoadingOptions ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>{isLoadingOptions ? "…" : "Cambiar"}</span>
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
