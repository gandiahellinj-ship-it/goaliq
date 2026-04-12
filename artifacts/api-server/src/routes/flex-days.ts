import { Router, type IRouter } from "express";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureFlexDaysTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.flex_days (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      flex_date   DATE NOT NULL,
      week_start  DATE NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, flex_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS flex_days_user_date
    ON public.flex_days (user_id, flex_date)
  `);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// GET /api/flex-days?year=2026&month=4
router.get("/flex-days", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { year, month } = req.query as { year?: string; month?: string };
  const pool = getPool();

  const y = parseInt(year ?? String(new Date().getFullYear()));
  const m = parseInt(month ?? String(new Date().getMonth() + 1));
  const pad = (n: number) => String(n).padStart(2, "0");

  const start = new Date(y, m - 1, 1);
  start.setDate(start.getDate() - 7);
  const end = new Date(y, m, 0);
  end.setDate(end.getDate() + 7);

  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

  try {
    const { rows } = await pool.query(
      `SELECT flex_date::text FROM public.flex_days
       WHERE user_id = $1 AND flex_date >= $2 AND flex_date <= $3`,
      [req.user.id, startStr, endStr],
    );
    res.json({ dates: rows.map(r => r.flex_date) });
  } catch (err) {
    req.log.error({ err }, "[flex-days] GET failed");
    res.status(500).json({ error: "Failed to fetch flex days" });
  }
});

// POST /api/flex-days  { date: "2026-04-10" }          → mark
// POST /api/flex-days  { date: "2026-04-10", remove: true } → unmark
router.post("/flex-days", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { date, remove } = req.body as { date: string; remove?: boolean };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    return;
  }

  const pool = getPool();

  try {
    if (remove) {
      await pool.query(
        `DELETE FROM public.flex_days WHERE user_id = $1 AND flex_date = $2`,
        [req.user.id, date],
      );
    } else {
      const weekStart = getWeekStart(date);
      await pool.query(
        `INSERT INTO public.flex_days (user_id, flex_date, week_start)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, flex_date) DO NOTHING`,
        [req.user.id, date, weekStart],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "[flex-days] POST failed");
    res.status(500).json({ error: "Failed to update flex day" });
  }
});

export default router;
