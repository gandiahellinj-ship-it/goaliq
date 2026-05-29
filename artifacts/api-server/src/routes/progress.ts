import { Router, type IRouter } from "express";
import { normalLimiter } from "../middlewares/rate-limiters";
import {
  UpdateProgressBody,
  calculateImc,
  imcToCategory,
  isBlockingCombination,
  GOAL_KEYS,
  GOAL_LABELS_ES,
  IMC_CATEGORY_LABELS_ES,
  type GoalKey,
} from "@workspace/api-zod";
import { createUserClient } from "../lib/supabase";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

router.get("/progress", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const db = createUserClient(req.supabaseToken!);
    const pool = getPool();
    const { start, end } = getWeekRange();

    const [{ data: profiles }, { data: weightEntries }] = await Promise.all([
      db.from("profiles").select("weight_kg, target_weight_kg").eq("id", req.user.id).limit(1),
      db.from("progress_logs").select("log_date, weight_kg").eq("user_id", req.user.id).order("log_date", { ascending: true }),
    ]);

    let calRows: any[] = [];
    try {
      const calResult = await pool.query(
        `SELECT event_type, is_completed FROM public.calendar_events
         WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [req.user.id, start, end],
      );
      calRows = calResult.rows;
    } catch (_calErr) {
      // calendar_events table may not exist yet — treat as no events
    }

    const profile = profiles?.[0];
    const entries = weightEntries || [];
    const fallbackWeight: number = profile?.weight_kg ?? 70;
    const startWeightKg: number = entries.length > 0 ? (entries[0].weight_kg ?? fallbackWeight) : fallbackWeight;
    const currentWeightKg: number = entries.length > 0 ? (entries[entries.length - 1].weight_kg ?? startWeightKg) : startWeightKg;

    const workoutRows = calRows.filter((e: any) => e.event_type === "workout");
    const completedWorkouts = workoutRows.filter((e: any) => e.is_completed).length;
    const adherencePercent = workoutRows.length > 0
      ? Math.round((completedWorkouts / workoutRows.length) * 100) : 0;

    // Skip Zod parse on response — progress_logs.log_date is an ISO string
    // but the schema declares date: z.date(), causing a ZodError → 500 even
    // when the read/write succeeded. The data comes from our own trusted DB
    // so validation adds no safety here.
    // Same pattern as routes/onboarding.ts (commit 2541412) and
    // routes/meals.ts:44-46.
    res.json({
      currentWeightKg,
      targetWeightKg: profile?.target_weight_kg ?? null,
      startWeightKg,
      weeklyAdherencePercent: adherencePercent,
      completedWorkoutsThisWeek: completedWorkouts,
      totalWorkoutsThisWeek: workoutRows.length,
      weightHistory: entries.map((e: any) => ({ date: e.log_date, weightKg: e.weight_kg ?? 0 })),
    });
  } catch (err) {
    req.log.error({ err }, "[progress] GET failed");
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

router.post("/progress", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const body = UpdateProgressBody.parse(req.body);
    const db = createUserClient(req.supabaseToken!);
    const pool = getPool();
    const today = new Date().toISOString().split("T")[0];

    // ── Mejora 4 Eje 3: reject dangerous weight logs ─────────────────────
    // Load enough of the profile to evaluate BMI × goal blocking against the
    // weight the user is about to log. profiles.weight_kg is intentionally
    // NOT touched here — Approach C preserves the onboarding anchor weight.
    // Skip validation gracefully when height_cm is missing or goal is a
    // legacy value not in GOAL_KEYS (avoids breaking existing users).
    const { data: profileForCheck } = await db
      .from("profiles")
      .select("height_cm, goal, age, sex, target_weight_kg, training_level")
      .eq("id", req.user.id)
      .maybeSingle();
    const pc = (profileForCheck ?? null) as {
      height_cm:        number | null;
      goal:             string | null;
      age:              number | null;
      sex:              string | null;
      target_weight_kg: number | null;
      training_level:   string | null;
    } | null;

    const goalAsKey: GoalKey | null =
      pc && pc.goal && (GOAL_KEYS as readonly string[]).includes(pc.goal)
        ? (pc.goal as GoalKey)
        : null;

    if (pc && pc.height_cm && pc.height_cm > 0 && goalAsKey) {
      const imc = calculateImc(body.weightKg, pc.height_cm);
      const cat = imcToCategory(imc);
      if (isBlockingCombination(cat, goalAsKey)) {
        // Audit log (best-effort — never blocks the 400 response).
        await db
          .from("health_validation_logs")
          .insert({
            user_id: req.user.id,
            event_type: "blocked",
            trigger_reason: "weight_log_imc_drift",
            user_data_snapshot: {
              age:              pc.age,
              biological_sex:   pc.sex,
              height_cm:        pc.height_cm,
              weight_kg:        body.weightKg,
              imc,
              imc_category:     cat,
              goal_selected:    pc.goal,
              target_weight_kg: pc.target_weight_kg ?? null,
              activity_level:   pc.training_level ?? null,
            },
            action_taken: "auto_blocked_post_drift",
          })
          .then(({ error }) => {
            if (error) req.log.warn({ error }, "health_validation_logs insert failed (non-fatal)");
          });

        res.status(400).json({
          error: "No puedes registrar este peso",
          issues: [
            {
              path: ["weightKg"],
              message:
                `No puedes registrar este peso (${body.weightKg} kg). Con tu altura ` +
                `(${pc.height_cm} cm), el IMC sería ${imc.toFixed(1)} (${IMC_CATEGORY_LABELS_ES[cat]}), ` +
                `incompatible con tu objetivo "${GOAL_LABELS_ES[goalAsKey]}". ` +
                `Actualiza tu perfil o tu objetivo antes de continuar.`,
            },
          ],
        });
        return;
      }
    }

    const { data: existing } = await db
      .from("progress_logs")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("log_date", today)
      .maybeSingle();

    if (existing) {
      await db.from("progress_logs").update({ weight_kg: body.weightKg }).eq("user_id", req.user.id).eq("log_date", today);
    } else {
      await db.from("progress_logs").insert({ user_id: req.user.id, log_date: today, weight_kg: body.weightKg });
    }

    const { start, end } = getWeekRange();
    const [{ data: profiles }, { data: weightEntries }] = await Promise.all([
      db.from("profiles").select("weight_kg, target_weight_kg").eq("id", req.user.id).limit(1),
      db.from("progress_logs").select("log_date, weight_kg").eq("user_id", req.user.id).order("log_date", { ascending: true }),
    ]);

    let calRowsPost: any[] = [];
    try {
      const calResult = await pool.query(
        `SELECT event_type, is_completed FROM public.calendar_events
         WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [req.user.id, start, end],
      );
      calRowsPost = calResult.rows;
    } catch (_calErr) {
      // calendar_events table may not exist yet — treat as no events
    }

    const profile = profiles?.[0];
    const entries = weightEntries || [];
    const fallbackWeightPost: number = profile?.weight_kg ?? 70;
    const startWeightKg: number = entries.length > 0 ? (entries[0].weight_kg ?? fallbackWeightPost) : fallbackWeightPost;
    const workoutRows = calRowsPost.filter((e: any) => e.event_type === "workout");
    const completedWorkouts = workoutRows.filter((e: any) => e.is_completed).length;
    const adherencePercent = workoutRows.length > 0
      ? Math.round((completedWorkouts / workoutRows.length) * 100) : 0;

    // Skip Zod parse on response — progress_logs.log_date is an ISO string
    // but the schema declares date: z.date(), causing a ZodError → 500 even
    // though the INSERT/UPDATE succeeded. The data comes from our own
    // trusted DB so validation adds no safety here.
    // Same pattern as routes/onboarding.ts (commit 2541412) and
    // routes/meals.ts:44-46.
    res.json({
      currentWeightKg: body.weightKg,
      targetWeightKg: profile?.target_weight_kg ?? null,
      startWeightKg,
      weeklyAdherencePercent: adherencePercent,
      completedWorkoutsThisWeek: completedWorkouts,
      totalWorkoutsThisWeek: workoutRows.length,
      weightHistory: entries.map((e: any) => ({ date: e.log_date, weightKg: e.weight_kg ?? 0 })),
    });
  } catch (err) {
    req.log.error({ err }, "[progress] POST failed");
    res.status(500).json({ error: "Failed to save progress" });
  }
});

export default router;
