import pg from "pg";

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureSupabaseTablesReady(): Promise<void> {
  const pool = getPool();

  // 1. workout_plans — table already exists in Supabase with schema:
  //    (id, user_id, week_start, days jsonb, generated_at, duration_minutes)
  //    Just ensure unique constraint exists for safe UPSERT
  await pool.query(`CREATE INDEX IF NOT EXISTS workout_plans_user_week ON public.workout_plans (user_id, week_start)`);

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

  // 2. meal_plans — create if missing
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.meal_plans (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT NOT NULL,
      week_start   DATE NOT NULL,
      days         JSONB NOT NULL DEFAULT '[]',
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS meal_plans_user ON public.meal_plans (user_id)`);

  // Add unique constraint if not present (pre-existing table may lack it)
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

  // 3. calendar_events — create if missing
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

  // Add unique constraint if not present (pre-existing table may lack it)
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
}
