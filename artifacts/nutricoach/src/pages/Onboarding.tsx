import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, Pencil, Check, AlertTriangle, LogOut } from "lucide-react";
import { submitOnboarding, logInfoShown, logWarningShown, logBlocked, logWarningAccepted, buildUserDataSnapshot, imcToCategory, type UserDataSnapshot, type BlockReason, type ImcCategory, type OnboardingFormData } from "@/lib/onboarding-service";
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

// ─── Health screening (Step 0) ────────────────────────────────────────────────

type HealthConditionKey =
  | "pregnancy_lactation"
  | "eating_disorder"
  | "diabetes"
  | "cardiovascular"
  | "kidney_liver"
  | "on_medication"
  | "physical_limitations"
  | "minor_age"
  | "severe_allergies";

const BLOCKING_CONDITIONS: HealthConditionKey[] = [
  "pregnancy_lactation",
  "eating_disorder",
  "diabetes",
  "cardiovascular",
  "kidney_liver",
  "on_medication",
  "physical_limitations",
  "minor_age",
];

const CONDITION_LABELS: Record<HealthConditionKey, { es: string; en: string }> = {
  pregnancy_lactation:  { es: "Estoy embarazada o en periodo de lactancia",            en: "I am pregnant or breastfeeding" },
  eating_disorder:      { es: "Tengo o he tenido un trastorno alimentario",            en: "I have or have had an eating disorder" },
  diabetes:             { es: "Tengo diabetes (tipo 1 o 2)",                           en: "I have diabetes (type 1 or 2)" },
  cardiovascular:       { es: "Tengo una condición cardiovascular diagnosticada",      en: "I have a diagnosed cardiovascular condition" },
  kidney_liver:         { es: "Tengo problemas renales o hepáticos",                   en: "I have kidney or liver problems" },
  on_medication:        { es: "Estoy bajo medicación que afecta a alimentación o ejercicio", en: "I am on medication that affects diet or exercise" },
  physical_limitations: { es: "Tengo lesiones o limitaciones físicas significativas",  en: "I have significant injuries or physical limitations" },
  minor_age:            { es: "Soy menor de 18 años",                                  en: "I am under 18 years old" },
  severe_allergies:     { es: "Tengo alergias o intolerancias graves",                 en: "I have severe allergies or intolerances" },
};

const BLOCK_REASON_LABELS: Record<string, { es: string; en: string }> = {
  pregnancy_lactation:  { es: "embarazo o lactancia",                                  en: "pregnancy or breastfeeding" },
  eating_disorder:      { es: "trastornos alimentarios",                               en: "eating disorders" },
  diabetes:             { es: "diabetes",                                              en: "diabetes" },
  cardiovascular:       { es: "condiciones cardiovasculares",                          en: "cardiovascular conditions" },
  kidney_liver:         { es: "problemas renales o hepáticos",                         en: "kidney or liver conditions" },
  on_medication:        { es: "medicación que afecta a tu alimentación o ejercicio",   en: "medication affecting diet or exercise" },
  physical_limitations: { es: "limitaciones físicas significativas",                   en: "significant physical limitations" },
  minor_age:            { es: "menores de 18 años",                                    en: "minors under 18" },
  multiple:             { es: "varias condiciones de salud",                           en: "several health conditions" },
};

const PROFESSIONAL_LOOKUP_URL =
  "https://www.consejodietistasnutricionistas.com/encuentra-tu-dietista-nutricionista/";

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

// ─── IMC Utilities ───────────────────────────────────────────────────────────

function calcIMC(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  return weightKg / Math.pow(heightCm / 100, 2);
}

function calcWeightMin(heightCm: number): number {
  return Math.round(18.5 * Math.pow(heightCm / 100, 2) * 10) / 10;
}

function calcWeightMax(heightCm: number): number {
  return Math.round(24.9 * Math.pow(heightCm / 100, 2) * 10) / 10;
}


// Tone values extracted from HEALTH_MATRIX so the useEffect can run before any
// early return and keep the hook count stable across all renders.
type ToneValue = "info" | "caution" | "warn" | "block";
type GoalKey   = "lose_fat" | "gain_muscle" | "maintain" | "recomposition";
interface MatrixEntry {
  tone: ToneValue;
  msgES: string;
  msgEN: string;
  check1ES?: string; check1EN?: string;
  check2ES?: string; check2EN?: string;
}

const TONE_LOOKUP: Record<ImcCategory, Record<GoalKey, ToneValue>> = {
  underweight: { lose_fat: "block",   gain_muscle: "info",    maintain: "caution", recomposition: "info" },
  normal:      { lose_fat: "caution", gain_muscle: "info",    maintain: "info",    recomposition: "info" },
  overweight:  { lose_fat: "info",    gain_muscle: "caution", maintain: "caution", recomposition: "info" },
  obesity_1:   { lose_fat: "info",    gain_muscle: "warn",    maintain: "warn",    recomposition: "info" },
  obesity_2:   { lose_fat: "warn",    gain_muscle: "warn",    maintain: "block",   recomposition: "warn" },
  obesity_3:   { lose_fat: "warn",    gain_muscle: "warn",    maintain: "block",   recomposition: "warn" },
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
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [supplementTimes, setSupplementTimes] = useState<Record<string, string>>({});
  const [goalPace, setGoalPace] = useState("moderate");
  const [paceIndex, setPaceIndex] = useState(1);
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState("16:8");
  const [currentStep, setCurrentStep] = useState(0);
  const [healthCheckbox1, setHealthCheckbox1] = useState(false);
  const [healthCheckbox2, setHealthCheckbox2] = useState(false);
  const [ageCheckbox1, setAgeCheckbox1] = useState(false);
  const [ageCheckbox2, setAgeCheckbox2] = useState(false);

  // ── Health screening (Step 0) ──────────────────────────────────────────
  const [conditions, setConditions] = useState<Record<HealthConditionKey, boolean>>({
    pregnancy_lactation: false,
    eating_disorder: false,
    diabetes: false,
    cardiovascular: false,
    kidney_liver: false,
    on_medication: false,
    physical_limitations: false,
    minor_age: false,
    severe_allergies: false,
  });
  const [declaredNoConditions, setDeclaredNoConditions] = useState(false);
  const [allergiesAcknowledged, setAllergiesAcknowledged] = useState(false);
  const [screeningCheckLoading, setScreeningCheckLoading] = useState(!isEditMode);
  const [screeningSubmitting, setScreeningSubmitting] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [showBlockedView, setShowBlockedView] = useState(false);
  const [showAllergiesWarning, setShowAllergiesWarning] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const STEPS = ["salud", "sobre-ti", "objetivo", "dieta", "entrenamiento", "suplementos", "resumen"];
  const STEP_NAMES_ES = ["Salud", "Sobre ti", "Tu objetivo", "Tu dieta", "Entrenamiento", "Suplementos", "Resumen"];
  const STEP_NAMES_EN = ["Health", "About you", "Your goal", "Your diet", "Training", "Supplements", "Summary"];

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
        if (savedPace) {
          setGoalPace(savedPace);
          setPaceIndex(savedPace === "gentle" ? 0 : savedPace === "aggressive" ? 2 : 1);
        }

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

  // ── Initial health screening check ───────────────────────────────────────
  // Runs once on mount. Decides whether to show the questionnaire (step 0),
  // skip straight to step 1 (sobre ti), or render the blocked view.
  useEffect(() => {
    if (isEditMode) {
      // Editing an existing onboarding implies the screening already passed.
      setCurrentStep(1);
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLocation("/");
        return;
      }
      const { data } = await supabase
        .from("health_screenings")
        .select("screening_result, block_reason")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.screening_result === "blocked") {
        setBlockReason(data.block_reason ?? null);
        setShowBlockedView(true);
      } else if (data?.screening_result === "passed" || data?.screening_result === "allergies_only") {
        setCurrentStep(1);
      }
      setScreeningCheckLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Health screening helpers ─────────────────────────────────────────────
  function toggleCondition(key: HealthConditionKey) {
    setConditions(prev => ({ ...prev, [key]: !prev[key] }));
    // Marking any condition clears the "none of the above" choice.
    setDeclaredNoConditions(false);
    setScreeningError(null);
  }

  function toggleNoConditions() {
    const next = !declaredNoConditions;
    setDeclaredNoConditions(next);
    if (next) {
      // Clear all conditions when user chooses "none of the above".
      setConditions({
        pregnancy_lactation: false,
        eating_disorder: false,
        diabetes: false,
        cardiovascular: false,
        kidney_liver: false,
        on_medication: false,
        physical_limitations: false,
        minor_age: false,
        severe_allergies: false,
      });
    }
    setScreeningError(null);
  }

  const anyConditionMarked = Object.values(conditions).some(Boolean);
  const screeningContinueDisabled = !anyConditionMarked && !declaredNoConditions;

  function buildScreeningPayload(allergiesAck: boolean) {
    return {
      pregnancy_lactation:    conditions.pregnancy_lactation,
      eating_disorder:        conditions.eating_disorder,
      diabetes:               conditions.diabetes,
      cardiovascular:         conditions.cardiovascular,
      kidney_liver:           conditions.kidney_liver,
      on_medication:          conditions.on_medication,
      physical_limitations:   conditions.physical_limitations,
      minor_age:              conditions.minor_age,
      severe_allergies:       conditions.severe_allergies,
      declared_no_conditions: declaredNoConditions,
      allergies_acknowledged: allergiesAck,
    };
  }

  async function callValidateScreening(allergiesAck: boolean) {
    setScreeningSubmitting(true);
    setScreeningError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "validate-health-screening",
        { body: buildScreeningPayload(allergiesAck) },
      );
      if (invokeErr || !data) {
        throw new Error(invokeErr?.message ?? "No response");
      }
      const result = (data as { result?: string }).result;
      const reason = (data as { block_reason?: string | null }).block_reason ?? null;
      if (result === "blocked") {
        setBlockReason(reason);
        setShowAllergiesWarning(false);
        setShowBlockedView(true);
      } else if (result === "passed" || result === "allergies_only") {
        setShowAllergiesWarning(false);
        setCurrentStep(1);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setScreeningError(
        lang === "en"
          ? `Couldn't validate your answers. Please try again. (${msg})`
          : `No pudimos validar tus respuestas. Inténtalo de nuevo. (${msg})`,
      );
    } finally {
      setScreeningSubmitting(false);
    }
  }

  // Step 0 main action.
  // - If any blocking condition is marked → call EF immediately (will return blocked).
  // - Else if only severe_allergies → show AllergiesWarningView locally (no EF call yet).
  // - Else (declared_no_conditions only) → call EF (will return passed).
  async function handleScreeningContinue() {
    if (screeningContinueDisabled || screeningSubmitting) return;
    const hasBlocking = BLOCKING_CONDITIONS.some(k => conditions[k]);
    const onlyAllergies = !hasBlocking && conditions.severe_allergies;
    if (onlyAllergies) {
      setShowAllergiesWarning(true);
      return;
    }
    await callValidateScreening(false);
  }

  function resetAllergiesWarningToQuestionnaire() {
    setShowAllergiesWarning(false);
    setAllergiesAcknowledged(false);
    setScreeningError(null);
  }

  async function handleAllergiesAcknowledge() {
    setAllergiesAcknowledged(true);
    await callValidateScreening(true);
  }

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
        variantIndex: selectedVariants[id] ?? 0,
        notificationTime: supplementTimes[id] ?? `${String(SUPPLEMENT_TIMING[id]?.options[timingIndex]?.notificationHour ?? 8).padStart(2, "0")}:00`,
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

  // ── IMC core values — must live before any early return so hook count is stable ──
  const imcVal          = calcIMC(formData.weightKg, formData.heightCm);
  const imcCategory     = imcToCategory(imcVal);           // canonical DB key from service
  const isOldAge        = formData.age >= 65;
  const goalKey         = formData.goalType as GoalKey;
  const tone            = TONE_LOOKUP[imcCategory]?.[goalKey] ?? ("info" as ToneValue);
  const imcTriggerReason = `${imcCategory}_${goalKey}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentStep !== 2) return;
    const snapshot = buildUserDataSnapshot({
      weightKg:       formData.weightKg,
      heightCm:       formData.heightCm,
      age:            formData.age,
      sex:            formData.sex,
      goalType:       goalKey,
      targetWeightKg: formData.targetWeightKg ?? null,
      trainingLevel:  formData.trainingLevel ?? null,
    });
    if (isOldAge) logWarningShown(`age_over_65_${goalKey}`, snapshot);
    if (tone === "block") {
      const blockReason: BlockReason =
        imcCategory === "underweight"                        ? "auto_blocked_low_imc"
        : imcCategory === "obesity_2" || imcCategory === "obesity_3" ? "auto_blocked_high_imc"
        : "auto_blocked_unsafe_goal";
      logBlocked(imcTriggerReason, snapshot, blockReason);
    } else if (tone === "warn" || tone === "caution") {
      logWarningShown(imcTriggerReason, snapshot);
    } else {
      logInfoShown(imcTriggerReason, snapshot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, tone, formData.goalType, isOldAge]);

  const isES = lang !== "en";

  // ── Loading state ─────────────────────────────────────────────────────────
  if (prefilling || screeningCheckLoading) {
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

  // ── Health screening blocked / allergies warning ─────────────────────────
  if (showBlockedView) {
    return <HealthBlockedView blockReason={blockReason} isES={isES} onLogout={async () => { await supabase.auth.signOut(); setLocation("/"); }} />;
  }
  if (showAllergiesWarning) {
    return (
      <AllergiesWarningView
        isES={isES}
        submitting={screeningSubmitting}
        error={screeningError}
        onBack={resetAllergiesWarningToQuestionnaire}
        onAcknowledge={handleAllergiesAcknowledge}
      />
    );
  }

  const SUPPLEMENT_VARIANTS: Record<string, Array<{ name: string; info: string }>> = {
    proteina_polvo: [
      { name: isES ? "Whey concentrada" : "Concentrated whey", info: isES ? "Económica. Contiene lactosa." : "Budget-friendly. Contains lactose." },
      { name: isES ? "Whey isolada" : "Whey isolate", info: isES ? "Sin lactosa. >90% proteína." : "Lactose-free. >90% protein." },
      { name: isES ? "Proteína vegana" : "Vegan protein", info: isES ? "Guisante/arroz. Plant-based." : "Pea/rice. Plant-based." },
      { name: isES ? "Caseína" : "Casein", info: isES ? "Digestión lenta. Ideal antes de dormir." : "Slow digestion. Ideal before bed." },
    ],
    creatina: [
      { name: isES ? "Monohidrato" : "Monohydrate", info: isES ? "La más estudiada y eficaz." : "Most studied and effective." },
      { name: isES ? "HCl (clorhidrato)" : "HCl (hydrochloride)", info: isES ? "Mayor solubilidad, dosis menor." : "Higher solubility, smaller dose." },
      { name: "Kre-Alkalyn", info: isES ? "Sin fase de carga obligatoria." : "No loading phase required." },
      { name: isES ? "Etil éster" : "Ethyl ester", info: isES ? "Absorción más rápida." : "Faster absorption." },
    ],
    colageno: [
      { name: isES ? "Marino (tipo I)" : "Marine (type I)", info: isES ? "Mayor biodisponibilidad. Piel y tendones." : "Higher bioavailability. Skin and tendons." },
      { name: isES ? "Bovino (tipo I/III)" : "Bovine (type I/III)", info: isES ? "Económico. Piel y articulaciones." : "Budget-friendly. Skin and joints." },
      { name: isES ? "Tipo II" : "Type II", info: isES ? "Específico para cartílago." : "Specific for cartilage." },
      { name: isES ? "Péptidos hidrolizados" : "Hydrolyzed peptides", info: isES ? "Fácil absorción en líquidos." : "Easy absorption in liquids." },
    ],
    magnesio: [
      { name: "Bisglicinato", info: isES ? "Máxima absorción y tolerancia digestiva." : "Maximum absorption and digestive tolerance." },
      { name: "Citrato", info: isES ? "Buena biodisponibilidad." : "Good bioavailability." },
      { name: "Malato", info: isES ? "Ideal para energía y fatiga." : "Ideal for energy and fatigue." },
      { name: "L-treonato", info: isES ? "Mejora sueño y memoria." : "Improves sleep and memory." },
    ],
    omega_3: [
      { name: isES ? "Aceite de pescado" : "Fish oil", info: isES ? "Buena relación EPA/DHA." : "Good EPA/DHA ratio." },
      { name: isES ? "Aceite de krill" : "Krill oil", info: isES ? "En fosfolípidos, mejor absorción." : "In phospholipids, better absorption." },
      { name: isES ? "Algas (vegano)" : "Algae (vegan)", info: isES ? "Fuente directa de DHA." : "Direct DHA source." },
      { name: isES ? "EPA/DHA concentrado" : "Concentrated EPA/DHA", info: isES ? "Alta dosis en cápsulas pequeñas." : "High dose in small capsules." },
    ],
    vitamina_d: [
      { name: isES ? "Vitamina D3" : "Vitamin D3", info: isES ? "Forma más activa y biodisponible." : "Most active and bioavailable form." },
      { name: "D3 + K2", info: isES ? "K2 dirige el calcio a los huesos." : "K2 directs calcium to bones." },
      { name: isES ? "D2 (vegano)" : "D2 (vegan)", info: isES ? "Origen vegetal. Menos potente." : "Plant-based. Less potent." },
    ],
    zinc: [
      { name: "Picolinato", info: isES ? "La forma mejor absorbida." : "Best absorbed form." },
      { name: "Citrato", info: isES ? "Buena tolerancia digestiva." : "Good digestive tolerance." },
      { name: "Gluconato", info: isES ? "Económico, menor biodisponibilidad." : "Budget-friendly, lower bioavailability." },
      { name: "ZMA (Zinc+Mg+B6)", info: isES ? "Popular para recuperación nocturna." : "Popular for nighttime recovery." },
    ],
    hierro: [
      { name: "Bisglicinato", info: isES ? "El más suave para el estómago." : "Easiest on the stomach." },
      { name: isES ? "Sulfato ferroso" : "Ferrous sulfate", info: isES ? "Económico, puede irritar." : "Budget-friendly, may cause irritation." },
      { name: isES ? "Hierro hemo" : "Heme iron", info: isES ? "Mayor biodisponibilidad natural." : "Higher natural bioavailability." },
    ],
    vitamina_c: [
      { name: isES ? "Ácido ascórbico" : "Ascorbic acid", info: isES ? "Forma básica y económica." : "Basic and budget-friendly form." },
      { name: isES ? "Ascorbato sódico" : "Sodium ascorbate", info: isES ? "Sin acidez, para estómagos sensibles." : "No acidity, for sensitive stomachs." },
      { name: "Liposomal", info: isES ? "Mayor biodisponibilidad celular." : "Higher cellular bioavailability." },
    ],
    vitamina_b: [
      { name: isES ? "Complejo B completo" : "Full B complex", info: isES ? "Cubre todas las vitaminas B." : "Covers all B vitamins." },
      { name: isES ? "Solo B12" : "B12 only", info: isES ? "Esencial para veganos." : "Essential for vegans." },
      { name: "B6+B12+ácido fólico", info: isES ? "Trío clave para energía." : "Key trio for energy." },
    ],
    calcio: [
      { name: isES ? "Carbonato de calcio" : "Calcium carbonate", info: isES ? "Económico. Tomar con comida." : "Budget-friendly. Take with food." },
      { name: isES ? "Citrato de calcio" : "Calcium citrate", info: isES ? "Se absorbe en ayunas." : "Absorbs on empty stomach." },
      { name: "Calcio + D3 + K2", info: isES ? "Sinergia ideal para huesos." : "Ideal synergy for bones." },
    ],
    vitamina_a: [
      { name: "Retinol", info: isES ? "Forma preformada, absorción directa." : "Preformed form, direct absorption." },
      { name: "Beta-caroteno", info: isES ? "El cuerpo la convierte según necesite." : "Body converts as needed." },
    ],
    vitamina_e: [
      { name: isES ? "Tocoferol mixto" : "Mixed tocopherols", info: isES ? "La forma más completa y natural." : "Most complete and natural form." },
      { name: "Alfa-tocoferol", info: isES ? "La más estudiada. Forma estándar." : "Most studied. Standard form." },
    ],
    cafeina: [
      { name: "L-teanina + cafeína", info: isES ? "Alerta sin ansiedad ni crash." : "Alert without anxiety or crash." },
      { name: isES ? "Cafeína anhidra" : "Anhydrous caffeine", info: isES ? "Pura y potente. Dosis exacta." : "Pure and potent. Exact dose." },
      { name: isES ? "Té verde natural" : "Natural green tea", info: isES ? "Liberación gradual, menor crash." : "Gradual release, less crash." },
      { name: isES ? "Pre-entreno completo" : "Full pre-workout", info: isES ? "Cafeína + beta-alanina + citrulina." : "Caffeine + beta-alanine + citrulline." },
    ],
  };

  const FASTING_ALLOWED: Record<string, { icon: string; textES: string; textEN: string }[]> = {
    "12:12": [
      { icon: "💧", textES: "Agua — sin límite", textEN: "Water — unlimited" },
      { icon: "☕", textES: "Café negro y té sin azúcar", textEN: "Black coffee and unsweetened tea" },
      { icon: "🫗", textES: "Infusiones sin azúcar ni leche", textEN: "Herbal teas without sugar or milk" },
      { icon: "🧂", textES: "Agua con electrolitos (sin calorías)", textEN: "Electrolyte water (zero calories)" },
    ],
    "16:8": [
      { icon: "💧", textES: "Agua — sin límite", textEN: "Water — unlimited" },
      { icon: "☕", textES: "Café negro y té sin azúcar", textEN: "Black coffee and unsweetened tea" },
      { icon: "🫗", textES: "Infusiones sin azúcar ni leche", textEN: "Herbal teas without sugar or milk" },
      { icon: "🧂", textES: "Electrolitos sin calorías (sodio, potasio, magnesio)", textEN: "Zero-calorie electrolytes (sodium, potassium, magnesium)" },
      { icon: "💊", textES: "Suplementos sin calorías (vitaminas, minerales)", textEN: "Zero-calorie supplements (vitamins, minerals)" },
    ],
    "18:6": [
      { icon: "💧", textES: "Agua — sin límite", textEN: "Water — unlimited" },
      { icon: "☕", textES: "Café negro solo — sin leche ni azúcar", textEN: "Black coffee only — no milk or sugar" },
      { icon: "🫗", textES: "Té verde o negro sin endulzar", textEN: "Unsweetened green or black tea" },
      { icon: "🧂", textES: "Electrolitos puros sin calorías", textEN: "Pure zero-calorie electrolytes" },
      { icon: "💊", textES: "Suplementos sin calorías (no proteína, no colágeno)", textEN: "Zero-calorie supplements (no protein, no collagen)" },
    ],
    "20:4": [
      { icon: "💧", textES: "Agua — sin límite", textEN: "Water — unlimited" },
      { icon: "☕", textES: "Café negro estricto — sin nada añadido", textEN: "Strict black coffee — nothing added" },
      { icon: "🫗", textES: "Té sin endulzar", textEN: "Unsweetened tea" },
      { icon: "🧂", textES: "Electrolitos puros — imprescindibles en ayunos largos", textEN: "Pure electrolytes — essential for long fasts" },
    ],
    "5:2": [
      { icon: "💧", textES: "Agua — sin límite", textEN: "Water — unlimited" },
      { icon: "🥗", textES: "Verduras sin almidón (lechuga, pepino, brócoli)", textEN: "Non-starchy vegetables (lettuce, cucumber, broccoli)" },
      { icon: "🍳", textES: "Proteína magra (pollo, huevo, pescado)", textEN: "Lean protein (chicken, egg, fish)" },
      { icon: "☕", textES: "Café negro y té sin azúcar", textEN: "Black coffee and unsweetened tea" },
      { icon: "🍜", textES: "Caldo de huesos — ayuda a llegar a la cuota calórica", textEN: "Bone broth — helps reach the calorie quota" },
    ],
  };

  const FASTING_DIET_NOTES: Record<string, Record<string, { es: string; en: string }>> = {
    "12:12": {
      balanced:      { es: "🍽️ Dieta equilibrada: en tu ventana de 12h incluiremos proteínas, carbohidratos complejos y grasas saludables distribuidas en 3 comidas.", en: "🍽️ Balanced diet: in your 12h window we'll include proteins, complex carbs and healthy fats across 3 meals." },
      vegan:         { es: "🌱 Dieta vegana: 12h es suficiente para 3 comidas con legumbres, tofu y cereales integrales cubriendo todos los aminoácidos.", en: "🌱 Vegan diet: 12h is enough for 3 meals with legumes, tofu and whole grains covering all amino acids." },
      keto:          { es: "🥑 Dieta keto: las 12h de ayuno mantienen la cetosis. Prioridad a grasas saludables y proteína moderada.", en: "🥑 Keto diet: the 12h fast maintains ketosis. Priority on healthy fats and moderate protein." },
      mediterranean: { es: "🫒 Dieta mediterránea: ventana de 12h ideal para 3 comidas con AOVE, legumbres, pescado azul y frutas frescas.", en: "🫒 Mediterranean diet: 12h window ideal for 3 meals with EVOO, legumes, oily fish and fresh fruit." },
      high_protein:  { es: "💪 Alta proteína: distribuimos 3 comidas ricas en proteína en las 12h para maximizar la síntesis muscular.", en: "💪 High protein: we distribute 3 protein-rich meals across 12h to maximize muscle synthesis." },
      vegetarian:    { es: "🥦 Dieta vegetariana: 3 comidas con huevo, lácteos y legumbres para cubrir proteína completa en 12h.", en: "🥦 Vegetarian diet: 3 meals with eggs, dairy and legumes to cover complete protein in 12h." },
    },
    "16:8": {
      balanced:      { es: "🍽️ Dieta equilibrada: distribuiremos comida y cena en las 8h de ventana. Proteína en cada toma para mantener el músculo.", en: "🍽️ Balanced diet: we'll distribute lunch and dinner in the 8h window. Protein at each meal to preserve muscle." },
      vegan:         { es: "🌱 Dieta vegana: atención especial a proteína completa. Combinaremos fuentes vegetales para cubrir tus necesidades en 2 comidas.", en: "🌱 Vegan diet: special attention to complete protein. We'll combine plant sources to meet your needs across 2 meals." },
      keto:          { es: "🥑 Keto + 16:8 es la combinación más potente para cetosis. Tu cuerpo quemará grasa durante las 16h de ayuno.", en: "🥑 Keto + 16:8 is the most powerful combination for ketosis. Your body will burn fat during the 16h fast." },
      mediterranean: { es: "🫒 Mediterránea + 16:8: comida principal al mediodía rica en legumbres y pescado. Cena ligera con verduras y AOVE.", en: "🫒 Mediterranean + 16:8: main meal at midday rich in legumes and fish. Light dinner with vegetables and EVOO." },
      high_protein:  { es: "💪 Alta proteína + 16:8: 2 comidas con 40-50g proteína cada una. Añade batido si no llegas al objetivo.", en: "💪 High protein + 16:8: 2 meals with 40-50g protein each. Add a shake if you fall short of your goal." },
      vegetarian:    { es: "🥦 Vegetariana + 16:8: 2 comidas con huevo, queso y legumbres para asegurar proteína en la ventana de 8h.", en: "🥦 Vegetarian + 16:8: 2 meals with eggs, cheese and legumes to ensure protein in the 8h window." },
    },
    "18:6": {
      balanced:      { es: "🍽️ Con solo 6h priorizamos proteína y grasas saludables. Reducimos carbohidratos para mantener saciedad más tiempo.", en: "🍽️ With only 6h we prioritize protein and healthy fats. We reduce carbs to maintain satiety longer." },
      vegan:         { es: "🌱 Vegana + 18:6 requiere planificación. Priorizamos legumbres, semillas y frutos secos para proteína y grasas en 2 comidas.", en: "🌱 Vegan + 18:6 requires planning. We prioritize legumes, seeds and nuts for protein and fats across 2 meals." },
      keto:          { es: "🥑 Keto + 18:6: potencia la cetosis. Durante el ayuno puedes tomar café con MCT oil si mantienes cetosis.", en: "🥑 Keto + 18:6: boosts ketosis. During the fast you can have coffee with MCT oil if you maintain ketosis." },
      mediterranean: { es: "🫒 Mediterránea + 18:6: dos comidas principales. Abundante en AOVE, frutos secos y proteína de calidad.", en: "🫒 Mediterranean + 18:6: two main meals. Abundant in EVOO, nuts and quality protein." },
      high_protein:  { es: "💪 Alta proteína + 18:6: concentramos 2 comidas muy proteicas. Prioritario llegar al objetivo de proteína en 6h.", en: "💪 High protein + 18:6: we concentrate 2 very protein-rich meals. Priority is reaching your protein goal in 6h." },
      vegetarian:    { es: "🥦 Vegetariana + 18:6: 2 comidas densas en nutrientes con huevo, legumbres y lácteos proteicos.", en: "🥦 Vegetarian + 18:6: 2 nutrient-dense meals with eggs, legumes and protein dairy." },
    },
    "20:4": {
      balanced:      { es: "🍽️ En 4h concentramos proteína alta y grasas saludables. Carbohidratos solo post-entreno si haces ejercicio.", en: "🍽️ In 4h we concentrate high protein and healthy fats. Carbs only post-workout if you exercise." },
      vegan:         { es: "🌱 Vegana + 20:4: protocolo exigente. Aseguraremos proteína suficiente en 4h con tofu, seitán y legumbres.", en: "🌱 Vegan + 20:4: demanding protocol. We'll ensure enough protein in 4h with tofu, seitan and legumes." },
      keto:          { es: "🥑 Keto + 20:4: máxima cetosis. Concentra grasas y proteínas moderadas en 4h. Carbohidratos netos < 20g al día.", en: "🥑 Keto + 20:4: maximum ketosis. Concentrate fats and moderate protein in 4h. Net carbs < 20g daily." },
      mediterranean: { es: "🫒 Mediterránea + 20:4: una comida principal abundante + snack. Rica en AOVE, pescado azul y vegetales.", en: "🫒 Mediterranean + 20:4: one main abundant meal + snack. Rich in EVOO, oily fish and vegetables." },
      high_protein:  { es: "💪 Alta proteína + 20:4: una comida muy densa (60-80g proteína) + batido proteico. Vigilar recuperación muscular.", en: "💪 High protein + 20:4: one very dense meal (60-80g protein) + protein shake. Monitor muscle recovery." },
      vegetarian:    { es: "🥦 Vegetariana + 20:4: comida principal con huevo, queso, legumbres y frutos secos para densidad nutricional máxima.", en: "🥦 Vegetarian + 20:4: main meal with eggs, cheese, legumes and nuts for maximum nutritional density." },
    },
    "5:2": {
      balanced:      { es: "🍽️ Los 5 días normales sin cambios. Los 2 días de restricción: 1-2 comidas pequeñas ricas en proteína magra.", en: "🍽️ The 5 normal days unchanged. The 2 restriction days: 1-2 small meals rich in lean protein." },
      vegan:         { es: "🌱 Los días de restricción: sopa de legumbres y verduras proteicas para llegar a 500 kcal con proteína suficiente.", en: "🌱 Restriction days: legume and vegetable soup to reach 500 kcal with enough protein." },
      keto:          { es: "🥑 Los días de restricción: mantén < 500 kcal con grasas (aguacate, frutos secos) y proteína. Cero carbohidratos.", en: "🥑 Restriction days: keep < 500 kcal with fats (avocado, nuts) and protein. Zero carbs." },
      mediterranean: { es: "🫒 Los días de restricción: sopa mediterránea de verduras, ensalada con AOVE y proteína magra (500-600 kcal).", en: "🫒 Restriction days: Mediterranean vegetable soup, salad with EVOO and lean protein (500-600 kcal)." },
      high_protein:  { es: "💪 Los días de restricción: prioridad absoluta a proteína magra. 2 comidas pequeñas con pollo, huevo o pescado.", en: "💪 Restriction days: absolute priority on lean protein. 2 small meals with chicken, egg or fish." },
      vegetarian:    { es: "🥦 Los días de restricción: huevo cocido, yogur proteico y caldo de verduras para llegar a 500 kcal.", en: "🥦 Restriction days: boiled egg, protein yogurt and vegetable broth to reach 500 kcal." },
    },
  };

  const paceOptions = [
    { key: "gentle",     labelES: "🐢 Suave",    labelEN: "🐢 Gentle",    badgeES: "−0.25 kg/sem · déficit 250 kcal",  badgeEN: "−0.25 kg/week · 250 kcal deficit" },
    { key: "moderate",   labelES: "🚶 Moderado",  labelEN: "🚶 Moderate",  badgeES: "−0.5 kg/sem · déficit 500 kcal",   badgeEN: "−0.5 kg/week · 500 kcal deficit",  recommended: true },
    { key: "aggressive", labelES: "🏃 Agresivo",  labelEN: "🏃 Aggressive", badgeES: "−1 kg/sem · déficit 1000 kcal",  badgeEN: "−1 kg/week · 1000 kcal deficit" },
  ];

  // ── IMC display values (imcVal / imcCategory / tone / goalKey already computed above) ──
  const wMin = calcWeightMin(formData.heightCm);
  const wMax = calcWeightMax(formData.heightCm);

  const HEALTH_MATRIX: Record<ImcCategory, Record<GoalKey, MatrixEntry>> = {
    underweight: {
      lose_fat:      { tone: "block",   msgES: `Tu IMC (${imcVal.toFixed(1)}) indica bajo peso. Perder más peso puede ser perjudicial para tu salud. Tu peso mínimo saludable es ${wMin} kg.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates underweight. Losing more weight may harm your health. Your minimum healthy weight is ${wMin} kg.` },
      gain_muscle:   { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica bajo peso. Ganar músculo te ayudará a alcanzar un peso saludable. Ideal para ti.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates underweight. Building muscle will help you reach a healthy weight. This is ideal for you.` },
      maintain:      { tone: "caution", msgES: `Tu IMC (${imcVal.toFixed(1)}) indica bajo peso. Mantener tu peso actual no es lo más saludable. Considera un objetivo de ganancia muscular.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates underweight. Maintaining your current weight is not optimal. Consider a muscle-gain goal.`, check1ES: "Entiendo que mi peso actual está por debajo del rango saludable", check1EN: "I understand my current weight is below the healthy range", check2ES: "Quiero continuar con este objetivo de forma orientativa", check2EN: "I want to continue with this goal on an informational basis" },
      recomposition: { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica bajo peso. La recomposición puede ayudarte a ganar músculo y mejorar tu composición corporal.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates underweight. Recomposition can help you build muscle and improve body composition.` },
    },
    normal: {
      lose_fat:      { tone: "caution", msgES: `Tu IMC (${imcVal.toFixed(1)}) está en rango saludable (${wMin}–${wMax} kg). Si quieres perder peso, asegúrate de que tu objetivo sea razonable.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) is in the healthy range (${wMin}–${wMax} kg). If you want to lose weight, make sure your goal is reasonable.`, check1ES: "Entiendo que mi IMC ya está en rango normal", check1EN: "I understand my BMI is already in the normal range", check2ES: "Quiero continuar con el objetivo de pérdida de peso de forma orientativa", check2EN: "I want to continue with the weight-loss goal on an informational basis" },
      gain_muscle:   { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) es saludable. Ganar músculo mejorará tu composición corporal sin afectar negativamente tu peso.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) is healthy. Building muscle will improve your body composition without negatively affecting your weight.` },
      maintain:      { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) es saludable. Mantener tu peso es la elección ideal para ti ahora mismo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) is healthy. Maintaining your weight is the ideal choice for you right now.` },
      recomposition: { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) es saludable. La recomposición es una excelente opción para mejorar tu composición corporal.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) is healthy. Recomposition is an excellent option to improve your body composition.` },
    },
    overweight: {
      lose_fat:      { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica sobrepeso. Perder peso es un objetivo saludable para ti.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates overweight. Losing weight is a healthy goal for you.` },
      gain_muscle:   { tone: "caution", msgES: `Tu IMC (${imcVal.toFixed(1)}) indica sobrepeso. Ganar músculo es posible, pero considera también reducir grasa corporal.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates overweight. Building muscle is possible, but also consider reducing body fat.`, check1ES: "Entiendo que ganar músculo puede aumentar mi peso temporalmente", check1EN: "I understand that building muscle may temporarily increase my weight", check2ES: "Quiero priorizar el músculo sobre la pérdida de grasa ahora mismo", check2EN: "I want to prioritise muscle over fat loss right now" },
      maintain:      { tone: "caution", msgES: `Tu IMC (${imcVal.toFixed(1)}) indica sobrepeso. Mantener tu peso actual puede no ser lo más beneficioso para tu salud a largo plazo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates overweight. Maintaining your current weight may not be most beneficial long-term.`, check1ES: "Entiendo que mi IMC está por encima del rango saludable", check1EN: "I understand my BMI is above the healthy range", check2ES: "Quiero mantener mi peso actual de forma orientativa", check2EN: "I want to maintain my current weight on an informational basis" },
      recomposition: { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica sobrepeso. La recomposición (perder grasa y ganar músculo) es ideal para ti.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates overweight. Recomposition (losing fat and gaining muscle) is ideal for you.` },
    },
    obesity_1: {
      lose_fat:      { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado I. Perder peso es muy beneficioso para tu salud.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade I obesity. Losing weight is very beneficial for your health.` },
      gain_muscle:   { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado I. Te recomendamos combinar ganancia muscular con pérdida de grasa. Este plan es orientativo — consulta con un profesional sanitario.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade I obesity. We recommend combining muscle gain with fat loss. This plan is informational — consult a healthcare professional.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye consejo médico", check2EN: "I understand this plan is informational and does not replace medical advice" },
      maintain:      { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado I. Mantener tu peso actual puede aumentar riesgos de salud. Este plan es orientativo — consulta con un profesional sanitario.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade I obesity. Maintaining your current weight may increase health risks. This plan is informational — consult a healthcare professional.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye consejo médico", check2EN: "I understand this plan is informational and does not replace medical advice" },
      recomposition: { tone: "info",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado I. La recomposición corporal es un buen primer objetivo para ti.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade I obesity. Body recomposition is a good first goal for you.` },
    },
    obesity_2: {
      lose_fat:      { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado II. Perder peso es importante — te recomendamos hacerlo con supervisión médica. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade II obesity. Losing weight is important — we strongly recommend doing so with medical supervision. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica", check2EN: "I understand this plan is informational and does not replace medical supervision" },
      gain_muscle:   { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado II. Recomendamos priorizar primero la pérdida de grasa bajo supervisión médica. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade II obesity. We recommend prioritising fat loss first under medical supervision. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica", check2EN: "I understand this plan is informational and does not replace medical supervision" },
      maintain:      { tone: "block",   msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado II. Mantener el peso actual puede suponer riesgos serios. Por tu seguridad, no podemos generar un plan de mantenimiento. Consulta con un médico.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade II obesity. Maintaining your current weight may pose serious health risks. For your safety, we cannot generate a maintenance plan. Please consult a doctor.` },
      recomposition: { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado II. La recomposición puede ser beneficiosa, pero te recomendamos supervisión médica. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade II obesity. Recomposition can be beneficial, but we recommend medical supervision. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica", check2EN: "I understand this plan is informational and does not replace medical supervision" },
    },
    obesity_3: {
      lose_fat:      { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado III (mórbida). Perder peso es prioritario para tu salud — te recomendamos supervisión médica estricta. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade III (morbid) obesity. Losing weight is a health priority — we strongly recommend strict medical supervision. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica especializada", check2EN: "I understand this plan is informational and does not replace specialist medical supervision" },
      gain_muscle:   { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado III. Recomendamos priorizar la pérdida de grasa con supervisión médica antes de enfocarse en ganancia muscular. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade III obesity. We recommend prioritising fat loss under medical supervision before focusing on muscle gain. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica especializada", check2EN: "I understand this plan is informational and does not replace specialist medical supervision" },
      maintain:      { tone: "block",   msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado III (mórbida). Mantener el peso actual supone riesgos graves para tu salud. Por tu seguridad, no podemos generar un plan de mantenimiento. Consulta urgentemente con un médico.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade III (morbid) obesity. Maintaining your current weight poses serious health risks. For your safety, we cannot generate a maintenance plan. Please consult a doctor urgently.` },
      recomposition: { tone: "warn",    msgES: `Tu IMC (${imcVal.toFixed(1)}) indica obesidad grado III. La recomposición puede ser un punto de partida, pero requiere supervisión médica. Este plan es orientativo.`, msgEN: `Your BMI (${imcVal.toFixed(1)}) indicates grade III obesity. Recomposition can be a starting point, but requires medical supervision. This plan is informational.`, check1ES: "He leído la recomendación y quiero continuar con este objetivo", check1EN: "I have read the recommendation and want to continue with this goal", check2ES: "Entiendo que este plan es orientativo y no sustituye supervisión médica especializada", check2EN: "I understand this plan is informational and does not replace specialist medical supervision" },
    },
  };

  const matrixEntry: MatrixEntry | null = HEALTH_MATRIX[imcCategory]?.[goalKey] ?? null;
  const msgText = matrixEntry ? (isES ? matrixEntry.msgES : matrixEntry.msgEN) : null;

  const imcCategoryLabel = isES
    ? imcCategory === "underweight" ? "Bajo peso"    : imcCategory === "normal"    ? "Peso normal"  : imcCategory === "overweight" ? "Sobrepeso"
    : imcCategory === "obesity_1"   ? "Obesidad I"   : imcCategory === "obesity_2" ? "Obesidad II"  : "Obesidad III"
    : imcCategory === "underweight" ? "Underweight"  : imcCategory === "normal"    ? "Normal weight": imcCategory === "overweight" ? "Overweight"
    : imcCategory === "obesity_1"   ? "Obesity I"    : imcCategory === "obesity_2" ? "Obesity II"   : "Obesity III";

  const boxBg    = tone === "block"   ? "rgba(255,68,68,0.07)"   : tone === "warn"    ? "rgba(255,170,0,0.07)"  : tone === "caution" ? "rgba(59,130,246,0.07)"  : "rgba(136,238,34,0.05)";
  const boxBorder= tone === "block"   ? "rgba(255,68,68,0.25)"   : tone === "warn"    ? "rgba(255,170,0,0.25)"  : tone === "caution" ? "rgba(59,130,246,0.25)"   : "rgba(136,238,34,0.15)";
  const boxColor = tone === "block"   ? "#ff4444"                : tone === "warn"    ? "#ffaa00"               : tone === "caution" ? "#60a5fa"                  : "#88ee22";

  const step2Blocked = currentStep === 2 && (
    (tone === "block") ||
    (tone === "warn"    && (!healthCheckbox1 || !healthCheckbox2)) ||
    (tone === "caution" && matrixEntry?.check1ES && (!healthCheckbox1 || !healthCheckbox2)) ||
    (isOldAge && (!ageCheckbox1 || !ageCheckbox2))
  );

  async function handleNextStep() {
    if (currentStep < STEPS.length - 1) {
      // Log acceptance when user ticks both checkboxes and presses Continue
      if (currentStep === 2 && (tone === "caution" || tone === "warn") && healthCheckbox1 && healthCheckbox2) {
        const snapshot = buildUserDataSnapshot({ weightKg: formData.weightKg, heightCm: formData.heightCm, age: formData.age, sex: formData.sex, goalType: goalKey, targetWeightKg: formData.targetWeightKg ?? null, trainingLevel: formData.trainingLevel ?? null });
        await logWarningAccepted(imcTriggerReason, snapshot);
      }
      // Also log age acceptance if age >65 checkboxes were ticked
      if (currentStep === 2 && isOldAge && ageCheckbox1 && ageCheckbox2) {
        const snapshot = buildUserDataSnapshot({ weightKg: formData.weightKg, heightCm: formData.heightCm, age: formData.age, sex: formData.sex, goalType: goalKey, targetWeightKg: formData.targetWeightKg ?? null, trainingLevel: formData.trainingLevel ?? null });
        await logWarningAccepted(`age_over_65_${goalKey}`, snapshot);
      }
      setCurrentStep(s => s + 1);
    } else {
      handleSubmit();
    }
  }

  return (
    <div className="font-sans" style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>

      {/* ── Sticky progress bar ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#555" }}>
              {isES ? `Paso ${currentStep + 1} de ${STEPS.length}` : `Step ${currentStep + 1} of ${STEPS.length}`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {isES ? STEP_NAMES_ES[currentStep] : STEP_NAMES_EN[currentStep]}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < currentStep ? "#88ee22" : i === currentStep ? "rgba(136,238,34,0.4)" : "#1f1f1f", transition: "background 0.3s" }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "24px 20px 0" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          {/* Edit mode banner */}
          {isEditMode && (
            <div className="mb-4 flex items-center gap-2.5 bg-[#AAFF45]/5 border border-[#AAFF45]/15 rounded-lg px-4 py-3">
              <Pencil className="w-4 h-4 text-[#AAFF45] shrink-0" />
              <p className="text-sm text-[#AAFF45]/80 font-medium">
                {t("updating_both_plans")}
              </p>
            </div>
          )}

        <div className="space-y-3 pb-4">

          {/* ── Step 0: Cuestionario médico de exclusión ────────────────── */}
          {currentStep === 0 && (
            <>
              {/* Emphasis banner — same palette as the >65 warning for visual coherence */}
              <div style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#ffaa00", marginTop: 2 }} />
                <p style={{ fontSize: 12, color: "#ffaa00", lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
                  {isES
                    ? "Cuestionario médico obligatorio — necesitamos confirmar que GoalIQ es seguro para ti."
                    : "Mandatory health questionnaire — we need to confirm GoalIQ is safe for you."}
                </p>
              </div>

              <SectionCard emoji="🩺" title={isES ? "Cuestionario médico" : "Health questionnaire"}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e8e8e8", margin: 0, marginBottom: 6 }}>
                    {isES ? "Antes de configurar tu plan" : "Before setting up your plan"}
                  </h2>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5, margin: 0 }}>
                    {isES
                      ? "Marca las opciones que apliquen a tu situación de salud actual:"
                      : "Check the options that apply to your current health situation:"}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(Object.keys(CONDITION_LABELS) as HealthConditionKey[]).map(key => {
                    const checked = conditions[key];
                    return (
                      <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: checked ? "rgba(255,170,0,0.06)" : "#111", border: `1px solid ${checked ? "rgba(255,170,0,0.3)" : "#1f1f1f"}`, transition: "all 0.15s" }}>
                        <div
                          onClick={() => toggleCondition(key)}
                          style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#ffaa00" : "#333"}`, background: checked ? "#ffaa00" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                        >
                          {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5 }} onClick={() => toggleCondition(key)}>
                          {isES ? CONDITION_LABELS[key].es : CONDITION_LABELS[key].en}
                        </span>
                      </label>
                    );
                  })}

                  {/* "None of the above" — mutually exclusive with everything else */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: declaredNoConditions ? "rgba(136,238,34,0.07)" : "#111", border: `1px solid ${declaredNoConditions ? "rgba(136,238,34,0.3)" : "#1f1f1f"}`, transition: "all 0.15s", marginTop: 4 }}>
                    <div
                      onClick={toggleNoConditions}
                      style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${declaredNoConditions ? "#88ee22" : "#333"}`, background: declaredNoConditions ? "#88ee22" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {declaredNoConditions && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5, fontWeight: 600 }} onClick={toggleNoConditions}>
                      {isES ? "Ninguna de las anteriores" : "None of the above"}
                    </span>
                  </label>
                </div>

                {screeningError && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 10, padding: "10px 12px" }}>
                    <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#ff4444", marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "#ff7777", lineHeight: 1.5, margin: 0 }}>{screeningError}</p>
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Step 1: Sobre ti ────────────────────────────────────────── */}
          {currentStep === 1 && <SectionCard emoji="👤" title={isES ? "Sobre ti" : "About you"}>
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
          </SectionCard>}

          {/* ── Step 2: Tu objetivo ─────────────────────────────────────── */}
          {currentStep === 2 && <>
          <SectionCard emoji="🎯" title={isES ? "Tu objetivo" : "Your goal"}>

            {/* ── IMC stats row ───────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[
                { label: isES ? "IMC" : "BMI",              value: imcVal.toFixed(1) },
                { label: isES ? "Categoría" : "Category",    value: imcCategoryLabel },
                { label: isES ? "Rango sano" : "Healthy range", value: `${wMin}–${wMax} kg` },
              ].map(stat => (
                <div key={stat.label} style={{ flex: 1, background: "#111", border: "1px solid #1f1f1f", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#555", fontWeight: 600, marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 13, color: "#e8e8e8", fontWeight: 700 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* ── Health message box ──────────────────────────────────── */}
            {msgText && (
              <div style={{ background: boxBg, border: `1px solid ${boxBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: boxColor, lineHeight: 1.5, margin: 0 }}>{msgText}</p>

                {/* Blocked state */}
                {tone === "block" && (
                  <div style={{ marginTop: 10, background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "#ff6666", fontWeight: 700, margin: 0 }}>
                      {isES ? "⛔ No podemos generar este plan para tu perfil actual." : "⛔ We cannot generate this plan for your current profile."}
                    </p>
                    <p style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.4 }}>
                      {isES ? "Elige otro objetivo o consulta con un profesional de la salud antes de continuar." : "Choose a different goal or consult a health professional before continuing."}
                    </p>
                  </div>
                )}

                {/* Caution / Warn checkboxes */}
                {(tone === "caution" || tone === "warn") && matrixEntry?.check1ES && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { checked: healthCheckbox1, setChecked: setHealthCheckbox1, labelES: matrixEntry.check1ES!, labelEN: matrixEntry.check1EN! },
                      { checked: healthCheckbox2, setChecked: setHealthCheckbox2, labelES: matrixEntry.check2ES!, labelEN: matrixEntry.check2EN! },
                    ].map((cb, i) => (
                      <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <div
                          onClick={() => cb.setChecked(v => !v)}
                          style={{
                            width: 18, height: 18, borderRadius: 5, border: `2px solid ${cb.checked ? boxColor : "#333"}`,
                            background: cb.checked ? boxColor : "transparent", flexShrink: 0, marginTop: 1,
                            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          {cb.checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }} onClick={() => cb.setChecked(v => !v)}>
                          {isES ? cb.labelES : cb.labelEN}
                        </span>
                      </label>
                    ))}
                    <p style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>
                      {isES
                        ? "⚠️ Este plan es orientativo y no constituye consejo médico. Consulta con un profesional sanitario si tienes dudas."
                        : "⚠️ This plan is informational and does not constitute medical advice. Consult a healthcare professional if in doubt."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Age >65 warning ─────────────────────────────────────── */}
            {isOldAge && (
              <div style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "#ffaa00", lineHeight: 1.5, margin: 0 }}>
                  {isES
                    ? `Tienes ${formData.age} años. Para personas mayores de 65 años, los cambios en dieta y entrenamiento deben hacerse con supervisión médica. Este plan es orientativo.`
                    : `You are ${formData.age} years old. For people over 65, dietary and training changes should be made with medical supervision. This plan is informational.`}
                </p>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { checked: ageCheckbox1, setChecked: setAgeCheckbox1, labelES: "Entiendo que tengo más de 65 años y que debo consultar con mi médico", labelEN: "I understand I am over 65 and should consult my doctor" },
                    { checked: ageCheckbox2, setChecked: setAgeCheckbox2, labelES: "Entiendo que este plan es orientativo y no sustituye supervisión médica", labelEN: "I understand this plan is informational and does not replace medical supervision" },
                  ].map((cb, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <div
                        onClick={() => cb.setChecked(v => !v)}
                        style={{
                          width: 18, height: 18, borderRadius: 5, border: `2px solid ${cb.checked ? "#ffaa00" : "#333"}`,
                          background: cb.checked ? "#ffaa00" : "transparent", flexShrink: 0, marginTop: 1,
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        {cb.checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }} onClick={() => cb.setChecked(v => !v)}>
                        {isES ? cb.labelES : cb.labelEN}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
                      onClick={() => { update({ goalType: g.id }); setHealthCheckbox1(false); setHealthCheckbox2(false); }}
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

                        {/* Pace slider */}
                        {detail.paces && (
                          <>
                            <p className="text-xs font-semibold text-[#A0A0A0] mb-1">
                              {isES ? "¿A qué ritmo?" : "At what pace?"}
                            </p>
                            <div style={{ margin: "8px 0 16px" }}>
                              <div
                                style={{ position: "relative", height: 4, background: "#2a2a2a", borderRadius: 2, margin: "20px 0 10px", cursor: "pointer" }}
                                onClick={e => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const pct = (e.clientX - rect.left) / rect.width;
                                  const idx = pct < 0.33 ? 0 : pct < 0.66 ? 1 : 2;
                                  setPaceIndex(idx);
                                  setGoalPace(idx === 0 ? "gentle" : idx === 2 ? "aggressive" : "moderate");
                                }}
                              >
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: "#88ee22", borderRadius: 2, width: `${paceIndex * 50}%`, transition: "width 0.15s" }} />
                                <div style={{ position: "absolute", top: "50%", left: `${paceIndex * 50}%`, transform: "translate(-50%, -50%)", width: 22, height: 22, borderRadius: "50%", background: "#88ee22", border: "2px solid #0a0a0a", boxShadow: "0 0 0 3px rgba(136,238,34,0.2)", transition: "left 0.15s", cursor: "grab" }} />
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                {paceOptions.map((p, i) => (
                                  <span key={i} style={{ fontSize: 11, color: i === paceIndex ? "#88ee22" : "#444", fontWeight: i === paceIndex ? 700 : 400, flex: 1, textAlign: i === 0 ? "left" : i === 2 ? "right" : "center" }}>
                                    {isES ? p.labelES : p.labelEN}
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(136,238,34,0.08)", border: "1px solid rgba(136,238,34,0.2)", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#88ee22", fontWeight: 600, marginTop: 8 }}>
                                {isES ? paceOptions[paceIndex].badgeES : paceOptions[paceIndex].badgeEN}
                              </div>
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
                      { id: "12:12", label: "12:12", badge: isES ? "Para empezar" : "Beginner",    badgeColor: "#7B8CDE", desc: isES ? "El más suave. 12h de ayuno, ideal para principiantes. Generalmente de 20:00 a 08:00. Sin grandes cambios en tu rutina diaria." : "The gentlest. 12h fast, ideal for beginners. Usually 8pm to 8am. No major changes to your routine." },
                      { id: "16:8", label: "16:8",  badge: isES ? "Más popular"  : "Most popular", badgeColor: "#88ee22", desc: isES ? "Ayunas 16h y comes en una ventana de 8h. El protocolo más estudiado. Mejora sensibilidad a la insulina y favorece la pérdida de grasa. Ej: comes de 12:00 a 20:00." : "Fast 16h, eat in an 8h window. Most studied protocol. Improves insulin sensitivity. E.g. eat 12pm–8pm." },
                      { id: "18:6", label: "18:6",  badge: null,                                    badgeColor: null,     desc: isES ? "Ventana de 6 horas. Mayor flexibilidad metabólica que el 16:8. Recomendado si ya tienes experiencia. Ej: comes de 13:00 a 19:00." : "6-hour eating window. Greater metabolic flexibility than 16:8. Recommended with prior fasting experience." },
                      { id: "20:4", label: "20:4",  badge: isES ? "Avanzado"    : "Advanced",      badgeColor: "#FFB800", desc: isES ? "Solo 4 horas para comer. Warrior Diet. Alta demanda para el organismo. Para usuarios con experiencia sólida en ayuno intermitente." : "Only 4 hours to eat. Warrior Diet. High demand on the body. For users with solid fasting experience." },
                      { id: "5:2",  label: "5:2",   badge: null,                                    badgeColor: null,     desc: isES ? "Comes normal 5 días a la semana. Los otros 2 días no consecutivos reduces a 500–600 kcal. Flexible y compatible con vida social." : "Eat normally 5 days. The other 2 non-consecutive days reduce to 500–600 kcal. Flexible and socially compatible." },
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

                        {fastingProtocol === p.id && (
                          <>
                            {/* What you CAN consume during the fast */}
                            <div style={{ marginTop: 10, marginBottom: 8 }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>
                                ✅ {isES ? "Puedes tomar durante el ayuno" : "You can consume during the fast"}
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {(FASTING_ALLOWED[p.id] ?? []).map((item, idx) => (
                                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                                    <span
                                      style={{ fontSize: 12, color: "#aaa", lineHeight: 1.4 }}
                                      dangerouslySetInnerHTML={{ __html: (isES ? item.textES : item.textEN).replace(/^([^—]+)/, '<strong style="color:#e8e8e8">$1</strong>') }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Diet-specific note */}
                            {(() => {
                              const note = FASTING_DIET_NOTES[p.id]?.[formData.dietType];
                              return note ? (
                                <div style={{ background: "rgba(136,238,34,0.05)", border: "1px solid rgba(136,238,34,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 11, color: "#88ee22", lineHeight: 1.5, marginBottom: 4 }}>
                                  {isES ? note.es : note.en}
                                </div>
                              ) : null;
                            })()}
                          </>
                        )}
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

          </>}

          {/* ── Step 3: Tu dieta ────────────────────────────────────────── */}
          {currentStep === 3 && <SectionCard emoji="🥗" title={isES ? "Tu dieta" : "Your diet"}>
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
          </SectionCard>}

          {/* ── Step 4: Entrenamiento ───────────────────────────────────── */}
          {currentStep === 4 && <SectionCard emoji="🏋️" title={isES ? "Entrenamiento" : "Training"}>
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
          </SectionCard>}

          {/* ── Step 5: Suplementos ─────────────────────────────────────── */}
          {currentStep === 5 && <SectionCard
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

                    {/* Expanded: variant + timing picker */}
                    {isSelected && timing && (
                      <div className="px-4 pb-4 border-t border-[#AAFF45]/10">
                        {/* Variant selector */}
                        {SUPPLEMENT_VARIANTS[supp.id] && (
                          <div className="mb-3 mt-3">
                            <p className="text-[10px] font-bold text-[#555] uppercase tracking-wider mb-2">
                              {isES ? "Tipo" : "Type"}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {SUPPLEMENT_VARIANTS[supp.id].map((variant, vIdx) => (
                                <button
                                  key={vIdx}
                                  type="button"
                                  onClick={() => setSelectedVariants(prev => ({ ...prev, [supp.id]: vIdx }))}
                                  className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-all"
                                  style={{
                                    background: selectedVariants[supp.id] === vIdx ? "rgba(136,238,34,0.05)" : "#0d0d0d",
                                    borderColor: selectedVariants[supp.id] === vIdx ? "#88ee22" : "#1a1a1a",
                                  }}
                                >
                                  <div
                                    className="w-3.5 h-3.5 rounded-full border-[1.5px] flex-shrink-0 mt-0.5"
                                    style={{
                                      background: selectedVariants[supp.id] === vIdx ? "#88ee22" : "transparent",
                                      borderColor: selectedVariants[supp.id] === vIdx ? "#88ee22" : "#444",
                                    }}
                                  />
                                  <div>
                                    <p className="text-[13px] font-semibold text-[#e8e8e8]">{variant.name}</p>
                                    <p className="text-[11px] text-[#555] mt-0.5 leading-snug">{variant.info}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Timing picker */}
                        <div style={{ marginTop: 10, border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden", background: "#0d0d0d" }}>
                          {timing.options.map((opt, optIdx) => {
                            const isOptSelected = selectedTimingIdx === optIdx;
                            const defaultHour = String(opt.notificationHour).padStart(2, "0");
                            const currentTime = supplementTimes[supp.id] ?? `${defaultHour}:00`;
                            return (
                              <div
                                key={optIdx}
                                style={{
                                  borderBottom: optIdx < timing.options.length - 1 ? "1px solid #1a1a1a" : "none",
                                  border: isOptSelected ? "1px solid rgba(136,238,34,0.3)" : "none",
                                  borderRadius: isOptSelected ? 12 : 0,
                                  background: isOptSelected ? "rgba(136,238,34,0.04)" : "transparent",
                                  margin: isOptSelected ? 4 : 0,
                                }}
                              >
                                {/* Top row */}
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}
                                  onClick={() => setTiming(supp.id, optIdx)}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    border: isOptSelected ? "none" : "1.5px solid #2a2a2a",
                                    background: isOptSelected ? "#88ee22" : "transparent",
                                    flexShrink: 0,
                                    boxShadow: isOptSelected ? "0 0 0 3px rgba(136,238,34,0.15)" : "none",
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8e8" }}>{opt.time}</div>
                                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{opt.desc}</div>
                                  </div>
                                  <div style={{
                                    fontSize: 12, fontWeight: 800,
                                    color: isOptSelected ? "#88ee22" : "#555",
                                    background: isOptSelected ? "rgba(136,238,34,0.1)" : "#111",
                                    border: `1px solid ${isOptSelected ? "rgba(136,238,34,0.2)" : "#1f1f1f"}`,
                                    borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap",
                                  }}>
                                    {currentTime}
                                  </div>
                                </div>

                                {/* Expanded detail */}
                                {isOptSelected && (
                                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1a1a1a" }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.6px", margin: "12px 0 10px" }}>
                                      ⏰ {isES ? "¿A qué hora quieres el aviso?" : "What time do you want the reminder?"}
                                    </div>

                                    {/* Time slot pills */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                      {(opt.slots ?? []).map(slot => {
                                        const slotVal = slot.length === 4 ? "0" + slot : slot;
                                        const isSlotSel = currentTime === slotVal || currentTime === slot;
                                        return (
                                          <div
                                            key={slot}
                                            onClick={() => setSupplementTimes(prev => ({ ...prev, [supp.id]: slotVal }))}
                                            style={{
                                              background: isSlotSel ? "rgba(136,238,34,0.08)" : "#111",
                                              border: `1px solid ${isSlotSel ? "#88ee22" : "#1f1f1f"}`,
                                              borderRadius: 8, padding: "7px 11px",
                                              fontSize: 12, fontWeight: 700,
                                              color: isSlotSel ? "#88ee22" : "#666",
                                              cursor: "pointer",
                                            }}
                                          >
                                            {slot}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Custom time input */}
                                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #1f1f1f", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                                      <span style={{ fontSize: 11, color: "#555", padding: "8px 12px", background: "#0a0a0a", borderRight: "1px solid #1f1f1f", whiteSpace: "nowrap" }}>
                                        {isES ? "Otra hora" : "Custom time"}
                                      </span>
                                      <input
                                        type="time"
                                        value={currentTime}
                                        onChange={e => setSupplementTimes(prev => ({ ...prev, [supp.id]: e.target.value }))}
                                        style={{ flex: 1, background: "#111", border: "none", outline: "none", padding: "8px 12px", fontSize: 14, fontWeight: 700, color: "#e8e8e8", fontFamily: "inherit", textAlign: "center", cursor: "pointer" }}
                                      />
                                    </div>

                                    {/* Notification preview */}
                                    <div style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10 }}>
                                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#88ee22", flexShrink: 0, marginTop: 4 }} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 10, color: "#555", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                                          <span>{isES ? "GoalIQ · Todos los días" : "GoalIQ · Every day"}</span>
                                          <span style={{ color: "#88ee22", fontWeight: 700 }}>{currentTime}</span>
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8" }}>
                                          {supp.emoji} {isES ? `Toma tu ${supp.name.toLowerCase()}` : `Take your ${supp.name.toLowerCase()}`}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#666", marginTop: 2, lineHeight: 1.4 }}>
                                          {opt.desc}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
          </SectionCard>}

          {/* ── Step 6: Resumen ─────────────────────────────────────────── */}
          {currentStep === 6 && <SectionCard emoji="🎉" title={isES ? "Esto es lo que crearemos" : "What we'll create"}>
            <div className="flex flex-col gap-2">
              {[
                { icon: "🍽️", name: isES ? "Plan de comidas 7 días" : "7-day meal plan", desc: isES ? "Desayuno, comida, cena y snacks adaptados a tus preferencias" : "Breakfast, lunch, dinner and snacks adapted to your preferences" },
                { icon: "🛒", name: isES ? "Lista de la compra semanal" : "Weekly shopping list", desc: isES ? "Todos los ingredientes organizados para facilitar tu compra" : "All ingredients organized to make shopping easy" },
                { icon: "🏋️", name: isES ? "Plan de entrenos semanal" : "Weekly workout plan", desc: isES ? "Ejercicios, series y repeticiones para tu nivel" : "Exercises, sets and reps for your level" },
                { icon: "🔔", name: isES ? "Recordatorios de suplementos" : "Supplement reminders", desc: isES ? "Notificaciones en el momento exacto de cada toma" : "Notifications at the exact time of each dose" },
                { icon: "📊", name: isES ? "Seguimiento de progreso" : "Progress tracking", desc: isES ? "Peso, racha, adherencia y estadísticas" : "Weight, streak, adherence and stats" },
              ].map((item) => (
                <div key={item.icon} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#111", border: "1px solid #1f1f1f" }}>
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#e8e8e8]">{item.name}</p>
                    <p className="text-[11px] text-[#555] mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(136,238,34,0.1)", border: "1px solid rgba(136,238,34,0.2)", color: "#88ee22" }}>
                    {isES ? "Incluido" : "Included"}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>}

        </div>
        </div>
      </div>

      {/* ── Sticky footer nav ──────────────────────────────────────────────── */}
      <div style={{ position: "sticky", bottom: 0, background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "12px 20px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {/* Error banner (last step only) */}
          {error && currentStep === STEPS.length - 1 && (
            <div className="mb-3 flex items-start gap-3 bg-[#FF4444]/10 border border-[#FF4444]/20 text-[#FF4444] text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {isEditMode ? t("couldnt_save_prefs") : t("couldnt_create_plan")}
                </p>
                <p className="text-[#FF4444]/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}
          {(() => {
            const onStep0 = currentStep === 0;
            const structurallyDisabled = onStep0
              ? screeningContinueDisabled
              : step2Blocked;
            const inFlight = onStep0 ? screeningSubmitting : isSubmitting;
            return (
              <button
                onClick={onStep0 ? handleScreeningContinue : handleNextStep}
                disabled={structurallyDisabled || inFlight}
                style={{ width: "100%", background: structurallyDisabled ? "#333" : "#88ee22", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 800, color: structurallyDisabled ? "#555" : "#0a0a0a", cursor: structurallyDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: inFlight ? 0.6 : 1, transition: "background 0.2s, color 0.2s" }}
              >
                {onStep0
                  ? (screeningSubmitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {isES ? "Validando..." : "Validating..."}</>
                      : (isES ? "Continuar →" : "Continue →"))
                  : (isSubmitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {isES ? "Creando tu plan..." : "Creating your plan..."}</>
                      : currentStep < STEPS.length - 1
                        ? (isES ? "Continuar →" : "Continue →")
                        : (isEditMode ? t("save_regenerate") : (isES ? "🚀 Crear mi plan" : "🚀 Create my plan")))
                }
              </button>
            );
          })()}
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(s => s - 1)}
              style={{ background: "none", border: "none", fontSize: 13, color: "#e8e8e8", cursor: "pointer", display: "block", textAlign: "center", marginTop: 10, width: "100%", fontFamily: "inherit", fontWeight: 600 }}
            >
              ← {isES ? "Volver" : "Back"}
            </button>
          )}
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
    <img
      src="/images/GOALIQ.png"
      alt="GoalIQ"
      style={{ height: 48, width: "auto", objectFit: "contain", display: "block" }}
    />
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

// ─── Health screening views ───────────────────────────────────────────────────

function HealthBlockedView({ blockReason, isES, onLogout }: { blockReason: string | null; isES: boolean; onLogout: () => void | Promise<void> }) {
  const [secondsLeft, setSecondsLeft] = useState(8);
  const calledRef = useRef(false);

  function fire() {
    if (calledRef.current) return;
    calledRef.current = true;
    void onLogout();
  }

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          fire();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reason = blockReason && BLOCK_REASON_LABELS[blockReason]
    ? (isES ? BLOCK_REASON_LABELS[blockReason].es : BLOCK_REASON_LABELS[blockReason].en)
    : (isES ? "tu situación de salud actual" : "your current health situation");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div style={{ background: "#141414", border: "2px solid rgba(255,68,68,0.3)", borderRadius: 16, padding: "24px 22px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle style={{ width: 32, height: 32, color: "#ff4444" }} />
            </div>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#e8e8e8", textAlign: "center", margin: 0, marginBottom: 12, lineHeight: 1.4 }}>
            {isES ? "GoalIQ no es la herramienta adecuada para tu situación actual" : "GoalIQ is not the right tool for your current situation"}
          </h1>
          <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, textAlign: "center", margin: 0, marginBottom: 16 }}>
            {isES
              ? `Las personas con ${reason} necesitan un seguimiento profesional individualizado que una app generalista no puede proporcionar.`
              : `People with ${reason} need personalized professional follow-up that a general-purpose app cannot provide.`}
          </p>
          <div style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#ffcc66", lineHeight: 1.5, margin: 0, fontWeight: 600, marginBottom: 8 }}>
              {isES
                ? "Te recomendamos encarecidamente acudir a un dietista-nutricionista colegiado o a tu médico."
                : "We strongly recommend you consult a registered dietitian-nutritionist or your doctor."}
            </p>
            <a
              href={PROFESSIONAL_LOOKUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", fontSize: 12, color: "#88ee22", fontWeight: 700, textDecoration: "underline" }}
            >
              {isES ? "Buscar profesional sanitario →" : "Find a healthcare professional →"}
            </a>
          </div>
          <p style={{ fontSize: 12, color: "#888", textAlign: "center", margin: 0, marginBottom: 14 }}>
            {isES
              ? `Tu sesión se cerrará automáticamente en ${secondsLeft} ${secondsLeft === 1 ? "segundo" : "segundos"}`
              : `Your session will close automatically in ${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"}`}
          </p>
          <button
            onClick={fire}
            style={{ width: "100%", background: "#88ee22", border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, color: "#0a0a0a", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <LogOut className="w-4 h-4" />
            {isES ? "Cerrar sesión ahora" : "Sign out now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllergiesWarningView({ isES, submitting, error, onBack, onAcknowledge }: { isES: boolean; submitting: boolean; error: string | null; onBack: () => void; onAcknowledge: () => void | Promise<void> }) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div style={{ background: "#141414", border: "2px solid rgba(255,170,0,0.3)", borderRadius: 16, padding: "24px 22px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,170,0,0.1)", border: "1px solid rgba(255,170,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle style={{ width: 26, height: 26, color: "#ffaa00" }} />
            </div>
          </div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "#e8e8e8", textAlign: "center", margin: 0, marginBottom: 12, lineHeight: 1.4 }}>
            {isES ? "Importante sobre tus alergias" : "Important about your allergies"}
          </h1>
          <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.65, marginBottom: 16 }}>
            <p style={{ margin: 0, marginBottom: 10 }}>
              {isES
                ? "GoalIQ puede ayudarte, pero ES TU RESPONSABILIDAD:"
                : "GoalIQ can help you, but IT IS YOUR RESPONSIBILITY TO:"}
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>{isES ? "Indicar tus alergias específicas en Preferencias." : "Specify your particular allergies in Preferences."}</li>
              <li>{isES ? "Revisar SIEMPRE los ingredientes de cada receta antes de cocinarla." : "ALWAYS check the ingredients of every recipe before cooking it."}</li>
              <li>{isES ? "Detener el uso si tienes cualquier reacción." : "Stop using the app if you have any reaction."}</li>
            </ol>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: acknowledged ? "rgba(255,170,0,0.08)" : "#0e0e0e", border: `1px solid ${acknowledged ? "rgba(255,170,0,0.35)" : "#1f1f1f"}`, marginBottom: 14, transition: "all 0.15s" }}>
            <div
              onClick={() => setAcknowledged(v => !v)}
              style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${acknowledged ? "#ffaa00" : "#333"}`, background: acknowledged ? "#ffaa00" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
            >
              {acknowledged && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5 }} onClick={() => setAcknowledged(v => !v)}>
              {isES
                ? "Entiendo que debo revisar siempre los ingredientes y soy responsable de evitar los alimentos a los que soy alérgico/a."
                : "I understand I must always check ingredients and am responsible for avoiding foods I'm allergic to."}
            </span>
          </label>

          {error && (
            <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 10, padding: "10px 12px" }}>
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#ff4444", marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#ff7777", lineHeight: 1.5, margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={onAcknowledge}
            disabled={!acknowledged || submitting}
            style={{ width: "100%", background: !acknowledged ? "#333" : "#88ee22", border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, color: !acknowledged ? "#555" : "#0a0a0a", cursor: !acknowledged ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: submitting ? 0.6 : 1, transition: "background 0.2s, color 0.2s" }}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isES ? "Validando..." : "Validating..."}</>
              : (isES ? "Continuar →" : "Continue →")}
          </button>
          <button
            onClick={onBack}
            disabled={submitting}
            style={{ background: "none", border: "none", fontSize: 13, color: "#e8e8e8", cursor: submitting ? "not-allowed" : "pointer", display: "block", textAlign: "center", marginTop: 10, width: "100%", fontFamily: "inherit", fontWeight: 600, opacity: submitting ? 0.5 : 1 }}
          >
            ← {isES ? "Volver" : "Back"}
          </button>
        </div>
      </div>
    </div>
  );
}
