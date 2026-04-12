import { Router, type IRouter } from "express";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureWorkoutHistoryTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.workout_history (
      id               SERIAL PRIMARY KEY,
      user_id          TEXT NOT NULL,
      workout_date     DATE NOT NULL,
      workout_type     TEXT NOT NULL,
      exercises        JSONB NOT NULL DEFAULT '[]',
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, workout_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS workout_history_user_date
    ON public.workout_history (user_id, workout_date)
  `);
}

// GET /api/workout-history?year=2026&month=4
router.get("/workout-history", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { year, month } = req.query as { year?: string; month?: string };
  const pool = getPool();

  const y = parseInt(year ?? String(new Date().getFullYear()));
  const m = parseInt(month ?? String(new Date().getMonth() + 1));
  const pad = (n: number) => String(n).padStart(2, "0");

  const startStr = `${y}-${pad(m)}-01`;
  const endDate = new Date(y, m, 0);
  const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

  try {
    const { rows } = await pool.query(
      `SELECT
         workout_date::text,
         workout_type,
         exercises,
         duration_minutes
       FROM public.workout_history
       WHERE user_id = $1 AND workout_date >= $2 AND workout_date <= $3
       ORDER BY workout_date`,
      [req.user.id, startStr, endStr],
    );
    res.json({ history: rows });
  } catch (err) {
    req.log.error({ err }, "[workout-history] GET failed");
    res.status(500).json({ error: "Failed to fetch workout history" });
  }
});

// POST /api/workout-history { date, workout_type, exercises, duration_minutes }  → save
// POST /api/workout-history { date, remove: true }                              → delete
router.post("/workout-history", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { date, remove, workout_type, exercises, duration_minutes } = req.body as {
    date: string;
    remove?: boolean;
    workout_type?: string;
    exercises?: unknown[];
    duration_minutes?: number;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    return;
  }

  const pool = getPool();

  try {
    if (remove) {
      await pool.query(
        `DELETE FROM public.workout_history WHERE user_id = $1 AND workout_date = $2`,
        [req.user.id, date],
      );
    } else {
      if (!workout_type) {
        res.status(400).json({ error: "workout_type is required" });
        return;
      }
      await pool.query(
        `INSERT INTO public.workout_history
           (user_id, workout_date, workout_type, exercises, duration_minutes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, workout_date) DO UPDATE
           SET workout_type     = EXCLUDED.workout_type,
               exercises        = EXCLUDED.exercises,
               duration_minutes = EXCLUDED.duration_minutes`,
        [req.user.id, date, workout_type, JSON.stringify(exercises ?? []), duration_minutes ?? 0],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "[workout-history] POST failed");
    res.status(500).json({ error: "Failed to update workout history" });
  }
});

export default router;
