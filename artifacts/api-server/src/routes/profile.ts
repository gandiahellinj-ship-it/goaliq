import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  PatchProfileBodyStrict,
  applyProfileCrossValidations,
} from "@workspace/api-zod";
import { createUserClient } from "../lib/supabase";

const router: IRouter = Router();

// Duplicated from routes/onboarding.ts — small enough that the indirection
// is not worth a shared helper yet. If a third endpoint needs it, lift it
// into ../lib/.
function mapProfile(p: Record<string, unknown>) {
  return {
    id: p.id,
    userId: p.id,
    age: p.age,
    sex: p.sex,
    heightCm: p.height_cm,
    weightKg: p.weight_kg,
    goalType: p.goal,
    dietType: p.diet_type,
    allergies: [] as string[],
    likedFoods: [] as string[],
    dislikedFoods: [] as string[],
    trainingLevel: p.training_level,
    trainingLocation: p.training_location,
    trainingDaysPerWeek: p.training_days_per_week,
    targetWeightKg: p.target_weight_kg ?? null,
    createdAt: p.created_at as string,
    updatedAt: p.created_at as string,
  };
}

router.patch("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = PatchProfileBodyStrict.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    res.status(400).json({
      error: "Datos de perfil no válidos",
      issues,
    });
    return;
  }
  const patch = parsed.data;

  const db = createUserClient(req.supabaseToken!);
  const userId = req.user.id;

  // 1) Load the current anchor values needed for cross-validation. Height
  // is never editable here so it always comes from the DB.
  const { data: current, error: loadErr } = await db
    .from("profiles")
    .select("weight_kg, height_cm, age, goal, goal_pace, target_weight_kg")
    .eq("id", userId)
    .maybeSingle();

  if (loadErr) {
    req.log.error({ error: loadErr }, "Failed to load profile for PATCH");
    res.status(500).json({ error: "No se pudo cargar el perfil" });
    return;
  }
  if (!current) {
    res.status(404).json({ error: "Perfil no encontrado. Completa el onboarding primero." });
    return;
  }
  const c = current as {
    weight_kg:        number | null;
    height_cm:        number | null;
    age:              number | null;
    goal:             string | null;
    goal_pace:        string | null;
    target_weight_kg: number | null;
  };

  // 2) Build the effective profile by merging the patch on top of current
  // values. Cross-validation runs against this projected state.
  const effectiveWeightKg = patch.weightKg ?? c.weight_kg;
  const effectiveGoalType = patch.goalType ?? c.goal;
  // Note: patch.goalPace can be explicitly null (e.g. when switching goalType
  // to "maintain"), so we preserve undefined-vs-null semantics carefully.
  const effectiveGoalPace =
    patch.goalPace !== undefined ? patch.goalPace : c.goal_pace;
  const effectiveTargetKg =
    patch.targetWeightKg !== undefined ? patch.targetWeightKg : c.target_weight_kg;

  if (effectiveWeightKg == null || c.height_cm == null || effectiveGoalType == null) {
    res.status(400).json({
      error: "Tu perfil no tiene los datos físicos necesarios. Completa el onboarding primero.",
    });
    return;
  }

  // 3) Cross-validation via a tiny ad-hoc schema that wraps the shared rule
  // function. This avoids reconstructing a RefinementCtx manually.
  const EffectiveProfile = z
    .object({
      weightKg:       z.number(),
      heightCm:       z.number(),
      goalType:       z.string(),
      goalPace:       z.string().nullable().optional(),
      targetWeightKg: z.number().nullable().optional(),
    })
    .superRefine(applyProfileCrossValidations);

  const crossCheck = EffectiveProfile.safeParse({
    weightKg:       effectiveWeightKg,
    heightCm:       c.height_cm,
    goalType:       effectiveGoalType,
    goalPace:       effectiveGoalPace ?? null,
    targetWeightKg: effectiveTargetKg ?? null,
  });
  if (!crossCheck.success) {
    const issues = crossCheck.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    res.status(400).json({
      error: "El cambio propuesto produce una combinación incompatible",
      issues,
    });
    return;
  }

  // 4) Apply UPDATE with only the patched columns (not the merged set).
  // Edge case worth documenting: when the frontend changes goalType to
  // "maintain", it must also send goalPace: null in the SAME request,
  // otherwise the cross-validator will reject (existing goalPace becomes
  // incompatible). Same applies in reverse: setting goalPace on a profile
  // already in "maintain" requires also changing goalType.
  const updates: Record<string, unknown> = {};
  if (patch.weightKg       !== undefined) updates.weight_kg        = patch.weightKg;
  if (patch.age            !== undefined) updates.age              = patch.age;
  if (patch.goalType       !== undefined) updates.goal             = patch.goalType;
  if (patch.goalPace       !== undefined) updates.goal_pace        = patch.goalPace;
  if (patch.targetWeightKg !== undefined) updates.target_weight_kg = patch.targetWeightKg;

  const { data: updated, error: updateErr } = await db
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (updateErr || !updated) {
    req.log.error({ error: updateErr }, "Failed to UPDATE profile");
    res.status(500).json({ error: "No se pudo actualizar el perfil" });
    return;
  }

  // Intentionally NOT wiping meal_plans / workout_plans here — that's the
  // semantic difference between this lightweight PATCH and the full POST
  // /api/onboarding which triggers a fresh plan generation.

  // Skip Zod parse on response — see routes/onboarding.ts:70 for context.
  res.json(mapProfile(updated as Record<string, unknown>));
});

export default router;
