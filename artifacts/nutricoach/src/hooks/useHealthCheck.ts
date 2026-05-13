import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ─── IMC × goal matrix (inlined from lib/api-zod) ────────────────────────────
// TODO: Unify when @workspace/api-zod is added as frontend dep.

const IMC_CATEGORIES = [
  "underweight",
  "normal",
  "overweight",
  "obesity_1",
  "obesity_2",
  "obesity_3",
] as const;
type ImcCategory = (typeof IMC_CATEGORIES)[number];

const GOAL_KEYS = ["lose_fat", "gain_muscle", "maintain", "recomposition"] as const;
type GoalKey = (typeof GOAL_KEYS)[number];

function calculateImc(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  return weightKg / Math.pow(heightCm / 100, 2);
}

function imcToCategory(imc: number): ImcCategory {
  if (imc < 18.5) return "underweight";
  if (imc < 25)   return "normal";
  if (imc < 30)   return "overweight";
  if (imc < 35)   return "obesity_1";
  if (imc < 40)   return "obesity_2";
  return "obesity_3";
}

const BLOCKING_COMBINATIONS: ReadonlyArray<{ imc: ImcCategory; goal: GoalKey }> = [
  { imc: "underweight", goal: "lose_fat" },
  { imc: "obesity_2",   goal: "maintain" },
  { imc: "obesity_3",   goal: "maintain" },
];

function isBlockingCombination(imc: ImcCategory, goal: GoalKey): boolean {
  return BLOCKING_COMBINATIONS.some(c => c.imc === imc && c.goal === goal);
}

const IMC_CATEGORY_LABELS_ES: Record<ImcCategory, string> = {
  underweight: "bajo peso",
  normal:      "peso normal",
  overweight:  "sobrepeso",
  obesity_1:   "obesidad grado I",
  obesity_2:   "obesidad grado II",
  obesity_3:   "obesidad grado III",
};

const GOAL_LABELS_ES: Record<GoalKey, string> = {
  lose_fat:      "perder grasa",
  gain_muscle:   "ganar músculo",
  maintain:      "mantener",
  recomposition: "recomposición",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

// Threshold beyond which we consider the user's logged weight has drifted
// meaningfully from the profile anchor and we should suggest an update.
const DRIFT_THRESHOLD_KG = 5;

export type HealthCheckStatus = "ok" | "drift" | "blocking";

export interface HealthCheckResult {
  status:               HealthCheckStatus;
  currentWeightKg:      number | null;       // last progress_logs.weight_kg, null if none
  profileWeightKg:      number | null;       // profiles.weight_kg
  profileHeightCm:      number | null;
  profileAge:           number | null;
  profileSex:           string | null;
  profileGoal:          string | null;       // raw value from profiles.goal
  profileGoalAsKey:     GoalKey | null;      // narrowed, null if it doesn't match GOAL_KEYS
  profileTargetKg:      number | null;
  profileTrainingLevel: string | null;
  currentImc:           number | null;
  currentImcCategory:   ImcCategory | null;
  driftKg:              number | null;
  messageEs:            string | null;
}

function emptyResult(partial: Partial<HealthCheckResult> = {}): HealthCheckResult {
  return {
    status:               "ok",
    currentWeightKg:      null,
    profileWeightKg:      null,
    profileHeightCm:      null,
    profileAge:           null,
    profileSex:           null,
    profileGoal:          null,
    profileGoalAsKey:     null,
    profileTargetKg:      null,
    profileTrainingLevel: null,
    currentImc:           null,
    currentImcCategory:   null,
    driftKg:              null,
    messageEs:            null,
    ...partial,
  };
}

export function useHealthCheck() {
  return useQuery<HealthCheckResult>({
    queryKey: ["health_check"],
    queryFn: async () => {
      const [{ data: profile }, { data: lastLog }] = await Promise.all([
        supabase
          .from("profiles")
          .select("age, sex, height_cm, weight_kg, target_weight_kg, training_level, goal")
          .maybeSingle(),
        supabase
          .from("progress_logs")
          .select("weight_kg")
          .not("weight_kg", "is", null)
          .order("log_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!profile) return emptyResult();

      const p = profile as {
        age:                number | null;
        sex:                string | null;
        height_cm:          number | null;
        weight_kg:          number | null;
        target_weight_kg:   number | null;
        training_level:     string | null;
        goal:               string | null;
      };

      const goalAsKey: GoalKey | null =
        p.goal && (GOAL_KEYS as readonly string[]).includes(p.goal)
          ? (p.goal as GoalKey)
          : null;

      const profileWeightKg = p.weight_kg;
      const profileHeightCm = p.height_cm;
      const currentWeightKg = (lastLog as { weight_kg: number | null } | null)?.weight_kg ?? null;

      const base = emptyResult({
        profileWeightKg,
        profileHeightCm,
        profileAge:           p.age,
        profileSex:           p.sex,
        profileGoal:          p.goal,
        profileGoalAsKey:     goalAsKey,
        profileTargetKg:      p.target_weight_kg,
        profileTrainingLevel: p.training_level,
        currentWeightKg,
      });

      // No log entry yet, or missing anchor → can't compare.
      if (currentWeightKg == null || profileWeightKg == null) return base;

      const driftKg = Math.abs(profileWeightKg - currentWeightKg);

      // Drift within tolerance → all good.
      if (driftKg <= DRIFT_THRESHOLD_KG) {
        return { ...base, driftKg };
      }

      // Drift is significant. If we lack height or a known goal, we can't run
      // the IMC × goal check — surface as a plain drift warning.
      if (!profileHeightCm || profileHeightCm <= 0 || !goalAsKey) {
        return {
          ...base,
          status: "drift",
          driftKg,
          messageEs:
            `Tu último peso registrado (${currentWeightKg} kg) difiere ${driftKg.toFixed(1)} kg ` +
            `del peso de tu perfil (${profileWeightKg} kg). Considera actualizar tu perfil ` +
            `para que tu plan sea preciso.`,
        };
      }

      const currentImc = calculateImc(currentWeightKg, profileHeightCm);
      const currentImcCategory = imcToCategory(currentImc);

      if (isBlockingCombination(currentImcCategory, goalAsKey)) {
        return {
          ...base,
          status: "blocking",
          driftKg,
          currentImc,
          currentImcCategory,
          messageEs:
            `Tu peso actual (${currentWeightKg} kg) indica ${IMC_CATEGORY_LABELS_ES[currentImcCategory]} ` +
            `(IMC ${currentImc.toFixed(1)}), lo que no es compatible con el objetivo ` +
            `"${GOAL_LABELS_ES[goalAsKey]}". Actualiza tu perfil para que recalculemos tu plan de forma segura.`,
        };
      }

      return {
        ...base,
        status: "drift",
        driftKg,
        currentImc,
        currentImcCategory,
        messageEs:
          `Tu último peso registrado (${currentWeightKg} kg) difiere ${driftKg.toFixed(1)} kg ` +
          `del peso de tu perfil (${profileWeightKg} kg). Considera actualizar tu perfil ` +
          `para que tu plan sea preciso.`,
      };
    },
  });
}
