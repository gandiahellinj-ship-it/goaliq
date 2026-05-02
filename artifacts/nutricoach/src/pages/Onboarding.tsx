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
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [supplementTimes, setSupplementTimes] = useState<Record<string, string>>({});
  const [goalPace, setGoalPace] = useState("moderate");
  const [paceIndex, setPaceIndex] = useState(1);
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState("16:8");
  const [currentStep, setCurrentStep] = useState(0);

  const STEPS = ["sobre-ti", "objetivo", "dieta", "entrenamiento", "suplementos", "resumen"];
  const STEP_NAMES_ES = ["Sobre ti", "Tu objetivo", "Tu dieta", "Entrenamiento", "Suplementos", "Resumen"];
  const STEP_NAMES_EN = ["About you", "Your goal", "Your diet", "Training", "Supplements", "Summary"];

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

  const paceOptions = [
    { key: "gentle",     labelES: "🐢 Suave",    labelEN: "🐢 Gentle",    badgeES: "−0.25 kg/sem · déficit 250 kcal",  badgeEN: "−0.25 kg/week · 250 kcal deficit" },
    { key: "moderate",   labelES: "🚶 Moderado",  labelEN: "🚶 Moderate",  badgeES: "−0.5 kg/sem · déficit 500 kcal",   badgeEN: "−0.5 kg/week · 500 kcal deficit",  recommended: true },
    { key: "aggressive", labelES: "🏃 Agresivo",  labelEN: "🏃 Aggressive", badgeES: "−1 kg/sem · déficit 1000 kcal",  badgeEN: "−1 kg/week · 1000 kcal deficit" },
  ];

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

          {/* ── Step 0: Sobre ti ────────────────────────────────────────── */}
          {currentStep === 0 && <SectionCard emoji="👤" title={isES ? "Sobre ti" : "About you"}>
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

          {currentStep === 1 && <>
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

          {/* ── Step 2: Tu dieta ────────────────────────────────────────── */}
          {currentStep === 2 && <SectionCard emoji="🥗" title={isES ? "Tu dieta" : "Your diet"}>
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

          {/* ── Step 3: Entrenamiento ───────────────────────────────────── */}
          {currentStep === 3 && <SectionCard emoji="🏋️" title={isES ? "Entrenamiento" : "Training"}>
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

          {/* ── Step 4: Suplementos ─────────────────────────────────────── */}
          {currentStep === 4 && <SectionCard
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

          {/* ── Step 5: Resumen ─────────────────────────────────────────── */}
          {currentStep === 5 && <SectionCard emoji="🎉" title={isES ? "Esto es lo que crearemos" : "What we'll create"}>
            <div className="flex flex-col gap-2">
              {[
                { icon: "🍽️", name: isES ? "Plan nutricional 7 días" : "7-day nutrition plan", desc: isES ? "Desayuno, comida, cena y snacks adaptados a ti" : "Breakfast, lunch, dinner and snacks tailored to you" },
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
          <button
            onClick={currentStep < STEPS.length - 1 ? () => setCurrentStep(s => s + 1) : handleSubmit}
            disabled={isSubmitting}
            style={{ width: "100%", background: "#88ee22", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 800, color: "#0a0a0a", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isSubmitting ? 0.6 : 1 }}
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isES ? "Creando tu plan..." : "Creating your plan..."}</>
              : currentStep < STEPS.length - 1
                ? (isES ? "Continuar →" : "Continue →")
                : (isEditMode ? t("save_regenerate") : (isES ? "🚀 Crear mi plan" : "🚀 Create my plan"))
            }
          </button>
          {currentStep > 0 && (
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
