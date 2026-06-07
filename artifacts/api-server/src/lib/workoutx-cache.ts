import pg from "pg";

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export type WxCachedExercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  difficulty: string;
  category: string;
  // v0.9.11 — enrichment fields. Default values used when DB has NULL
  // (pre-enrichment rows) so consumers can rely on field presence.
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl: string;
  mechanic: string;
  force: string;
  description: string;
  met: number;
  caloriesPerMinute: number;
};

const GYM_EQUIPMENT = new Set([
  "barbell", "dumbbell", "cable", "leverage machine",
  "smith machine", "ez barbell", "assisted", "body weight"
]);
const HOME_EQUIPMENT = new Set([
  "body weight", "resistance band", "dumbbell", "kettlebell"
]);
const OUTDOOR_EQUIPMENT = new Set([
  "body weight", "kettlebell", "resistance band"
]);

let exerciseCache: WxCachedExercise[] = [];
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;

export async function loadWorkoutXCache(): Promise<void> {
  if (cacheLoaded) return;
  if (cacheLoadPromise) return cacheLoadPromise;

  cacheLoadPromise = (async () => {
    const pool = getPool();

    // Try loading from DB first
    try {
      const { rows } = await pool.query(
        `SELECT
           id, name, body_part, target, equipment, difficulty, category,
           secondary_muscles, instructions, gif_url, mechanic, force,
           description, met, calories_per_minute
         FROM public.workoutx_exercises
         ORDER BY id`
      );

      if (rows.length > 0) {
        exerciseCache = rows.map(r => ({
          id: r.id,
          name: r.name,
          bodyPart: r.body_part,
          target: r.target,
          equipment: r.equipment,
          difficulty: r.difficulty,
          category: r.category,
          // JSONB columns are already parsed by pg.
          secondaryMuscles: Array.isArray(r.secondary_muscles) ? r.secondary_muscles : [],
          instructions: Array.isArray(r.instructions) ? r.instructions : [],
          gifUrl: r.gif_url ?? "",
          mechanic: r.mechanic ?? "",
          force: r.force ?? "",
          description: r.description ?? "",
          // pg returns NUMERIC as string by default — coerce to number.
          met: r.met != null ? parseFloat(r.met) : 0,
          caloriesPerMinute: r.calories_per_minute != null ? parseFloat(r.calories_per_minute) : 0,
        }));
        cacheLoaded = true;
        console.log(`[workoutx-cache] Loaded ${exerciseCache.length} exercises from DB`);
        return;
      }
    } catch (err) {
      console.warn("[workoutx-cache] DB load failed, falling back to API:", err);
    }

    // DB empty — download from API and save
    const key = process.env.WORKOUTX_API_KEY ?? "";
    if (!key) {
      console.warn("[workoutx-cache] No API key");
      cacheLoaded = true;
      return;
    }

    const all: WxCachedExercise[] = [];
    let offset = 0;
    let total = 9999;
    let pageCount = 0;

    console.log("[workoutx-cache] DB empty — downloading from WorkoutX API...");

    while (offset < total) {
      try {
        const res = await fetch(
          `https://api.workoutxapp.com/v1/exercises?limit=10&offset=${offset}`,
          { headers: { "X-WorkoutX-Key": key }, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) { console.error("[workoutx-cache] HTTP", res.status); break; }

        const data = await res.json();
        const list: any[] = data.data ?? data.exercises ?? (Array.isArray(data) ? data : []);
        total = data.total ?? list.length;

        for (const ex of list) {
          if (ex.id && ex.name) {
            all.push({
              id: ex.id,
              name: ex.name,
              bodyPart: ex.bodyPart ?? "",
              target: ex.target ?? "",
              equipment: ex.equipment ?? "",
              difficulty: ex.difficulty ?? "",
              category: ex.category ?? "",
              // v0.9.11 — enrichment fields.
              secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
              instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
              gifUrl: ex.gifUrl ?? "",
              mechanic: ex.mechanic ?? "",
              force: ex.force ?? "",
              description: ex.description ?? "",
              met: typeof ex.met === "number" ? ex.met : 0,
              caloriesPerMinute: typeof ex.caloriesPerMinute === "number" ? ex.caloriesPerMinute : 0,
            });
          }
        }

        pageCount++;
        offset += 10;
        if (list.length < 10) break;

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error("[workoutx-cache] Error at offset", offset, err);
        break;
      }
    }

    console.log(`[workoutx-cache] Downloaded ${all.length} exercises in ${pageCount} pages`);

    // Save to DB in batches of 100
    if (all.length > 0) {
      try {
        // v0.9.11 — 15 columns per row + ON CONFLICT DO UPDATE on enrichment
        // fields only. Legacy fields (name, body_part, target, equipment,
        // difficulty, category) are NOT overwritten on conflict — preserves
        // any manual fixes and avoids churning existing data unnecessarily.
        const COLS_PER_ROW = 15;
        for (let i = 0; i < all.length; i += 100) {
          const batch = all.slice(i, i + 100);
          const values = batch.map((_, j) => {
            const base = j * COLS_PER_ROW;
            const ph = (off: number) => `$${base + off}`;
            return `(${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},${ph(7)},${ph(8)}::jsonb,${ph(9)}::jsonb,${ph(10)},${ph(11)},${ph(12)},${ph(13)},${ph(14)},${ph(15)})`;
          }).join(", ");
          const params = batch.flatMap(ex => [
            ex.id, ex.name, ex.bodyPart, ex.target, ex.equipment, ex.difficulty, ex.category,
            JSON.stringify(ex.secondaryMuscles ?? []),
            JSON.stringify(ex.instructions ?? []),
            ex.gifUrl || null,
            ex.mechanic || null,
            ex.force || null,
            ex.description || null,
            ex.met || null,
            ex.caloriesPerMinute || null,
          ]);
          await pool.query(
            `INSERT INTO public.workoutx_exercises
               (id, name, body_part, target, equipment, difficulty, category,
                secondary_muscles, instructions, gif_url, mechanic, force,
                description, met, calories_per_minute)
             VALUES ${values}
             ON CONFLICT (id) DO UPDATE SET
               secondary_muscles    = EXCLUDED.secondary_muscles,
               instructions         = EXCLUDED.instructions,
               gif_url              = EXCLUDED.gif_url,
               mechanic             = EXCLUDED.mechanic,
               force                = EXCLUDED.force,
               description          = EXCLUDED.description,
               met                  = EXCLUDED.met,
               calories_per_minute  = EXCLUDED.calories_per_minute`,
            params
          );
        }
        console.log(`[workoutx-cache] Saved ${all.length} exercises to DB (enriched)`);
      } catch (err) {
        console.error("[workoutx-cache] Failed to save to DB:", err);
      }
    }

    exerciseCache = all;
    cacheLoaded = true;
    console.log(`[workoutx-cache] Cache ready with ${exerciseCache.length} exercises`);
  })();

  return cacheLoadPromise;
}

export async function resetWorkoutXCache(): Promise<void> {
  exerciseCache = [];
  cacheLoaded = false;
  cacheLoadPromise = null;
}

export function getExerciseCache(): WxCachedExercise[] { return exerciseCache; }
export function getExerciseById(id: string) { return exerciseCache.find(e => e.id === id); }

export function getExercisesByLocation(location: string): WxCachedExercise[] {
  const allowed = location?.toLowerCase() === "home" ? HOME_EQUIPMENT
    : location?.toLowerCase() === "outdoor" ? OUTDOOR_EQUIPMENT
    : GYM_EQUIPMENT;
  return exerciseCache.filter(e => allowed.has(e.equipment.toLowerCase()));
}

export function getExercisesByLocationAndLevel(location: string, level: string): WxCachedExercise[] {
  const byLocation = getExercisesByLocation(location);
  const l = level?.toLowerCase();
  const loc = location?.toLowerCase();
  if ((l === "beginner" || l === "principiante") && loc === "gym") {
    return byLocation.filter(e => e.difficulty === "beginner");
  }
  if ((l === "intermediate" || l === "intermedio") && loc === "gym") {
    return byLocation.filter(e => ["beginner", "intermediate"].includes(e.difficulty));
  }
  return byLocation;
}

export function findExerciseByName(name: string): WxCachedExercise | undefined {
  const lower = name.toLowerCase();
  return (
    exerciseCache.find(e => e.name.toLowerCase() === lower) ??
    exerciseCache.find(e => e.name.toLowerCase().includes(lower)) ??
    exerciseCache.find(e => lower.includes(e.name.toLowerCase()))
  );
}

export async function getDbExerciseCount(): Promise<number> {
  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT COUNT(*)::int AS cnt FROM public.workoutx_exercises");
    return rows[0]?.cnt ?? 0;
  } catch {
    return -1;
  }
}

export async function clearDbExercises(): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM public.workoutx_exercises");
}
