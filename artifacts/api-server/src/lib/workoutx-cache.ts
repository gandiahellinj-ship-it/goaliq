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
    const key = process.env.WORKOUTX_API_KEY ?? "";
    if (!key) {
      console.warn("[workoutx-cache] No API key — skipping");
      cacheLoaded = true;
      return;
    }

    const all: WxCachedExercise[] = [];
    const pageSize = 100;
    let offset = 0;
    let total = 9999;

    console.log("[workoutx-cache] Downloading all exercises...");

    while (offset < total) {
      try {
        const res = await fetch(
          `https://api.workoutxapp.com/v1/exercises?limit=${pageSize}&offset=${offset}`,
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

        offset += pageSize;
        if (list.length < pageSize) break;
      } catch (err) {
        console.error("[workoutx-cache] Error at offset", offset, err);
        break;
      }
    }

    exerciseCache = all;
    cacheLoaded = true;
    console.log(`[workoutx-cache] Loaded ${exerciseCache.length} exercises`);
  })();

  return cacheLoadPromise;
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
