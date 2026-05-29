import { Router, type IRouter } from "express";
import { generateWorkoutPlanModerated } from "../lib/aiGenerators";
import { createUserClient } from "../lib/supabase";
import { recordWorkoutPlanVersion } from "../lib/plan-versioning";
import { aiLimiter, aiBurstLimiter, normalLimiter } from "../middlewares/rate-limiters";
import pg from "pg";

const router: IRouter = Router();

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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

function getDateForDay(weekStart: string, dayOfWeek: string) {
  const dayIndex = ALL_DAYS.indexOf(dayOfWeek.toLowerCase());
  if (dayIndex < 0) return weekStart;
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0];
}

// workout_plans schema: (id, user_id, week_start DATE, days JSONB, generated_at TIMESTAMP)
// "days" is a JSONB array of workout day objects — same pattern as meal_plans

// DELETE /api/workouts — remove the current week's plan so it can be regenerated fresh
router.delete("/workouts", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();
  const weekStart = getCurrentWeekStart();
  try {
    await pool.query(
      `DELETE FROM public.workout_plans WHERE user_id = $1 AND week_start = $2`,
      [req.user.id, weekStart],
    );
    res.json({ deleted: true, weekStart });
  } catch (err) {
    req.log.error({ err }, "[workouts] DELETE failed");
    res.status(500).json({ error: "Failed to delete workout plan" });
  }
});

router.get("/workouts", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();
  const weekStart = getCurrentWeekStart();

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, week_start::text, days
       FROM public.workout_plans
       WHERE user_id = $1 AND week_start = $2
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id, weekStart],
    );

    console.log("[workouts GET] user:", req.user?.id, "weekStart:", weekStart, "rows:", rows?.length, "hasDays:", rows[0]?.days?.length ?? 0);

    if (rows.length === 0 || !rows[0].days || (rows[0].days as any[]).length === 0) {
      res.status(404).json({ error: "No workout plan found" });
      return;
    }

    res.json({ days: rows[0].days, weekStart: rows[0].week_start });
  } catch (err) {
    req.log.error({ err }, "[workouts] GET failed");
    res.status(500).json({ error: "Failed to fetch workout plan" });
  }
});

router.post("/workouts", aiBurstLimiter, aiLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const db = createUserClient(req.supabaseToken!);

  const { data: profileData } = await db
    .from("profiles")
    .select("age, sex, height_cm, weight_kg, target_weight_kg, goal, goal_pace, fasting_protocol, training_level, training_location, training_days_per_week")
    .eq("id", req.user.id)
    .maybeSingle();

  if (!profileData) {
    res.status(400).json({ error: "Profile not found. Please complete your profile first." });
    return;
  }

  if (!profileData.goal || !profileData.training_level) {
    res.status(400).json({ error: "Please complete your profile (goal and training level are required)." });
    return;
  }

  const lang: "es" | "en" = req.body?.lang === "en" ? "en" : "es";

  req.log.info({ userId: req.user.id, lang }, "[workouts] Starting AI workout plan generation");

  let workoutDays: any[];
  let aiModelUsed = "";
  let aiAttempts = 1;
  try {
    // Mejora 6: numeric moderation against weekly volume thresholds.
    // Returns ok=false after a reinforced retry — when that happens we
    // emit 422 and DO NOT touch the DB, so any previous plan is preserved.
    const outcome = await generateWorkoutPlanModerated({
      goalType: profileData.goal,
      goalPace: profileData.goal_pace ?? "moderate",
      fastingProtocol: profileData.fasting_protocol ?? null,
      trainingLevel: profileData.training_level,
      trainingDaysPerWeek: profileData.training_days_per_week ?? 3,
      trainingLocation: profileData.training_location ?? "home",
    }, lang, req.log);
    if (!outcome.ok) {
      const r = outcome.result;
      const trigger =
        r.reason === "excessive_volume"  ? "plan_moderation_volume"
      : r.reason === "force_fail_test"   ? "plan_moderation_force_fail_test"
      :                                    "plan_moderation_incomplete";
      const message =
        r.reason === "excessive_volume"
          ? "El plan de entrenamiento supera las recomendaciones de volumen semanal. Revisa tu nivel."
      : r.reason === "force_fail_test"
          ? "No pudimos generar un plan completo. Inténtalo de nuevo en unos minutos."
      :   "No pudimos generar un plan seguro. Por favor, inténtalo de nuevo.";

      await db
        .from("health_validation_logs")
        .insert({
          user_id: req.user.id,
          event_type: "blocked",
          trigger_reason: trigger,
          user_data_snapshot: {
            attempts:             outcome.attempts,
            reason:               r.reason ?? null,
            weekly_minutes:       r.details?.weeklyMinutes ?? null,
            weekly_exercises:     r.details?.weeklyExercises ?? null,
            days_count:           r.details?.daysCount ?? null,
            max_weekly_minutes:   r.details?.maxWeeklyMinutes ?? null,
            max_weekly_exercises: r.details?.maxWeeklyExercises ?? null,
          },
          action_taken: "auto_blocked_ai_moderation",
        })
        .then(({ error }) => {
          if (error) req.log.warn({ error }, "health_validation_logs insert failed (non-fatal)");
        });

      req.log.warn({ trigger, attempts: outcome.attempts, details: r.details }, "[workouts] moderation rejected plan — returning 422");
      res.status(422).json({ error: message, reason: r.reason });
      return;
    }
    workoutDays = outcome.plan as any[];
    aiModelUsed = outcome.modelUsed;
    aiAttempts = outcome.attempts;
  } catch (aiErr) {
    req.log.error({ aiErr }, "[workouts] AI generation failed");
    res.status(500).json({ error: "Workout plan generation failed. Please try again." });
    return;
  }

  req.log.info({ userId: req.user.id, dayCount: workoutDays.length }, "[workouts] AI generation complete");

  const weekStart = getCurrentWeekStart();
  const pool = getPool();

  // Normalise day names to lowercase English
  const workoutRows = workoutDays
    .filter((d: any) => typeof d.day_name === "string" && d.day_name.trim())
    .map((d: any) => ({
      day_name: d.day_name.toLowerCase().trim(),
      workout_type: typeof d.workout_type === "string" ? d.workout_type : "full_body",
      duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
      exercises: Array.isArray(d.exercises) ? d.exercises : [],
      warmup: typeof d.warmup === "string" ? d.warmup : "",
      cooldown: typeof d.cooldown === "string" ? d.cooldown : "",
      notes: typeof d.notes === "string" ? d.notes : "",
    }));

  // Save as single JSONB row — delete existing for this week then re-insert to avoid
  // ON CONFLICT dependency on a UNIQUE constraint that may not exist on all deployments.
  let savedId: number | null = null;
  try {
    await pool.query(
      `DELETE FROM public.workout_plans WHERE user_id = $1 AND week_start = $2`,
      [req.user.id, weekStart],
    );
    const { rows } = await pool.query(
      `INSERT INTO public.workout_plans (user_id, week_start, days, generated_at)
       VALUES ($1, $2, $3::jsonb, NOW()) RETURNING id`,
      [req.user.id, weekStart, JSON.stringify(workoutRows)],
    );
    savedId = rows[0]?.id ?? null;
    req.log.info({ userId: req.user.id, id: savedId, weekStart }, "[workouts] Workout plan saved");

    // Mejora 7: append-only audit version (best-effort; never blocks the response)
    recordWorkoutPlanVersion(pool, {
      userId: req.user.id,
      weekStart,
      planData: workoutRows,
      profileSnapshot: {
        age:                    profileData.age ?? null,
        sex:                    profileData.sex ?? null,
        height_cm:              profileData.height_cm ?? null,
        weight_kg:              profileData.weight_kg ?? null,
        target_weight_kg:       profileData.target_weight_kg ?? null,
        goal:                   profileData.goal ?? null,
        goal_pace:              profileData.goal_pace ?? null,
        fasting_protocol:       profileData.fasting_protocol ?? null,
        training_level:         profileData.training_level ?? null,
        training_location:      profileData.training_location ?? null,
        training_days_per_week: profileData.training_days_per_week ?? null,
      },
      aiModel: aiModelUsed,
      moderation: { ok: true, attempts: aiAttempts, reason: null },
    }, req.log).catch(() => { /* helper already logs internally */ });
  } catch (insertErr) {
    req.log.error({ insertErr }, "[workouts] Failed to save workout plan");
    res.status(500).json({ error: "Workout plan generated but could not be saved. Please try again." });
    return;
  }

  // Create calendar events for all 7 days via pg pool
  const trainingDaySet = new Set(workoutRows.map((r: any) => r.day_name));
  for (const dayName of ALL_DAYS) {
    const date = getDateForDay(weekStart, dayName);
    const eventType = trainingDaySet.has(dayName) ? "workout" : "rest";
    const workoutType = trainingDaySet.has(dayName)
      ? (workoutRows.find((r: any) => r.day_name === dayName)?.workout_type ?? null)
      : null;
    try {
      await pool.query(
        `INSERT INTO public.calendar_events (user_id, date, event_type, workout_type, is_completed)
         VALUES ($1, $2, $3, $4, FALSE)
         ON CONFLICT (user_id, date) DO UPDATE SET event_type = EXCLUDED.event_type, workout_type = EXCLUDED.workout_type`,
        [req.user.id, date, eventType, workoutType],
      );
    } catch (calErr) {
      req.log.warn({ calErr, dayName }, "[workouts] Calendar event creation failed (non-fatal)");
    }
  }

  req.log.info({ userId: req.user.id }, "[workouts] Workout plan saved successfully");
  res.json({ days: workoutRows, weekStart, id: savedId });
});

export default router;
