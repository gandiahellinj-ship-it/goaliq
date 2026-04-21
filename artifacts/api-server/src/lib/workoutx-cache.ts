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
        "SELECT id, name, body_part, target, equipment, difficulty, category FROM public.workoutx_exercises ORDER BY id"
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
        for (let i = 0; i < all.length; i += 100) {
          const batch = all.slice(i, i + 100);
          const values = batch.map((_, j) =>
            `($${j*7+1}, $${j*7+2}, $${j*7+3}, $${j*7+4}, $${j*7+5}, $${j*7+6}, $${j*7+7})`
          ).join(", ");
          const params = batch.flatMap(ex => [
            ex.id, ex.name, ex.bodyPart, ex.target, ex.equipment, ex.difficulty, ex.category
          ]);
          await pool.query(
            `INSERT INTO public.workoutx_exercises (id, name, body_part, target, equipment, difficulty, category)
             VALUES ${values}
             ON CONFLICT (id) DO NOTHING`,
            params
          );
        }
        console.log(`[workoutx-cache] Saved ${all.length} exercises to DB`);
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
