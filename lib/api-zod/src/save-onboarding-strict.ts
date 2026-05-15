import { z } from "zod";
import { SaveOnboardingBody } from "./generated/api";
import {
  calculateImc,
  imcToCategory,
  isBlockingCombination,
  IMC_CATEGORY_LABELS_ES,
  GOAL_LABELS_ES,
  type GoalKey,
} from "./health-matrix";

// Shared shape consumed by the cross-validator. Kept loose so it can be
// applied to both the full onboarding body and a merged "effective profile"
// built from a partial PATCH plus DB values.
export interface ProfileCrossValidationInput {
  weightKg:       number;
  heightCm:       number;
  goalType:       string;
  goalPace?:      string | null;
  targetWeightKg?: number | null;
}

// Cross-field rules OpenAPI codegen cannot express:
//   1. BMI × goal medical blocking
//   2. targetWeightKg direction must match goalType
//   3. |targetWeightKg − weightKg| sanity bound (50 kg)
//   4. "maintain" must not carry a goalPace
//
// Spanish messages — the product is ES-primary.
export function applyProfileCrossValidations(
  data: ProfileCrossValidationInput,
  ctx: z.RefinementCtx,
): void {
  const goal = data.goalType as GoalKey;

  // 1) BMI × goal blocking
  const imc = calculateImc(data.weightKg, data.heightCm);
  const cat = imcToCategory(imc);
  if (isBlockingCombination(cat, goal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["goalType"],
      message:
        `Tu IMC (${imc.toFixed(1)}, ${IMC_CATEGORY_LABELS_ES[cat]}) no es compatible con el ` +
        `objetivo "${GOAL_LABELS_ES[goal]}". Elige otro objetivo o consulta con un profesional sanitario.`,
    });
  }

  // 2) targetWeightKg coherence with goal direction
  if (data.targetWeightKg != null) {
    if (goal === "lose_fat" && data.targetWeightKg >= data.weightKg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Para el objetivo 'perder grasa', el peso objetivo debe ser menor que el peso actual.",
      });
    }
    if (goal === "gain_muscle" && data.targetWeightKg <= data.weightKg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Para el objetivo 'ganar músculo', el peso objetivo debe ser mayor que el peso actual.",
      });
    }
    // 3) Sanity bound on the difference
    if (Math.abs(data.targetWeightKg - data.weightKg) > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "El peso objetivo difiere demasiado del peso actual (más de 50 kg). Revisa los valores.",
      });
    }
  }

  // 4) goalPace is meaningless for "maintain"
  if (data.goalPace != null && goal === "maintain") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["goalPace"],
      message: "El objetivo 'mantener' no admite ritmo (suave / moderado / agresivo).",
    });
  }
}

// Strict wrapper around the generated SaveOnboardingBody. Delegates the
// cross-field logic to the shared function so PATCH /api/profile can reuse
// it on a merged input.
export const SaveOnboardingBodyStrict = SaveOnboardingBody.superRefine(applyProfileCrossValidations);

export type SaveOnboardingBodyStrictInput = z.infer<typeof SaveOnboardingBodyStrict>;
