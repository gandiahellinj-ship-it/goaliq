import pg from "pg";

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureSupabaseTablesReady(): Promise<void> {
  const pool = getPool();

  // 1. workout_plans — managed in Supabase; actual schema:
  //    id uuid PK, user_id uuid, week_start date, days jsonb, generated_at timestamptz,
  //    created_at timestamptz
  //    Ensure 'days' JSONB and 'generated_at' columns exist (idempotent for pre-existing tables).
  //    Ensure UNIQUE (user_id, week_start) exists for ON CONFLICT upserts.
  await pool.query(`ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS days JSONB`);
  await pool.query(`ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS workout_plans_user_week_idx ON public.workout_plans (user_id, week_start)`);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workout_plans_user_week_unique'
           OR conname = 'workout_plans_user_id_week_start_key'
      ) THEN
        ALTER TABLE public.workout_plans ADD CONSTRAINT workout_plans_user_week_unique UNIQUE (user_id, week_start);
      END IF;
    END $$
  `);

  // 2. meal_plans — managed in Supabase; actual schema:
  //    id uuid PK, user_id uuid, week_start date, days jsonb, generated_at timestamptz,
  //    created_at timestamptz
  //    Ensure 'days' JSONB and 'generated_at' columns exist (idempotent for pre-existing tables).
  //    Ensure UNIQUE (user_id, week_start) exists for ON CONFLICT upserts.
  await pool.query(`ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS days JSONB`);
  await pool.query(`ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS meal_plans_user_week_idx ON public.meal_plans (user_id, week_start)`);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'meal_plans_user_id_week_start_key'
           OR conname = 'meal_plans_user_week_unique'
      ) THEN
        ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_user_week_unique UNIQUE (user_id, week_start);
      END IF;
    END $$
  `);

  // 3. workoutx_exercises — local permanent cache of WorkoutX exercise catalogue
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.workoutx_exercises (
      id VARCHAR(20) PRIMARY KEY,
      name TEXT NOT NULL,
      body_part TEXT,
      target TEXT,
      equipment TEXT,
      difficulty TEXT,
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS workoutx_exercises_equipment_idx
    ON public.workoutx_exercises(equipment)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS workoutx_exercises_target_idx
    ON public.workoutx_exercises(target)
  `);
  // v0.9.11 — enrichment columns (additive, idempotent ALTER)
  // Source fields from WorkoutX API: secondaryMuscles, instructions, gifUrl,
  // mechanic (compound/isolation), force (push/pull/static), description,
  // met (metabolic equivalent), caloriesPerMinute.
  await pool.query(`
    ALTER TABLE public.workoutx_exercises
      ADD COLUMN IF NOT EXISTS secondary_muscles  JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS instructions       JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS gif_url            TEXT,
      ADD COLUMN IF NOT EXISTS mechanic           TEXT,
      ADD COLUMN IF NOT EXISTS force              TEXT,
      ADD COLUMN IF NOT EXISTS description        TEXT,
      ADD COLUMN IF NOT EXISTS met                NUMERIC,
      ADD COLUMN IF NOT EXISTS calories_per_minute NUMERIC
  `);

  // 4. calendar_events — create if missing; not defined in supabase-schema.sql
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.calendar_events (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      date          DATE NOT NULL,
      event_type    TEXT NOT NULL DEFAULT 'workout',
      workout_type  TEXT,
      is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS calendar_events_user_date_idx ON public.calendar_events (user_id, date)`);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'calendar_events_user_id_date_key'
           OR conname = 'calendar_events_user_date_unique'
      ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_user_date_unique UNIQUE (user_id, date);
      END IF;
    END $$
  `);

  // 5. meal_logs — validated meal registrations ("Mi comida real"). Meals live as
  //    JSONB inside meal_plans (no meals table), so a row is keyed by
  //    meal_plan_id + meal_type + date. Macros are nullable for now (the plan
  //    JSONB doesn't carry per-meal macros yet).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.meal_logs (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              UUID NOT NULL,
      meal_plan_id         UUID,
      meal_type            TEXT NOT NULL,
      date                 DATE NOT NULL,
      match_percentage     INTEGER,
      status               TEXT,
      calories             INTEGER,
      protein_g            INTEGER,
      carbs_g              INTEGER,
      fat_g                INTEGER,
      detected_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
      feedback             TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx ON public.meal_logs (user_id, date)`,
  );
}
