// Plan versioning for legal audit (Mejora 7).
// Records every successfully persisted meal/workout plan in dedicated
// append-only tables together with the profile snapshot at the moment of
// generation, the AI model used, and the moderation outcome. Used to
// reproduce the exact plan a user received if a dispute arises later.
//
// Tables (created manually in Supabase):
//   CREATE TABLE public.meal_plan_versions (
//     id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     version_number    int  NOT NULL,
//     week_start        date NOT NULL,
//     plan_data         jsonb NOT NULL,
//     profile_snapshot  jsonb NOT NULL,
//     ai_model          text NOT NULL,
//     ai_attempts       int  NOT NULL DEFAULT 1,
//     moderation_result jsonb NOT NULL,
//     status            text NOT NULL DEFAULT 'active'
//                       CHECK (status IN ('active','superseded','archived')),
//     generated_at      timestamptz NOT NULL DEFAULT now(),
//     superseded_at     timestamptz,
//     archived_at       timestamptz,
//     CONSTRAINT meal_plan_versions_user_version_unique UNIQUE (user_id, version_number)
//   );
//   CREATE UNIQUE INDEX meal_plan_versions_one_active_per_user
//     ON public.meal_plan_versions (user_id) WHERE status = 'active';
//   -- workout_plan_versions: identical structure
//
// RLS is enabled without policies → user JWTs cannot read; only pg.Pool
// (postgres role) or service_role access these tables.

import type pg from "pg";

interface MinimalLogger {
  warn: (obj: unknown, msg: string) => void;
}

// Retention window for the future archive cron (deferred to a later session).
// Versions older than this should be marked status='archived'.
export const ARCHIVE_AFTER_DAYS = 730;

export interface ModerationSnapshot {
  ok: boolean;
  attempts: number;
  reason?: string | null;
  details?: unknown;
}

export interface MealProfileSnapshot {
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  goal: string | null;
  goal_pace: string | null;
  fasting_protocol: string | null;
  diet_type: string | null;
  training_level: string | null;
  training_location: string | null;
  training_days_per_week: number | null;
  allergies: string[];
  liked_foods: string[];
  disliked_foods: string[];
}

export interface WorkoutProfileSnapshot {
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  goal: string | null;
  goal_pace: string | null;
  fasting_protocol: string | null;
  training_level: string | null;
  training_location: string | null;
  training_days_per_week: number | null;
}

interface RecordArgs<P> {
  userId: string;
  weekStart: string;
  planData: unknown;
  profileSnapshot: P;
  aiModel: string;
  moderation: ModerationSnapshot;
}

async function recordVersion<P>(
  table: "meal_plan_versions" | "workout_plan_versions",
  pool: pg.Pool,
  args: RecordArgs<P>,
  logger: MinimalLogger,
): Promise<void> {
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.${table}
          SET status = 'superseded', superseded_at = NOW()
        WHERE user_id = $1 AND status = 'active'`,
      [args.userId],
    );

    const { rows: nextRows } = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
         FROM public.${table}
        WHERE user_id = $1`,
      [args.userId],
    );
    const nextVersion: number = nextRows[0]?.next ?? 1;

    await client.query(
      `INSERT INTO public.${table}
         (user_id, version_number, week_start, plan_data, profile_snapshot,
          ai_model, ai_attempts, moderation_result, status, generated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, 'active', NOW())`,
      [
        args.userId,
        nextVersion,
        args.weekStart,
        JSON.stringify(args.planData),
        JSON.stringify(args.profileSnapshot),
        args.aiModel,
        args.moderation.attempts,
        JSON.stringify(args.moderation),
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch { /* swallow */ }
    }
    logger.warn(
      { err, userId: args.userId, table },
      "[plan-versioning] record failed (non-fatal, user already has their plan)",
    );
  } finally {
    if (client) client.release();
  }
}

export function recordMealPlanVersion(
  pool: pg.Pool,
  args: RecordArgs<MealProfileSnapshot>,
  logger: MinimalLogger,
): Promise<void> {
  return recordVersion("meal_plan_versions", pool, args, logger);
}

export function recordWorkoutPlanVersion(
  pool: pg.Pool,
  args: RecordArgs<WorkoutProfileSnapshot>,
  logger: MinimalLogger,
): Promise<void> {
  return recordVersion("workout_plan_versions", pool, args, logger);
}
