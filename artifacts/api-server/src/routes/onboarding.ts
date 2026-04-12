import { Router, type IRouter } from "express";
import { GetOnboardingResponse, SaveOnboardingBody, SaveOnboardingResponse } from "@workspace/api-zod";
import { createUserClient } from "../lib/supabase";

const router: IRouter = Router();

function mapProfile(
  p: Record<string, unknown>,
  prefs?: Record<string, unknown> | null,
) {
  return {
    id: p.id,
    userId: p.id,
    age: p.age,
    sex: p.sex,
    heightCm: p.height_cm,
    weightKg: p.weight_kg,
    goalType: p.goal,
    dietType: p.diet_type,
    allergies: (prefs?.allergies as string[]) || [],
    likedFoods: (prefs?.liked_foods as string[]) || [],
    dislikedFoods: (prefs?.disliked_foods as string[]) || [],
    trainingLevel: p.training_level,
    trainingLocation: p.training_location,
    trainingDaysPerWeek: p.training_days_per_week,
    targetWeightKg: p.target_weight_kg ?? null,
    createdAt: p.created_at as string,
    updatedAt: p.created_at as string,
  };
}

router.get("/onboarding", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const db = createUserClient(req.supabaseToken!);

  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();

  if (profileErr || !profile || !profile.age) {
    res.status(404).json({ error: "Onboarding not completed" });
    return;
  }

  const { data: prefs } = await db
    .from("food_preferences")
    .select("*")
    .eq("user_id", req.user.id)
    .maybeSingle();

  res.json(GetOnboardingResponse.parse(mapProfile(profile as Record<string, unknown>, prefs as Record<string, unknown> | null)));
});

router.post("/onboarding", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = SaveOnboardingBody.parse(req.body);
  const db = createUserClient(req.supabaseToken!);

  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .upsert(
      {
        id: req.user.id,
        age: body.age,
        sex: body.sex,
        height_cm: body.heightCm,
        weight_kg: body.weightKg,
        goal: body.goalType,
        diet_type: body.dietType,
        training_level: body.trainingLevel,
        training_location: body.trainingLocation,
        training_days_per_week: body.trainingDaysPerWeek,
        target_weight_kg: body.targetWeightKg ?? null,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (profileErr || !profile) {
    req.log.error({ error: profileErr }, "Failed to save onboarding profile");
    res.status(500).json({ error: "Failed to save profile" });
    return;
  }

  await db
    .from("food_preferences")
    .upsert(
      {
        user_id: req.user.id,
        liked_foods: body.likedFoods,
        disliked_foods: body.dislikedFoods,
        allergies: body.allergies,
        intolerances: [],
      },
      { onConflict: "user_id" },
    );

  res.json(SaveOnboardingResponse.parse(mapProfile(profile as Record<string, unknown>)));
});

export default router;
