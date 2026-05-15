import { z } from "zod";
import { SaveOnboardingBody } from "./generated/api";

// Partial schema for PATCH /api/profile. Only the 5 fields the user can
// edit from the lightweight "quick edit" form. Bounds/enums come from the
// generated SaveOnboardingBody via .pick(); .partial() makes every key
// optional; .strict() rejects unknown keys (catches frontend typos like
// "weight" instead of "weightKg"); .refine() requires at least one field
// so an empty body is rejected instead of silently no-oping.
//
// Cross-field rules (BMI × goal, target direction, ±50 kg sanity,
// maintain × pace) are NOT applied at this layer because the patch is
// inherently partial. The endpoint merges this patch with DB values and
// then runs applyProfileCrossValidations on the effective profile.
export const PatchProfileBodyStrict = SaveOnboardingBody
  .pick({
    weightKg:       true,
    age:            true,
    goalType:       true,
    goalPace:       true,
    targetWeightKg: true,
  })
  .partial()
  .strict()
  .refine(obj => Object.values(obj).some(v => v !== undefined), {
    message: "Debes incluir al menos un campo para actualizar.",
  });

export type PatchProfileBodyStrictInput = z.infer<typeof PatchProfileBodyStrict>;
