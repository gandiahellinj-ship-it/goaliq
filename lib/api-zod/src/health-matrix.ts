// Shared single source of truth for BMI × goal medical blocking.
// Consumed by the server-side strict Zod refinement and (in a later
// step) by the frontend onboarding UI, so both sides reject the same
// combinations without duplicating logic.

export const IMC_CATEGORIES = [
  "underweight",
  "normal",
  "overweight",
  "obesity_1",
  "obesity_2",
  "obesity_3",
] as const;

export type ImcCategory = (typeof IMC_CATEGORIES)[number];

export const GOAL_KEYS = [
  "lose_fat",
  "gain_muscle",
  "maintain",
  "recomposition",
] as const;

export type GoalKey = (typeof GOAL_KEYS)[number];

export function calculateImc(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  return weightKg / Math.pow(heightCm / 100, 2);
}

export function imcToCategory(imc: number): ImcCategory {
  if (imc < 18.5) return "underweight";
  if (imc < 25)   return "normal";
  if (imc < 30)   return "overweight";
  if (imc < 35)   return "obesity_1";
  if (imc < 40)   return "obesity_2";
  return "obesity_3";
}

// Combinations that must be hard-blocked. Mirrored in the frontend UI
// (Onboarding.tsx HEALTH_MATRIX where tone === "block") but enforced
// here so a tampered client cannot bypass them.
export const BLOCKING_COMBINATIONS: ReadonlyArray<{
  imc: ImcCategory;
  goal: GoalKey;
}> = [
  { imc: "underweight", goal: "lose_fat" },
  { imc: "obesity_2",   goal: "maintain" },
  { imc: "obesity_3",   goal: "maintain" },
];

export function isBlockingCombination(imc: ImcCategory, goal: GoalKey): boolean {
  return BLOCKING_COMBINATIONS.some(c => c.imc === imc && c.goal === goal);
}

export const IMC_CATEGORY_LABELS_ES: Record<ImcCategory, string> = {
  underweight: "bajo peso",
  normal:      "peso normal",
  overweight:  "sobrepeso",
  obesity_1:   "obesidad grado I",
  obesity_2:   "obesidad grado II",
  obesity_3:   "obesidad grado III",
};

export const GOAL_LABELS_ES: Record<GoalKey, string> = {
  lose_fat:      "perder grasa",
  gain_muscle:   "ganar músculo",
  maintain:      "mantener",
  recomposition: "recomposición",
};
