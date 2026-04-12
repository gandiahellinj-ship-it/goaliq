import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertCircle, Pencil } from "lucide-react";
import { submitOnboarding, type OnboardingFormData } from "@/lib/onboarding-service";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/language";

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
};

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const t = useT();

  const isEditMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "true";

  const steps = [
    { emoji: "👤", title: t("onboarding_step_about"), subtitle: t("onboarding_subtitle_about") },
    { emoji: "🥗", title: t("onboarding_step_diet"),  subtitle: t("onboarding_subtitle_diet") },
    { emoji: "💪", title: t("onboarding_step_fitness"), subtitle: t("onboarding_subtitle_fitness") },
  ];

  const [step, setStep] = useState(isEditMode ? 2 : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(isEditMode);

  const [formData, setFormData] = useState<OnboardingFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      setPrefilling(true);
      const [{ data: profile }, { data: prefs }, { data: onboarding }] = await Promise.all([
        supabase.from("profiles").select("full_name, age, sex, height_cm, weight_kg, target_weight_kg, goal, diet_type, training_level, training_location, training_days_per_week").maybeSingle(),
        supabase.from("food_preferences").select("allergies, disliked_foods, liked_foods").maybeSingle(),
        supabase.from("onboarding_profiles").select("age, sex, height_cm, weight_kg, target_weight_kg, goal_type, diet_type, allergies, disliked_foods, liked_foods, training_level, training_location, training_days_per_week").maybeSingle(),
      ]);

      const src = onboarding ?? profile;
      if (src) {
        setFormData({
          displayName: (profile as any)?.full_name ?? EMPTY_FORM.displayName,
          age: src.age ?? EMPTY_FORM.age,
          sex: (src as any).sex ?? EMPTY_FORM.sex,
          heightCm: src.height_cm ?? (src as any).heightCm ?? EMPTY_FORM.heightCm,
          weightKg: src.weight_kg ?? EMPTY_FORM.weightKg,
          targetWeightKg: src.target_weight_kg ?? null,
          goalType: (src as any).goal_type ?? (src as any).goal ?? EMPTY_FORM.goalType,
          dietType: src.diet_type ?? EMPTY_FORM.dietType,
          allergies: (prefs?.allergies as string[]) ?? ((src as any).allergies as string[]) ?? [],
          dislikedFoods: (prefs?.disliked_foods as string[]) ?? ((src as any).disliked_foods as string[]) ?? [],
          likedFoods: (prefs?.liked_foods as string[]) ?? ((src as any).liked_foods as string[]) ?? [],
          trainingLevel: (src as any).training_level ?? EMPTY_FORM.trainingLevel,
          trainingLocation: (src as any).training_location ?? EMPTY_FORM.trainingLocation,
          trainingDaysPerWeek: (src as any).training_days_per_week ?? EMPTY_FORM.trainingDaysPerWeek,
        });
      }
      setPrefilling(false);
    })();
  }, [isEditMode]);

  const update = (patch: Partial<OnboardingFormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitOnboarding(formData);
      if (isEditMode) {
        setLocation("/meals?regenerate=true");
      } else {
        setLocation("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (prefilling) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex items-center gap-2 mb-8">
          <span className="font-display font-black italic text-2xl leading-none">
            <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#AAFF45] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#555555] font-medium">{t("loading_preferences")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 font-sans">

      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <span className="font-display font-black italic text-2xl leading-none">
          <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
        </span>
      </div>

      {/* Edit mode banner */}
      {isEditMode && (
        <div className="w-full max-w-lg mb-4 flex items-center gap-2.5 bg-[#AAFF45]/5 border border-[#AAFF45]/15 rounded-lg px-4 py-3">
          <Pencil className="w-4 h-4 text-[#AAFF45] shrink-0" />
          <p className="text-sm text-[#AAFF45]/80 font-medium">
            {t("updating_preferences_msg")}
          </p>
        </div>
      )}

      <div className="w-full max-w-lg">
        {/* Step Dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => isEditMode && setStep(i + 1)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                  step === i + 1
                    ? "bg-[#AAFF45] text-[#0A0A0A]"
                    : step > i + 1
                    ? "bg-[#AAFF45]/20 text-[#AAFF45]"
                    : "bg-[#2A2A2A] text-[#555555]"
                } ${isEditMode ? "cursor-pointer" : "cursor-default"}`}
              >
                {step > i + 1 ? <CheckCircle className="w-3 h-3" /> : <span>{s.emoji}</span>}
                <span className="hidden sm:block">{s.title}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 rounded-full transition-colors duration-300 ${step > i + 1 ? "bg-[#AAFF45]/50" : "bg-[#2A2A2A]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] p-7 sm:p-10">
          <div className="mb-8">
            <div className="text-4xl mb-3">{steps[step - 1].emoji}</div>
            <h1 className="text-2xl font-display font-bold uppercase text-white">
              {isEditMode ? `${t("update_prefix")} ${steps[step - 1].title}` : steps[step - 1].title}
            </h1>
            <p className="text-[#555555] mt-1 text-sm">{steps[step - 1].subtitle}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {/* STEP 1: Personal */}
              {step === 1 && (
                <div className="space-y-5">
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
                        value={formData.heightCm}
                        onChange={e => update({ heightCm: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={t("current_weight_kg")}>
                      <input
                        type="number"
                        value={formData.weightKg}
                        onChange={e => update({ weightKg: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label={t("main_goal")}>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {[
                        { id: "lose_fat",     label: t("goal_lose_fat"),     emoji: "🔥" },
                        { id: "maintain",     label: t("goal_stay_fit"),     emoji: "⚖️" },
                        { id: "gain_muscle",  label: t("goal_build_muscle"), emoji: "💪" },
                      ].map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => update({ goalType: g.id })}
                          className={choiceClass(formData.goalType === g.id)}
                        >
                          <span className="text-xl mb-1">{g.emoji}</span>
                          <span className="text-xs font-semibold">{g.label}</span>
                        </button>
                      ))}
                    </div>
                  </Field>

                  {formData.goalType !== "maintain" && (
                    <Field label={t("target_weight_kg")}>
                      <input
                        type="number"
                        value={formData.targetWeightKg ?? ""}
                        placeholder={t("target_weight_placeholder")}
                        onChange={e => update({ targetWeightKg: e.target.value ? Number(e.target.value) : null })}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              )}

              {/* STEP 2: Diet */}
              {step === 2 && (
                <div className="space-y-5">
                  <Field label={t("diet_type_question")}>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {[
                        { id: "balanced",     label: t("diet_balanced"),     emoji: "🍽️" },
                        { id: "high_protein", label: t("diet_high_protein"), emoji: "🥩" },
                        { id: "keto",         label: t("diet_keto"),         emoji: "🥑" },
                        { id: "vegetarian",   label: t("diet_vegetarian"),   emoji: "🌿" },
                        { id: "vegan",        label: t("diet_vegan"),        emoji: "🌱" },
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => update({ dietType: d.id })}
                          className={choiceClass(formData.dietType === d.id)}
                        >
                          <span className="text-xl mb-1">{d.emoji}</span>
                          <span className="text-xs font-semibold">{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={t("food_allergies")} hint={t("leave_blank")}>
                    <input
                      type="text"
                      placeholder={t("allergies_placeholder")}
                      value={formData.allergies.join(", ")}
                      onChange={e => update({ allergies: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className={inputClass}
                    />
                  </Field>

                  <Field label={t("foods_avoid")} hint={t("leave_blank")}>
                    <input
                      type="text"
                      placeholder={t("foods_avoid_placeholder")}
                      value={formData.dislikedFoods.join(", ")}
                      onChange={e => update({ dislikedFoods: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className={inputClass}
                    />
                  </Field>

                  <Field label={t("foods_love")} hint={t("foods_love_hint")}>
                    <input
                      type="text"
                      placeholder={t("foods_love_placeholder")}
                      value={formData.likedFoods.join(", ")}
                      onChange={e => update({ likedFoods: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}

              {/* STEP 3: Training */}
              {step === 3 && (
                <div className="space-y-5">
                  <Field label={t("fitness_level")}>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {[
                        { id: "beginner",     label: t("fitness_beginner"),     emoji: "🌱" },
                        { id: "intermediate", label: t("fitness_intermediate"), emoji: "⚡" },
                        { id: "advanced",     label: t("fitness_advanced"),     emoji: "🏆" },
                      ].map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => update({ trainingLevel: l.id })}
                          className={choiceClass(formData.trainingLevel === l.id)}
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
                        { id: "gym",     label: t("gym"),     emoji: "🏋️" },
                        { id: "home",    label: t("home"),    emoji: "🏠" },
                        { id: "outdoor", label: t("outdoor"), emoji: "🌳" },
                      ].map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => update({ trainingLocation: l.id })}
                          className={choiceClass(formData.trainingLocation === l.id)}
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
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error Banner */}
          {error && (
            <div className="mt-5 flex items-start gap-3 bg-[#FF4444]/10 border border-[#FF4444]/20 text-[#FF4444] text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{isEditMode ? t("couldnt_save_prefs") : t("couldnt_create_plan")}</p>
                <p className="text-[#FF4444]/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            {step > 1 && !isSubmitting && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-5 py-3.5 rounded-lg font-semibold bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#3A3A3A] transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("back")}
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="flex-1 px-6 py-3.5 rounded-lg font-bold bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {t("continue_btn")}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3.5 rounded-lg font-bold bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? t("saving_regenerating") : t("creating_plan")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {isEditMode ? t("save_regenerate") : t("lets_go")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#555555] mt-5">
          {t("step_n_of_m", { n: step, m: steps.length })}
          {isEditMode ? ` — ${t("new_plan_30s")}` : ` — ${t("can_update_later")}`}
        </p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#A0A0A0]">{label}</label>
      {hint && <p className="text-xs text-[#555555] -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder:text-[#3A3A3A] focus:border-[#AAFF45]/50 focus:ring-2 focus:ring-[#AAFF45]/10 outline-none transition-all text-sm";

function choiceClass(active: boolean) {
  return `flex flex-col items-center justify-center py-3 px-2 rounded-lg border-2 font-medium transition-all text-sm ${
    active
      ? "border-[#AAFF45] bg-[#AAFF45]/10 text-[#AAFF45]"
      : "border-[#2A2A2A] bg-[#0A0A0A] text-[#555555] hover:border-[#3A3A3A]"
  }`;
}
