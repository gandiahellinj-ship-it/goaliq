import { Router } from "express";

const router = Router();

const WORKOUTX_BASE = "https://api.workoutxapp.com/v1";

function workoutxHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "X-WorkoutX-Key": process.env.WORKOUTX_API_KEY ?? "",
  };
}

// ── Spanish → English exercise name map ───────────────────────────────────────

const ES_TO_EN_EXERCISES: Record<string, string> = {
  "press de banca": "bench press",
  "sentadilla": "squat",
  "peso muerto": "deadlift",
  "dominadas": "pull up",
  "fondos": "dips",
  "curl de biceps": "bicep curl",
  "curl de bíceps": "bicep curl",
  "extension de triceps": "tricep extension",
  "extensión de tríceps": "tricep extension",
  "press militar": "overhead press",
  "remo con barra": "barbell row",
  "plancha": "plank",
  "flexiones": "push up",
  "zancadas": "lunge",
  "hip thrust": "hip thrust",
  "press inclinado": "incline press",
  "aperturas": "chest fly",
  "jalon al pecho": "lat pulldown",
  "jalón al pecho": "lat pulldown",
  "remo en polea": "cable row",
  "elevaciones laterales": "lateral raise",
  "face pull": "face pull",
  "crunch abdominal": "crunch",
  "abdominales": "crunch",
  "leg press": "leg press",
  "extension de cuadriceps": "leg extension",
  "extensión de cuádriceps": "leg extension",
  "curl femoral": "leg curl",
  "gemelos de pie": "calf raise",
  "pantorrillas": "calf raise",
  "prensa de hombros": "shoulder press",
  "encogimientos": "shrug",
  "remo con mancuerna": "dumbbell row",
  "curl martillo": "hammer curl",
  "press frances": "skull crusher",
  "press francés": "skull crusher",
  "pull over": "pullover",
  "buenos dias": "good morning",
  "buenos días": "good morning",
  "peso muerto rumano": "romanian deadlift",
  "sentadilla bulgara": "bulgarian split squat",
  "sentadilla búlgara": "bulgarian split squat",
  "step up": "step up",
  "burpees": "burpee",
  "mountain climbers": "mountain climber",
  "press de hombros": "shoulder press",
  "press de hombros con mancuernas": "dumbbell shoulder press",
  "remo al menton": "upright row",
  "remo al mentón": "upright row",
  "patada de triceps": "tricep kickback",
  "patada de tríceps": "tricep kickback",
  "curl concentrado": "concentration curl",
  "superman": "superman",
  "puente de gluteos": "glute bridge",
  "puente de glúteos": "glute bridge",
  "prensa de piernas": "leg press",
  "sentadilla con mancuernas": "dumbbell squat",
  "press de banca con mancuernas": "dumbbell bench press",
  "elevaciones frontales": "front raise",
  "extension de espalda": "back extension",
  "extensión de espalda": "back extension",
  "hiperextension": "back extension",
  "tijeras": "scissors kick",
  "bicicleta": "bicycle crunch",
  "russian twist": "russian twist",
  "plancha lateral": "side plank",
  "dead hang": "dead hang",
  "wall sit": "wall sit",
};

function translateExerciseName(name: string): string {
  const lower = name.toLowerCase();
  const sorted = Object.entries(ES_TO_EN_EXERCISES).sort((a, b) => b[0].length - a[0].length);
  for (const [es, en] of sorted) {
    if (lower.includes(es)) return en;
  }
  return name;
}

// ── In-memory cache (1-hour TTL) ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
}

// ── WorkoutX API fetch ────────────────────────────────────────────────────────

async function wxFetch(path: string): Promise<any> {
  const res = await fetch(`${WORKOUTX_BASE}${path}`, {
    headers: workoutxHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WorkoutX fetch failed: ${res.status} ${path}`);
  return res.json();
}

interface WxExercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  secondaryMuscles: string[];
  instructions: string[];
}

interface WxExerciseOut {
  id: string;
  name: string;
  gifUrl: string | null;
  target: string;
  bodyPart: string;
  instructions: string[];
}

function toOut(ex: WxExercise): WxExerciseOut {
  return {
    id: ex.id,
    name: ex.name,
    gifUrl: ex.gifUrl ?? null,
    target: ex.target ?? "",
    bodyPart: ex.bodyPart ?? "",
    instructions: ex.instructions ?? [],
  };
}

// Search all exercises and find best match by name
async function searchByName(term: string): Promise<WxExerciseOut | null> {
  const lower = term.toLowerCase();

  // Fetch all exercises (WorkoutX returns paginated list)
  const data = await wxFetch(`/exercises?limit=1300&offset=0`);
  const list: WxExercise[] = Array.isArray(data) ? data : (data.exercises ?? data.data ?? []);

  if (!list.length) return null;

  // Exact match
  let match = list.find(e => e.name.toLowerCase() === lower);
  if (match) return toOut(match);

  // Starts with
  match = list.find(e => e.name.toLowerCase().startsWith(lower));
  if (match) return toOut(match);

  // Contains full term
  match = list.find(e => e.name.toLowerCase().includes(lower));
  if (match) return toOut(match);

  // All words match
  const words = lower.split(/\s+/).filter(Boolean);
  match = list.find(e => {
    const n = e.name.toLowerCase();
    return words.every(w => n.includes(w));
  });
  if (match) return toOut(match);

  // Any significant word matches
  match = list.find(e => {
    const n = e.name.toLowerCase();
    return words.some(w => w.length > 3 && n.includes(w));
  });
  return match ? toOut(match) : null;
}

// ── GET /api/workoutx/exercise?name=X&lang=es ─────────────────────────────────

router.get("/api/workoutx/exercise", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";

  if (!name) {
    res.status(400).json({ error: "name query param required" });
    return;
  }

  const cacheKey = `wx:name:${name.toLowerCase()}:${lang}`;
  const cached = cacheGet<WxExerciseOut | null>(cacheKey);
  if (cached !== undefined) {
    res.json(cached ?? { gifUrl: null });
    return;
  }

  try {
    const translated = translateExerciseName(name);
    const searchTerms = translated.toLowerCase() !== name.toLowerCase()
      ? [translated, name]
      : [name];

    let result: WxExerciseOut | null = null;
    for (const term of searchTerms) {
      result = await searchByName(term);
      if (result?.gifUrl) break;
    }

    // Last resort: try first significant word
    if (!result?.gifUrl) {
      const firstWord = translated.split(" ")[0];
      if (firstWord.length > 3 && firstWord !== translated) {
        result = await searchByName(firstWord);
      }
    }

    cacheSet(cacheKey, result);
    res.json(result ?? { gifUrl: null });
  } catch (err: any) {
    console.error("[workoutx] exercise search error:", err.message);
    res.json({ gifUrl: null });
  }
});

// ── GET /api/workoutx/muscle?target=biceps ────────────────────────────────────

router.get("/api/workoutx/muscle", async (req, res) => {
  const target = typeof req.query.target === "string" ? req.query.target.trim() : "";

  if (!target) {
    res.status(400).json({ error: "target query param required" });
    return;
  }

  const cacheKey = `wx:muscle:${target.toLowerCase()}`;
  const cached = cacheGet<WxExerciseOut[]>(cacheKey);
  if (cached !== undefined) {
    res.json({ exercises: cached });
    return;
  }

  try {
    const data = await wxFetch(`/exercises/target/${encodeURIComponent(target.toLowerCase())}`);
    const list: WxExercise[] = Array.isArray(data) ? data : (data.exercises ?? data.data ?? []);
    const exercises = list.slice(0, 20).map(toOut);
    cacheSet(cacheKey, exercises);
    res.json({ exercises });
  } catch (err: any) {
    console.error("[workoutx] muscle target error:", err.message);
    res.json({ exercises: [] });
  }
});

export default router;
