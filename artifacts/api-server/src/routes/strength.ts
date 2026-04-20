import { Router, type IRouter } from "express";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureStrengthLogsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.strength_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      weight_kg DECIMAL(6,2) NOT NULL,
      reps INTEGER NOT NULL,
      logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
      week_start DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS strength_logs_user_idx
    ON public.strength_logs(user_id, muscle_group, logged_at DESC)
  `);
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Mapping from group key → specific muscle names (ES + EN)
const MUSCLE_GROUPS: Record<string, string[]> = {
  hombros:  ["Deltoides anterior", "Deltoides lateral", "Deltoides posterior"],
  espalda:  ["Dorsales", "Trapecios", "Romboides", "Lumbares"],
  piernas:  ["Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Aductores"],
  pecho:    ["Pectoral superior", "Pectoral medio", "Pectoral inferior"],
  brazos:   ["Bíceps", "Tríceps", "Antebrazos"],
  core:     ["Abdominales", "Oblicuos", "Lumbares"],
  shoulders: ["Anterior deltoid", "Lateral deltoid", "Posterior deltoid"],
  back:     ["Lats", "Trapezius", "Rhomboids", "Lower back"],
  legs:     ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Adductors"],
  chest:    ["Upper chest", "Middle chest", "Lower chest"],
  arms:     ["Biceps", "Triceps", "Forearms"],
};

// Reverse map: specific muscle name (lowercase) → canonical group key
// We normalise to the EN key so the frontend only deals with one set of group keys.
// ES groups are merged into their EN equivalents.
const GROUP_ALIASES: Record<string, string> = {
  hombros: "shoulders",
  espalda: "back",
  piernas: "legs",
  pecho:   "chest",
  brazos:  "arms",
};

function buildReverseMap(): Map<string, string> {
  const rev = new Map<string, string>();
  for (const [group, muscles] of Object.entries(MUSCLE_GROUPS)) {
    const canonical = GROUP_ALIASES[group] ?? group;
    for (const m of muscles) {
      rev.set(m.toLowerCase(), canonical);
    }
  }
  return rev;
}

const REVERSE_MAP = buildReverseMap();

// Return all specific muscle names that belong to a canonical group key
function musclesForGroup(groupKey: string): string[] {
  const result: string[] = [];
  for (const [group, muscles] of Object.entries(MUSCLE_GROUPS)) {
    const canonical = GROUP_ALIASES[group] ?? group;
    if (canonical === groupKey) {
      for (const m of muscles) {
        if (!result.includes(m)) result.push(m);
      }
    }
  }
  return result;
}

// GET /api/strength?muscle=X
router.get("/strength", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { muscle } = req.query as { muscle?: string };
  const pool = getPool();

  try {
    await ensureStrengthLogsTable();
    const params: any[] = [req.user.id];
    let query = `
      SELECT id, exercise_name, muscle_group, weight_kg::float, reps, logged_at::text, week_start::text
      FROM public.strength_logs
      WHERE user_id = $1
    `;
    if (muscle) {
      params.push(muscle);
      query += ` AND muscle_group = $${params.length}`;
    }
    query += ` ORDER BY logged_at DESC, created_at DESC LIMIT 100`;

    const { rows } = await pool.query(query, params);
    res.json({ logs: rows });
  } catch (err) {
    req.log.error({ err }, "[strength] GET failed");
    res.status(500).json({ error: "Failed to fetch strength logs" });
  }
});

// GET /api/strength/group?group=shoulders
// Returns logs for all specific muscles belonging to the canonical group key,
// shaped as { byMuscle: { [muscleName]: log[] }, muscles: string[] }
router.get("/strength/group", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { group } = req.query as { group?: string };
  if (!group) {
    res.status(400).json({ error: "group is required" });
    return;
  }

  const muscles = musclesForGroup(group);
  if (muscles.length === 0) {
    res.json({ byMuscle: {}, muscles: [] });
    return;
  }

  const pool = getPool();
  try {
    await ensureStrengthLogsTable();
    const placeholders = muscles.map((_, i) => `$${i + 2}`).join(", ");
    const { rows } = await pool.query(
      `SELECT id, exercise_name, muscle_group, weight_kg::float, reps, logged_at::text, week_start::text
       FROM public.strength_logs
       WHERE user_id = $1 AND muscle_group = ANY(ARRAY[${placeholders}])
       ORDER BY logged_at ASC, created_at ASC`,
      [req.user.id, ...muscles],
    );

    // Group by specific muscle
    const byMuscle: Record<string, any[]> = {};
    for (const row of rows) {
      if (!byMuscle[row.muscle_group]) byMuscle[row.muscle_group] = [];
      byMuscle[row.muscle_group].push(row);
    }
    const musclesWithData = Object.keys(byMuscle);
    res.json({ byMuscle, muscles: musclesWithData });
  } catch (err) {
    req.log.error({ err }, "[strength] group GET failed");
    res.status(500).json({ error: "Failed to fetch group logs" });
  }
});

// GET /api/strength/muscles — distinct specific muscle names the user has logged
router.get("/strength/muscles", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();

  try {
    await ensureStrengthLogsTable();
    const { rows } = await pool.query(
      `SELECT DISTINCT muscle_group FROM public.strength_logs WHERE user_id = $1 ORDER BY muscle_group`,
      [req.user.id],
    );
    res.json({ muscles: rows.map(r => r.muscle_group) });
  } catch (err) {
    req.log.error({ err }, "[strength] muscles GET failed");
    res.status(500).json({ error: "Failed to fetch muscle groups" });
  }
});

// GET /api/strength/groups — distinct canonical GROUPS the user has data for
// e.g. ["shoulders", "back"] instead of individual muscle names
router.get("/strength/groups", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const pool = getPool();

  try {
    await ensureStrengthLogsTable();
    const { rows } = await pool.query(
      `SELECT DISTINCT muscle_group FROM public.strength_logs WHERE user_id = $1`,
      [req.user.id],
    );
    const groupSet = new Set<string>();
    for (const row of rows) {
      const canonical = REVERSE_MAP.get(row.muscle_group.toLowerCase());
      if (canonical) groupSet.add(canonical);
    }
    res.json({ groups: Array.from(groupSet) });
  } catch (err) {
    req.log.error({ err }, "[strength] groups GET failed");
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// POST /api/strength  { exerciseName, muscleGroup, weightKg, reps }
router.post("/strength", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { exerciseName, muscleGroup, weightKg, reps } = req.body as {
    exerciseName?: string;
    muscleGroup?: string;
    weightKg?: number;
    reps?: number;
  };

  if (!exerciseName || !muscleGroup || weightKg == null || reps == null) {
    res.status(400).json({ error: "exerciseName, muscleGroup, weightKg and reps are required" });
    return;
  }
  if (typeof weightKg !== "number" || weightKg <= 0 || weightKg > 1000) {
    res.status(400).json({ error: "Invalid weightKg" });
    return;
  }
  if (typeof reps !== "number" || reps <= 0 || reps > 1000) {
    res.status(400).json({ error: "Invalid reps" });
    return;
  }

  const pool = getPool();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart();

  try {
    await ensureStrengthLogsTable();

    // Find previous max for PR detection
    const { rows: maxRows } = await pool.query(
      `SELECT MAX(weight_kg) as max_kg FROM public.strength_logs WHERE user_id = $1 AND exercise_name = $2`,
      [req.user.id, exerciseName],
    );
    const prevMax = maxRows[0]?.max_kg ? parseFloat(maxRows[0].max_kg) : null;

    const { rows } = await pool.query(
      `INSERT INTO public.strength_logs (user_id, exercise_name, muscle_group, weight_kg, reps, logged_at, week_start)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, exercise_name, muscle_group, weight_kg::float, reps, logged_at::text, week_start::text`,
      [req.user.id, exerciseName, muscleGroup, weightKg, reps, today, weekStart],
    );

    const isNewPR = prevMax === null || weightKg > prevMax;
    const prDelta = isNewPR && prevMax !== null ? +(weightKg - prevMax).toFixed(2) : null;

    res.json({ log: rows[0], isNewPR, prDelta, prevMax });
  } catch (err) {
    req.log.error({ err }, "[strength] POST failed");
    res.status(500).json({ error: "Failed to save strength log" });
  }
});

export default router;
