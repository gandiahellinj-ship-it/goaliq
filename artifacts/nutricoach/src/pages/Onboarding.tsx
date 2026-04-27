import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, Pencil, Check } from "lucide-react";
import { submitOnboarding, type OnboardingFormData } from "@/lib/onboarding-service";
import { SUPPLEMENTS, SUPPLEMENT_TIMING } from "@/lib/supplements";
import { supabase } from "@/lib/supabase";
import { useT, useLanguage } from "@/lib/language";
import { useGenerateMealPlan, useGenerateWorkoutPlan } from "@/lib/supabase-queries";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: OnboardingFormData = {
  displayName: "",
  age: 30,
  sex: "male",
  heightCm: 170,
  weightKg: 70,
  goalType: "maintain",
  dietType: "balanced",
  allergies: [],
  likedFoods: [],
  dislikedFoods: [],
  trainingLevel: "beginner",
  trainingLocation: "home",
  trainingDaysPerWeek: 3,
  targetWeightKg: null,
  supplements: [],
};

// ─── Goal detail data ─────────────────────────────────────────────────────────

const GOAL_DETAILS: Record<string, {
  description: string;
  descriptionEN: string;
  paces?: { id: string; emoji: string; label: string; labelEN: string; desc: string; descEN: string; recommended?: boolean }[];
}> = {
  lose_fat: {
    description: "Reduciremos las calorías de forma controlada para quemar grasa preservando el máximo músculo posible.",
    descriptionEN: "We'll reduce calories in a controlled way to burn fat while preserving as much muscle as possible.",
    paces: [
      { id: "gentle",     emoji: "🐢", label: "Suave",    labelEN: "Gentle",     desc: "-0.25kg/sem · Preserva más músculo, ideal para atletas",  descEN: "-0.25kg/wk · Preserves more muscle, ideal for athletes" },
      { id: "moderate",   emoji: "🚶", label: "Moderado", labelEN: "Moderate",   desc: "-0.5kg/sem · El ritmo más sostenible a largo plazo",       descEN: "-0.5kg/wk · The most sustainable pace long term",       recommended: true },
      { id: "aggressive", emoji: "🏃", label: "Agresivo", labelEN: "Aggressive", desc: "-1kg/sem · Pérdida rápida, requiere mayor disciplina",      descEN: "-1kg/wk · Fast loss, requires more discipline" },
    ],
  },
  gain_muscle: {
    description: "Aumentaremos las calorías estratégicamente para maximizar la ganancia muscular con mínima grasa.",
    descriptionEN: "We'll increase calories strategically to maximise muscle gain with minimal fat.",
    paces: [
      { id: "gentle",     emoji: "🐢", label: "Volumen limpio",    labelEN: "Clean bulk",     desc: "+0.25kg/sem · Mínima grasa, máxima calidad muscular",        descEN: "+0.25kg/wk · Minimal fat, maximum muscle quality" },
      { id: "moderate",   emoji: "🚶", label: "Volumen moderado",  labelEN: "Moderate bulk",  desc: "+0.5kg/sem · Equilibrio entre músculo y grasa",              descEN: "+0.5kg/wk · Balance between muscle and fat",              recommended: true },
      { id: "aggressive", emoji: "🏃", label: "Volumen agresivo",  labelEN: "Aggressive bulk",desc: "+1kg/sem · Máximo crecimiento, algo más de grasa",           descEN: "+1kg/wk · Maximum growth, some extra fat" },
    ],
  },
  maintain: {
    description: "Mantendremos tu peso actual optimizando la composición corporal — más músculo, menos grasa al mismo peso.",
    descriptionEN: "We'll maintain your current weight while optimising body composition — more muscle, less fat at the same weight.",
  },
  recomposition: {
    description: "Perderás grasa y ganarás músculo simultáneamente. Requiere paciencia pero los resultados son los más duraderos.",
    descriptionEN: "You'll lose fat and gain muscle simultaneously. Requires patience but the results are the most lasting.",
    paces: [
      { id: "gentle",     emoji: "🐢", label: "Conservador", labelEN: "Conservative", desc: "Cambios lentos pero muy sostenibles a largo plazo",         descEN: "Slow changes but very sustainable long term" },
      { id: "moderate",   emoji: "🚶", label: "Estándar",    labelEN: "Standard",     desc: "Balance óptimo entre perder grasa y ganar músculo",         descEN: "Optimal balance between losing fat and gaining muscle",   recommended: true },
      { id: "aggressive", emoji: "🏃", label: "Intensivo",   labelEN: "Intensive",    desc: "Máxima transformación, requiere consistencia total",        descEN: "Maximum transformation, requires total consistency" },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const t = useT();
  const { lang } = useLanguage();

  const isEditMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("edit") === "true";

  const mealMutation = useGenerateMealPlan();
  const workoutMutation = useGenerateWorkoutPlan();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(isEditMode);
  const originalDataRef = useRef<OnboardingFormData | null>(null);

  const [formData, setFormData] = useState<OnboardingFormData>(EMPTY_FORM);
  // selectedSupplements: id -> timingIndex
  const [selectedSupplements, setSelectedSupplements] = useState<Record<string, number>>({});
  const [goalPace, setGoalPace] = useState("moderate");
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState("16:8");

  // ── Prefill in edit mode ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      setPrefilling(true);
      const [{ data: profile }, { data: prefs }, { data: onboarding }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, age, sex, height_cm, weight_kg, target_weight_kg, goal, goal_pace, fasting_protocol, diet_type, training_level, training_location, training_days_per_week",
          )
          .maybeSingle(),
        supabase
          .from("food_preferences")
          .select("allergies, disliked_foods, liked_foods, supplements")
          .maybeSingle(),
        supabase
          .from("onboarding_profiles")
          .select(
            "age, sex, height_cm, weight_kg, target_weight_kg, goal_type, diet_type, allergies, disliked_foods, liked_foods, training_level, training_location, training_days_per_week",
          )
          .maybeSingle(),
      ]);

      const src = onboarding ?? profile;
      if (src) {
        const loaded: OnboardingFormData = {
          displayName: (profile as any)?.full_name ?? EMPTY_FORM.displayName,
          age: src.age ?? EMPTY_FORM.age,
          sex: (src as any).sex ?? EMPTY_FORM.sex,
          heightCm: src.height_cm ?? (src as any).heightCm ?? EMPTY_FORM.heightCm,
          weightKg: src.weight_kg ?? EMPTY_FORM.weightKg,
          targetWeightKg: src.target_weight_kg ?? null,
          goalType: (src as any).goal_type ?? (src as any).goal ?? EMPTY_FORM.goalType,
          dietType: src.diet_type ?? EMPTY_FORM.dietType,
          allergies:
            (prefs?.allergies as string[]) ??
            ((src as any).allergies as string[]) ??
            [],
          dislikedFoods:
            (prefs?.disliked_foods as string[]) ??
            ((src as any).disliked_foods as string[]) ??
            [],
          likedFoods:
            (prefs?.liked_foods as string[]) ??
            ((src as any).liked_foods as string[]) ??
            [],
          trainingLevel: (src as any).training_level ?? EMPTY_FORM.trainingLevel,
          trainingLocation: (src as any).training_location ?? EMPTY_FORM.trainingLocation,
          trainingDaysPerWeek:
            (src as any).training_days_per_week ?? EMPTY_FORM.trainingDaysPerWeek,
          supplements: [],
        };
        setFormData(loaded);
        originalDataRef.current = loaded;

        // Restore goal pace
        const savedPace = (profile as any)?.goal_pace as string | null;
        if (savedPace) setGoalPace(savedPace);

        // Restore fasting protocol
        const savedFasting = (profile as any)?.fasting_protocol as string | null;
        if (savedFasting) {
          setFastingEnabled(true);
          setFastingProtocol(savedFasting);
        }

        // Restore supplement selections
        const savedSupplements = (prefs as any)?.supplements as
          | { id: string; timingIndex: number }[]
          | null;
        if (savedSupplements?.length) {
          const map: Record<string, number> = {};
          savedSupplements.forEach(s => { map[s.id] = s.timingIndex; });
          setSelectedSupplements(map);
        }
      }
      setPrefilling(false);
    })();
  }, [isEditMode]);

  const update = (patch: Partial<OnboardingFormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  function toggleSupplement(id: string) {
    setSelectedSupplements(prev => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = 0;
      }
      return next;
    });
  }

  function setTiming(id: string, idx: number) {
    setSelectedSupplements(prev => ({ ...prev, [id]: idx }));
  }

  const handleSubmit = async () => {
    if (!formData.displayName.trim()) {
      setError(lang === "en" ? "Please enter your name." : "Por favor, introduce tu nombre.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const supplements = Object.entries(selectedSupplements).map(([id, timingIndex]) => ({
        id,
        timingIndex,
      }));
      await submitOnboarding({ ...formData, supplements, goalPace, fastingProtocol: fastingEnabled ? fastingProtocol : null });

      // Fire both mutations directly — GenerationOverlay handles the loading UI globally
      mealMutation.mutate({ lang });
      workoutMutation.mutate({ lang });

      // Navigate to home so user sees the overlay over the main app
      setLocation("/");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (prefilling) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        <Logo />
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="w-7 h-7 border-2 border-[#AAFF45] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#555555] font-medium">{t("loading_preferences")}</p>
        </div>
      </div>
    );
  }

  const isES = lang !== "en";

  return (
    <div className="min-h-screen py-10 px-4 font-sans" style={{ background: "#0a0a0a" }}>
      <div className="max-w-xl mx-auto">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Edit mode banner */}
        {isEditMode && (
          <div className="mb-6 flex items-center gap-2.5 bg-[#AAFF45]/5 border border-[#AAFF45]/15 rounded-lg px-4 py-3">
            <Pencil className="w-4 h-4 text-[#AAFF45] shrink-0" />
            <p className="text-sm text-[#AAFF45]/80 font-medium">
              {t("updating_both_plans")}
            </p>
          </div>
        )}

        {/* Page title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-black uppercase text-white">
            {isEditMode
              ? (isES ? "Actualiza tu perfil" : "Update your profile")
              : (isES ? "Crea tu plan" : "Create your plan")}
          </h1>
          <p className="text-sm text-[#555555] mt-1">
            {isES
              ? "Completa todos los campos para personalizar tu plan"
              : "Fill in all fields to personalise your plan"}
          </p>
        </div>

        <div className="space-y-3">

          {/* ── Section 1: Sobre ti ─────────────────────────────────────── */}
          <SectionCard emoji="👤" title={isES ? "Sobre ti" : "About you"}>
            <Field label={t("what_call_you")} hint={t("personalise_hint")}>
              <input
                type="text"
                value={formData.displayName}
                placeholder={t("name_placeholder")}
                autoComplete="given-name"
                onChange={e => update({ displayName: e.target.value })}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("how_old")}>
                <input
                  type="number"
                  min={10}
                  max={110}
                  value={formData.age}
                  onChange={e => update({ age: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label={t("bio_sex")}>
                <select
                  value={formData.sex}
                  onChange={e => update({ sex: e.target.value })}
                  className={inputClass}
                >
                  <option value="male">{t("sex_male")}</option>
                  <option value="female">{t("sex_female")}</option>
                  <option value="other">{t("sex_other")}</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("height_cm")}>
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={formData.heightCm}
                  onChange={e => update({ heightCm: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label={t("current_weight_kg")}>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={formData.weightKg}
                  onChange={e => update({ weightKg: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={t("target_weight_kg")} hint={isES ? "Opcional" : "Optional"}>
              <input
                type="number"
                min={30}
                max={300}
                value={formData.targetWeightKg ?? ""}
                placeholder={t("target_weight_placeholder")}
                onChange={e =>
                  update({ targetWeightKg: e.target.value ? Number(e.target.value) : null })
                }
                className={inputClass}
              />
            </Field>
          </SectionCard>

          {/* ── Section 2: Tu objetivo ──────────────────────────────────── */}
          <SectionCard emoji="🎯" title={isES ? "Tu objetivo" : "Your goal"}>
            <div className="flex flex-col gap-3">
              {[
                { id: "lose_fat",      emoji: "🔥", label: isES ? "Perder peso"   : "Lose weight" },
                { id: "gain_muscle",   emoji: "💪", label: isES ? "Ganar músculo" : "Build muscle" },
                { id: "maintain",      emoji: "⚖️", label: isES ? "Mantenerme"    : "Stay fit" },
                { id: "recomposition", emoji: "🔄", label: isES ? "Recomposición" : "Recomposition" },
              ].map(g => {
                const isSelected = formData.goalType === g.id;
                const detail = GOAL_DETAILS[g.id];
                return (
                  <div
                    key={g.id}
                    className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? "border-[#AAFF45] bg-[#AAFF45]/5"
                        : "border-[#2A2A2A] bg-[#111111] hover:border-[#3A3A3A]"
                    }`}
                  >
                    {/* Goal header */}
                    <button
                      type="button"
                      onClick={() => update({ goalType: g.id })}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <span className="text-2xl shrink-0">{g.emoji}</span>
                      <span className={`text-sm font-bold flex-1 ${isSelected ? "text-[#AAFF45]" : "text-white"}`}>
                        {g.label}
                      </span>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? "border-[#AAFF45] bg-[#AAFF45]" : "border-[#3A3A3A]"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-[#0A0A0A]" />}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isSelected && detail && (
                      <div className="px-4 pb-4 border-t border-[#AAFF45]/10">
                        {/* Coach description */}
                        <p className="text-xs text-[#888] mt-3 mb-3 leading-relaxed">
                          💬 {isES ? detail.description : detail.descriptionEN}
                        </p>

                        {/* Pace options */}
                        {detail.paces && (
                          <>
                            <p className="text-xs font-semibold text-[#A0A0A0] mb-2">
                              {isES ? "¿A qué ritmo?" : "At what pace?"}
                            </p>
                            <div className="flex flex-col gap-2">
                              {detail.paces.map(pace => (
                                <button
                                  key={pace.id}
                                  type="button"
                                  onClick={() => setGoalPace(pace.id)}
                                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                                    goalPace === pace.id
                                      ? "border-[#AAFF45]/60 bg-[#AAFF45]/10"
                                      : "border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]"
                                  }`}
                                >
                                  <span className="text-base shrink-0">{pace.emoji}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold ${goalPace === pace.id ? "text-[#AAFF45]" : "text-white"}`}>
                                        {isES ? pace.label : pace.labelEN}
                                      </span>
                                      {pace.recommended && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#AAFF45]/20 text-[#AAFF45]">
                                          {isES ? "Recomendado" : "Recommended"}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-[#555] mt-0.5 leading-snug">
                                      {isES ? pace.desc : pace.descEN}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Section 2b: Ayuno intermitente ──────────────────────────── */}
          <SectionCard emoji="⏱" title={isES ? "Ayuno intermitente" : "Intermittent fasting"} badge={isES ? "opcional" : "optional"}>
            <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
              fastingEnabled ? "border-[#AAFF45]/40 bg-[#AAFF45]/5" : "border-[#2A2A2A] bg-[#111111]"
            }`}>
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setFastingEnabled(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-2xl shrink-0">🕐</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${fastingEnabled ? "text-[#AAFF45]" : "text-white"}`}>
                    {isES ? "Practico ayuno intermitente" : "I practice intermittent fasting"}
                  </p>
                  <p className="text-xs text-[#555] mt-0.5">
                    {isES ? "La IA adaptará los horarios de tus comidas" : "The AI will adapt your meal timing"}
                  </p>
                </div>
                {/* Toggle switch */}
                <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${fastingEnabled ? "bg-[#AAFF45]" : "bg-[#2A2A2A]"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${fastingEnabled ? "left-6" : "left-1"}`} />
                </div>
              </button>

              {/* Protocol picker */}
              {fastingEnabled && (
                <div className="px-4 pb-4 border-t border-[#AAFF45]/10">
                  <p className="text-xs font-semibold text-[#A0A0A0] mt-3 mb-2">
                    {isES ? "Elige tu protocolo" : "Choose your protocol"}
                  </p>
                  <div className="flex flex-col gap-2">
                    {([
                      { id: "12:12", label: "12:12", badge: isES ? "Para empezar" : "Beginner",    badgeColor: "#7B8CDE", desc: isES ? "El más suave. 12h de ayuno, ideal para principiantes. Generalmente de 20:00 a 08:00." : "The gentlest. 12h fast, ideal for beginners. Typically 8pm to 8am." },
                      { id: "16:8", label: "16:8",  badge: isES ? "Más popular"  : "Most popular", badgeColor: "#88ee22", desc: isES ? "Ayunas 16h y comes en 8h. Ej: comes de 12:00 a 20:00 y ayunas el resto." : "Fast 16h, eat in 8h window. E.g. eat 12pm–8pm, fast the rest." },
                      { id: "18:6", label: "18:6",  badge: null,                                    badgeColor: null,     desc: isES ? "Ventana de 6 horas. Más restrictivo, mayor flexibilidad metabólica. Ej: comes de 13:00 a 19:00." : "6-hour eating window. More restrictive, greater metabolic flexibility." },
                      { id: "20:4", label: "20:4",  badge: isES ? "Avanzado"    : "Advanced",      badgeColor: "#FFB800", desc: isES ? "Solo 4 horas para comer. Warrior Diet. Para usuarios con experiencia en ayuno." : "Only 4 hours to eat. Warrior Diet. For experienced fasters." },
                      { id: "5:2",  label: "5:2",   badge: null,                                    badgeColor: null,     desc: isES ? "Comes normal 5 días y restricción de 500-600 kcal los otros 2 días no consecutivos." : "Eat normally 5 days, restrict to 500-600 kcal on 2 non-consecutive days." },
                    ] as const).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFastingProtocol(p.id)}
                        className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                          fastingProtocol === p.id
                            ? "border-[#AAFF45]/60 bg-[#AAFF45]/10"
                            : "border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${fastingProtocol === p.id ? "text-[#AAFF45]" : "text-white"}`}>
                            {p.label}
                          </span>
                          {p.badge && p.badgeColor && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: `${p.badgeColor}20`, color: p.badgeColor }}
                            >
                              {p.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#555] leading-snug">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2.5">
                    <span className="text-xs shrink-0">💡</span>
                    <p className="text-[10px] text-[#777] leading-snug">
                      {isES
                        ? "Tu plan de comidas respetará tu ventana de alimentación. Las comidas se distribuirán dentro de las horas que puedes comer según el protocolo elegido."
                        : "Your meal plan will respect your eating window. Meals will be distributed within the hours you can eat according to your chosen protocol."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Section 3: Tu dieta ─────────────────────────────────────── */}
          <SectionCard emoji="🥗" title={isES ? "Tu dieta" : "Your diet"}>
            <Field label={t("diet_type_question")}>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { id: "balanced",     label: isES ? "Equilibrada"        : "Balanced" },
                  { id: "mediterranean",label: isES ? "Mediterránea"       : "Mediterranean" },
                  { id: "high_protein", label: isES ? "Alta en proteína"   : "High Protein" },
                  { id: "keto",         label: isES ? "Keto"               : "Keto" },
                  { id: "vegetarian",   label: isES ? "Vegetariana"        : "Vegetarian" },
                  { id: "vegan",        label: isES ? "Vegana"             : "Vegan" },
                  { id: "gluten_free",  label: isES ? "Sin gluten"         : "Gluten Free" },
                  { id: "lactose_free", label: isES ? "Sin lactosa"        : "Lactose Free" },
                ].map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => update({ dietType: d.id })}
                    className={pillClass(formData.dietType === d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("food_allergies")}>
              <TagInput
                tags={formData.allergies}
                onChange={v => update({ allergies: v })}
                placeholder={t("allergies_placeholder")}
                accentColor="green"
              />
            </Field>

            <Field label={t("foods_avoid")}>
              <TagInput
                tags={formData.dislikedFoods}
                onChange={v => update({ dislikedFoods: v })}
                placeholder={t("foods_avoid_placeholder")}
                accentColor="red"
              />
            </Field>

            <Field label={t("foods_love")} hint={t("foods_love_hint")}>
              <TagInput
                tags={formData.likedFoods}
                onChange={v => update({ likedFoods: v })}
                placeholder={t("foods_love_placeholder")}
                accentColor="orange"
              />
            </Field>
          </SectionCard>

          {/* ── Section 4: Entrenamiento ────────────────────────────────── */}
          <SectionCard emoji="🏋️" title={isES ? "Entrenamiento" : "Training"}>
            <Field label={t("fitness_level")}>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {[
                  { id: "beginner",     emoji: "🌱", label: isES ? "Principiante" : "Beginner" },
                  { id: "intermediate", emoji: "⚡", label: isES ? "Intermedio"   : "Intermediate" },
                  { id: "advanced",     emoji: "🏆", label: isES ? "Avanzado"     : "Advanced" },
                ].map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => update({ trainingLevel: l.id })}
                    className={choiceCardClass(formData.trainingLevel === l.id)}
                  >
                    <span className="text-xl mb-1">{l.emoji}</span>
                    <span className="text-xs font-semibold">{l.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("where_workout")}>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {[
                  { id: "gym",     emoji: "🏋️", label: isES ? "Gimnasio" : "Gym" },
                  { id: "home",    emoji: "🏠", label: isES ? "Casa"     : "Home" },
                  { id: "outdoor", emoji: "🌳", label: isES ? "Exterior" : "Outdoor" },
                ].map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => update({ trainingLocation: l.id })}
                    className={choiceCardClass(formData.trainingLocation === l.id)}
                  >
                    <span className="text-xl mb-1">{l.emoji}</span>
                    <span className="text-xs font-semibold">{l.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("training_days_slider", { n: formData.trainingDaysPerWeek })}>
              <input
                type="range"
                min="1"
                max="7"
                value={formData.trainingDaysPerWeek}
                onChange={e => update({ trainingDaysPerWeek: Number(e.target.value) })}
                className="w-full accent-[#AAFF45] h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer mt-2"
              />
              <div className="flex justify-between text-xs text-[#555555] mt-1 px-0.5">
                <span>{t("one_day")}</span>
                <span>{t("seven_days")}</span>
              </div>
            </Field>
          </SectionCard>

          {/* ── Section 5: Suplementos ──────────────────────────────────── */}
          <SectionCard
            emoji="💊"
            title={isES ? "Suplementos" : "Supplements"}
            badge={isES ? "opcional" : "optional"}
          >
            <p className="text-xs text-[#555555] -mt-1 mb-2">
              {isES
                ? "Selecciona los que tomas y elige el mejor momento para tomarlos"
                : "Select the ones you take and choose the best time"}
            </p>
            <div className="space-y-2">
              {SUPPLEMENTS.map(supp => {
                const isSelected = supp.id in selectedSupplements;
                const timing = SUPPLEMENT_TIMING[supp.id];
                const selectedTimingIdx = selectedSupplements[supp.id] ?? 0;

                return (
                  <div
                    key={supp.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? "border-[#AAFF45]/40 bg-[#AAFF45]/5"
                        : "border-[#2A2A2A] bg-[#111111] hover:border-[#3A3A3A]"
                    }`}
                  >
                    {/* Card header — always visible */}
                    <button
                      type="button"
                      onClick={() => toggleSupplement(supp.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-xl shrink-0">{supp.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold leading-tight ${
                            isSelected ? "text-[#AAFF45]" : "text-white"
                          }`}
                        >
                          {supp.name}
                        </p>
                        <p className="text-xs text-[#555555] mt-0.5 leading-tight">
                          {supp.shortDesc}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "border-[#AAFF45] bg-[#AAFF45]"
                            : "border-[#3A3A3A]"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-[#0A0A0A]" />}
                      </div>
                    </button>

                    {/* Expanded timing picker */}
                    {isSelected && timing && (
                      <div className="px-4 pb-4 border-t border-[#AAFF45]/10">
                        <p className="text-xs font-semibold text-[#A0A0A0] mt-3 mb-2">
                          {isES ? "¿Cuándo lo tomas?" : "When do you take it?"}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {timing.options.map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setTiming(supp.id, idx)}
                              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                                selectedTimingIdx === idx
                                  ? "border-[#AAFF45]/60 bg-[#AAFF45]/10"
                                  : "border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]"
                              }`}
                            >
                              <span
                                className={`text-xs font-bold ${
                                  selectedTimingIdx === idx ? "text-[#AAFF45]" : "text-white"
                                }`}
                              >
                                {opt.time}
                              </span>
                              <span className="text-[10px] text-[#555555] leading-snug">
                                {opt.desc}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Science tip */}
                        <div className="mt-3 flex items-start gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2.5">
                          <span className="text-xs shrink-0">💡</span>
                          <p className="text-[10px] text-[#777777] leading-snug">{timing.tip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Section 6: CTA ──────────────────────────────────────────── */}
          <div className="rounded-2xl border p-5 pb-6" style={{ background: "#141414", borderColor: "#1f1f1f" }}>
            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-start gap-3 bg-[#FF4444]/10 border border-[#FF4444]/20 text-[#FF4444] text-sm rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {isEditMode ? t("couldnt_save_prefs") : t("couldnt_create_plan")}
                  </p>
                  <p className="text-[#FF4444]/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl font-bold text-base bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-[#AAFF45]/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isEditMode ? t("saving_regenerating") : t("creating_plan")}
                </>
              ) : (
                <>
                  🚀{" "}
                  {isEditMode
                    ? t("save_regenerate")
                    : (isES ? "Crear mi plan personalizado" : "Create my personalised plan")}
                </>
              )}
            </button>

            <p className="text-center text-xs text-[#444444] mt-3">
              {isES
                ? "Tu plan de comidas y entrenamientos estará listo en ~30 segundos"
                : "Your meal and workout plan will be ready in ~30 seconds"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
  accentColor = "green",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  accentColor?: "green" | "orange" | "red";
}) {
  const [input, setInput] = useState("");

  const tagStyles = {
    green:  "bg-[#AAFF45]/15 border-[#AAFF45]/30 text-[#AAFF45]",
    orange: "bg-[#FFB800]/15 border-[#FFB800]/30 text-[#FFB800]",
    red:    "bg-[#FF6B6B]/15 border-[#FF6B6B]/30 text-[#FF6B6B]",
  };

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || tags.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onChange([...tags, trimmed]);
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className="min-h-[48px] w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] focus-within:border-[#AAFF45]/50 focus-within:ring-2 focus-within:ring-[#AAFF45]/10 transition-all flex flex-wrap gap-2 items-center cursor-text"
        onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${tagStyles[accentColor]}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-white transition-colors leading-none text-sm"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) { addTag(input); setInput(""); }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-white placeholder:text-[#3A3A3A] text-sm outline-none"
        />
      </div>
      <p className="text-[10px] text-[#444] mt-1.5">
        Escribe y pulsa Enter · Backspace para borrar
      </p>
    </div>
  );
}

function Logo() {
  return (
    <span className="font-display font-black italic text-2xl leading-none">
      <span className="text-white">Goal</span>
      <span className="text-[#AAFF45]">IQ</span>
    </span>
  );
}

function SectionCard({
  emoji,
  title,
  badge,
  children,
}: {
  emoji: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: "#141414", borderColor: "#1f1f1f" }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-2 mb-5 pb-3"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <span className="text-lg">{emoji}</span>
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#888" }}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-[9px] font-semibold rounded-full px-2 py-0.5 ml-1"
            style={{ color: "#555", background: "#1a1a1a", border: "1px solid #2a2a2a" }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#A0A0A0]">{label}</label>
      {hint && <p className="text-xs text-[#555555] -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder:text-[#3A3A3A] focus:border-[#AAFF45]/50 focus:ring-2 focus:ring-[#AAFF45]/10 outline-none transition-all text-sm";

function pillClass(active: boolean) {
  return `px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
    active
      ? "bg-[#AAFF45]/15 border-[#AAFF45]/50 text-[#AAFF45]"
      : "bg-[#111111] border-[#2A2A2A] text-[#555555] hover:border-[#3A3A3A] hover:text-[#888]"
  }`;
}

function choiceCardClass(active: boolean) {
  return `flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 font-medium transition-all text-sm ${
    active
      ? "border-[#AAFF45] bg-[#AAFF45]/10 text-[#AAFF45]"
      : "border-[#2A2A2A] bg-[#111111] text-[#555555] hover:border-[#3A3A3A]"
  }`;
}

function goalCardClass(active: boolean) {
  return `flex flex-col items-center justify-center py-5 px-3 rounded-xl border-2 font-medium transition-all ${
    active
      ? "border-[#AAFF45] bg-[#AAFF45]/10 text-[#AAFF45]"
      : "border-[#2A2A2A] bg-[#111111] text-[#555555] hover:border-[#3A3A3A]"
  }`;
}
