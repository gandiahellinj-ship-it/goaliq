import { Router, type IRouter } from "express";
import { GetCalendarQueryParams, GetCalendarResponse, MarkWorkoutCompleteBody, MarkWorkoutCompleteResponse } from "@workspace/api-zod";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

function toDateStr(val: unknown): string {
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    date: toDateStr(row.date),
    eventType: row.event_type,
    workoutType: row.workout_type ?? null,
    isCompleted: row.is_completed ?? false,
    notes: row.notes ?? null,
  };
}

router.get("/calendar", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();
  const query = GetCalendarQueryParams.parse(req.query);
  const now = new Date();
  const year = query.year ?? now.getFullYear();
  const month = query.month ?? now.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, date::text, event_type, workout_type, is_completed, notes
       FROM public.calendar_events
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [req.user.id, startDate, endDateStr],
    );

    const workoutRows = rows.filter((r) => r.event_type === "workout");
    const completed = workoutRows.filter((r) => r.is_completed).length;
    const adherencePercent = workoutRows.length > 0
      ? Math.round((completed / workoutRows.length) * 100) : 0;

    res.json(GetCalendarResponse.parse({ events: rows.map(mapRow), adherencePercent }));
  } catch (err) {
    req.log.error({ err }, "[calendar] GET failed");
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

router.post("/calendar/complete", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = MarkWorkoutCompleteBody.parse(req.body);
  const pool = getPool();

  try {
    // Update existing row first — also forces event_type to 'workout' in case a 'rest'
    // event was previously created for this date by the workout plan generator.
    const upd = await pool.query(
      `UPDATE public.calendar_events
       SET is_completed = $3, event_type = 'workout'
       WHERE user_id = $1 AND date = $2
       RETURNING id, user_id, date::text, event_type, workout_type, is_completed, notes`,
      [req.user.id, body.date, body.isCompleted],
    );

    let eventRow: any;
    if ((upd.rowCount ?? 0) > 0) {
      eventRow = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO public.calendar_events (user_id, date, event_type, is_completed)
         VALUES ($1, $2, 'workout', $3)
         RETURNING id, user_id, date::text, event_type, workout_type, is_completed, notes`,
        [req.user.id, body.date, body.isCompleted],
      );
      eventRow = ins.rows[0];
    }

    if (!eventRow) {
      res.status(500).json({ error: "Failed to save calendar event" });
      return;
    }

    res.json(MarkWorkoutCompleteResponse.parse(mapRow(eventRow)));
  } catch (err) {
    req.log.error({ err }, "[calendar] POST /complete failed");
    res.status(500).json({ error: "Failed to save calendar event" });
  }
});

export default router;
