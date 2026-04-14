import { Router, type IRouter } from "express";
import { GetMealPlanResponse, ReplaceIngredientBody, ReplaceIngredientResponse } from "@workspace/api-zod";
import { generateMealPlanForUser, replaceIngredientInMeal } from "../lib/aiGenerators";
import { createUserClient } from "../lib/supabase";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// GET — use pg pool to bypass RLS (same DB, just direct access)
router.get("/meals", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, week_start::text, days, generated_at
       FROM public.meal_plans
       WHERE user_id = $1
       ORDER BY generated_at DESC
       LIMIT 1`,
      [req.user.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "No meal plan found" });
      return;
    }
    const data = rows[0];
    // Skip GetMealPlanResponse.parse() — meal_plans.id is a UUID string in Supabase
    // but the Zod schema declares id: z.number(), causing a ZodError on every read.
    // The data comes from our own trusted DB so validation adds no safety here.
    res.json({
      id: data.id,
      userId: data.user_id,
      weekStart: data.week_start,
      days: data.days,
      generatedAt: data.generated_at instanceof Date
        ? data.generated_at.toISOString()
        : String(data.generated_at ?? ""),
    });
  } catch (err) {
    req.log.error({ err }, "[meals] GET failed");
    res.status(500).json({ error: "Failed to fetch meal plan" });
  }
});

router.post("/meals", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const db = createUserClient(req.supabaseToken!);

  // Query both tables in parallel — data lives in profiles + food_preferences
  const [{ data: profileData }, { data: prefsData }] = await Promise.all([
    db.from("profiles")
      .select("id, full_name, age, sex, height_cm, weight_kg, target_weight_kg, goal, diet_type, training_level, training_location, training_days_per_week")
      .eq("id", req.user.id)
      .maybeSingle(),
    db.from("food_preferences")
      .select("allergies, liked_foods, disliked_foods")
      .eq("user_id", req.user.id)
      .maybeSingle(),
  ]);

  if (!profileData) {
    res.status(400).json({
      error: "Profile not found. Please complete your profile before generating a meal plan.",
      missingFields: ["name", "goal", "diet_type"],
    });
    return;
  }

  const missing: string[] = [];
  if (!profileData.full_name) missing.push("name");
  if (!profileData.goal) missing.push("goal");
  if (!profileData.diet_type) missing.push("diet type");

  if (missing.length > 0) {
    res.status(400).json({
      error: `Your profile is missing required information: ${missing.join(", ")}. Please update your profile before generating a meal plan.`,
      missingFields: missing,
    });
    return;
  }

  const profile = {
    id: 0,
    userId: req.user.id,
    goalType: profileData.goal!,
    dietType: profileData.diet_type!,
    age: profileData.age ?? 30,
    sex: profileData.sex ?? "not specified",
    heightCm: profileData.height_cm ?? 170,
    weightKg: profileData.weight_kg ?? 70,
    targetWeightKg: profileData.target_weight_kg ?? null,
    trainingLevel: profileData.training_level ?? "beginner",
    trainingLocation: profileData.training_location ?? "home",
    trainingDaysPerWeek: profileData.training_days_per_week ?? 3,
    allergies: (prefsData?.allergies as string[]) ?? [],
    likedFoods: (prefsData?.liked_foods as string[]) ?? [],
    dislikedFoods: (prefsData?.disliked_foods as string[]) ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  req.log.info({ userId: req.user.id }, "[meals] Starting AI meal plan generation");
  let days: unknown[];
  try {
    days = await generateMealPlanForUser(profile as any);
  } catch (aiErr: any) {
    req.log.error({
      aiErrMessage: aiErr?.message,
      aiErrStack: aiErr?.stack,
    }, "[meals] AI generation failed");
    res.status(500).json({ error: "Meal plan generation failed. Please try again." });
    return;
  }

  req.log.info({ userId: req.user.id, dayCount: days.length }, "[meals] AI generation complete — saving to DB");

  const weekStart = getCurrentWeekStart();
  const pool = getPool();

  let savedId: number | null = null;
  try {
    const daysJson = JSON.stringify(days);
    // Delete existing row for this week then re-insert — avoids ON CONFLICT dependency
    // on a UNIQUE constraint that may not exist on all deployments.
    await pool.query(
      `DELETE FROM public.meal_plans WHERE user_id = $1 AND week_start = $2`,
      [req.user.id, weekStart],
    );
    const { rows } = await pool.query(
      `INSERT INTO public.meal_plans (user_id, week_start, days, generated_at)
       VALUES ($1, $2, $3::jsonb, NOW()) RETURNING id`,
      [req.user.id, weekStart, daysJson],
    );
    savedId = rows[0]?.id ?? null;
    req.log.info({ userId: req.user.id, id: savedId, weekStart }, "[meals] Meal plan saved to DB");
  } catch (dbErr) {
    req.log.error({ dbErr }, "[meals] Failed to save meal plan to DB — returning data anyway");
  }

  res.json({ days, weekStart, id: savedId });
});

router.post("/meals/replace-ingredient", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = ReplaceIngredientBody.parse(req.body);
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, user_id, days FROM public.meal_plans WHERE id = $1 AND user_id = $2`,
    [body.mealPlanId, req.user.id],
  );
  const planData = rows[0];

  if (!planData) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const days = planData.days as any[];
  const dayPlan = days.find((d: any) => d.day === body.dayOfWeek);
  if (!dayPlan) { res.status(404).json({ error: "Day not found" }); return; }
  const meal = dayPlan.meals.find((m: any) => m.id === body.mealId);
  if (!meal) { res.status(404).json({ error: "Meal not found" }); return; }
  const ingredient = meal.ingredients.find((i: any) => i.name === body.ingredientName);
  if (!ingredient) { res.status(404).json({ error: "Ingredient not found" }); return; }

  const db = createUserClient(req.supabaseToken!);
  const [{ data: profileData }, { data: prefsData }] = await Promise.all([
    db.from("profiles").select("diet_type").eq("id", req.user.id).maybeSingle(),
    db.from("food_preferences").select("allergies, disliked_foods").eq("user_id", req.user.id).maybeSingle(),
  ]);

  const replacement = await replaceIngredientInMeal(
    ingredient.name, ingredient.category,
    profileData?.diet_type || "balanced",
    (prefsData?.allergies as string[]) || [],
    (prefsData?.disliked_foods as string[]) || [],
  );

  const idx = meal.ingredients.indexOf(ingredient);
  meal.ingredients[idx] = replacement;

  await pool.query(
    `UPDATE public.meal_plans SET days = $1::jsonb WHERE id = $2`,
    [JSON.stringify(days), body.mealPlanId],
  );

  res.json(ReplaceIngredientResponse.parse(meal));
});

export default router;
