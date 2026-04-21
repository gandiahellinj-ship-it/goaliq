import { Router } from "express";
import { loadWorkoutXCache, findExerciseByName } from "../lib/workoutx-cache";

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
  equipment: string;
  instructions: string[];
}

function toOut(ex: WxExercise): WxExerciseOut {
  return {
    id: ex.id,
    name: ex.name,
    gifUrl: ex.gifUrl ?? null,
    target: ex.target ?? "",
    bodyPart: ex.bodyPart ?? "",
    equipment: ex.equipment ?? "",
    instructions: ex.instructions ?? [],
  };
}

// ── Location → equipment mapping ──────────────────────────────────────────────

const LOCATION_EQUIPMENT: Record<string, string[]> = {
  gym:     ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "ez barbell", "body weight"],
  home:    ["body weight", "resistance band", "dumbbell", "kettlebell"],
  outdoor: ["body weight", "kettlebell", "resistance band"],
};

// ── Response parsing helper ───────────────────────────────────────────────────
// WorkoutX wraps results in { total, count, data: [...] }

function parseList(data: any): WxExercise[] {
  return data.data ?? data.exercises ?? (Array.isArray(data) ? data : []);
}

async function fetchByEquipment(equipment: string, limit: number): Promise<WxExerciseOut[]> {
  const cacheKey = `wx:equipment:${equipment}`;
  const cached = cacheGet<WxExerciseOut[]>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await wxFetch(`/exercises/equipment/${encodeURIComponent(equipment)}`);
  const list = parseList(data);
  const exercises = list.slice(0, limit).map(toOut);
  cacheSet(cacheKey, exercises);
  return exercises;
}

// ── Name normalization ────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-–—]/g, " ")          // hyphens/dashes → spaces
    .replace(/[''`]s\b/g, "")        // remove possessive 's
    .replace(/\b(\w+)s\b/g, "$1")   // remove plural s: push ups → push up
    .replace(/\s+/g, " ")            // collapse spaces
    .trim();
}

const CARDIO_KEYWORDS = /\b(run|jog|walk|cycl|bike|bik|swim|cardio|sprint|skip|jump rope|treadmill|elliptic|row(ing)?|stair)\b/i;

function isCardioExercise(name: string): boolean {
  return CARDIO_KEYWORDS.test(name);
}

// Search by name using the dedicated /exercises/name/:name endpoint
async function searchByName(term: string): Promise<WxExerciseOut | null> {
  const data = await wxFetch(`/exercises/name/${encodeURIComponent(term.toLowerCase())}`);
  const list = parseList(data);
  if (!list.length) return null;
  return toOut(list[0]);
}

// ── GET /api/workoutx/exercise?name=X&lang=es ─────────────────────────────────

router.get("/api/workoutx/exercise", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";

  if (!name) {
    res.status(400).json({ error: "name query param required" });
    return;
  }

  // Cardio exercises won't have GIFs in WorkoutX — return early
  if (isCardioExercise(name)) {
    res.json({ gifUrl: null, isCardio: true });
    return;
  }

  const cacheKey = `wx:name:${name.toLowerCase()}:${lang}`;
  const cached = cacheGet<WxExerciseOut | null>(cacheKey);
  if (cached !== undefined) {
    res.json(cached ?? { gifUrl: null });
    return;
  }

  try {
    await loadWorkoutXCache();

    const translated = translateExerciseName(name);
    const normalized = normalizeName(translated);

    const exercise =
      findExerciseByName(translated) ??
      findExerciseByName(normalized) ??
      findExerciseByName(normalizeName(name)) ??
      findExerciseByName(name);

    if (exercise) {
      const result = {
        id: exercise.id,
        gifUrl: `/api/workoutx/gif/${exercise.id}`,
        name: exercise.name,
        target: exercise.target,
        bodyPart: exercise.bodyPart,
        equipment: exercise.equipment,
        instructions: [],
      };
      cacheSet(cacheKey, result);
      res.json(result);
      return;
    }

    if (isCardioExercise(name)) {
      res.json({ gifUrl: null, isCardio: true, name });
      return;
    }

    res.json({ gifUrl: null });
  } catch (err: any) {
    console.error("[workoutx] exercise search error:", err.message);
    res.json({ gifUrl: null });
  }
});

// ── GET /api/workoutx/gif/:id — proxy GIF with API key header ─────────────────

router.get("/api/workoutx/gif/:id", async (req, res) => {
  const { id } = req.params;
  const key = process.env.WORKOUTX_API_KEY ?? "";

  try {
    const response = await fetch(`https://api.workoutxapp.com/v1/gifs/${id}.gif`, {
      headers: { "X-WorkoutX-Key": key },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.status(404).json({ error: "GIF not found" });
      return;
    }

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy GIF" });
  }
});

// ── GET /api/workoutx/by-location?location=gym&limit=20 ──────────────────────

router.get("/api/workoutx/by-location", async (req, res) => {
  const location = typeof req.query.location === "string" ? req.query.location.trim().toLowerCase() : "gym";
  const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10) || 20, 100) : 20;

  const equipmentList = LOCATION_EQUIPMENT[location] ?? LOCATION_EQUIPMENT.gym;
  const cacheKey = `wx:location:${location}:${limit}`;
  const cached = cacheGet<WxExerciseOut[]>(cacheKey);
  if (cached !== undefined) {
    res.json({ exercises: cached, equipment: equipmentList });
    return;
  }

  try {
    const perEquipment = Math.max(3, Math.ceil(limit / equipmentList.length));
    const results = await Promise.allSettled(
      equipmentList.map(eq => fetchByEquipment(eq, perEquipment)),
    );

    const seen = new Set<string>();
    const exercises: WxExerciseOut[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const ex of r.value) {
        if (!seen.has(ex.id)) { seen.add(ex.id); exercises.push(ex); }
      }
    }

    const trimmed = exercises.slice(0, limit);
    cacheSet(cacheKey, trimmed);
    res.json({ exercises: trimmed, equipment: equipmentList });
  } catch (err: any) {
    console.error("[workoutx] by-location error:", err.message);
    res.json({ exercises: [], equipment: equipmentList });
  }
});

// ── GET /api/workoutx/equipment?type=barbell&limit=20 ─────────────────────────

router.get("/api/workoutx/equipment", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
  const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10) || 20, 100) : 20;

  if (!type) {
    res.status(400).json({ error: "type query param required" });
    return;
  }

  try {
    const exercises = await fetchByEquipment(type, limit);
    res.json({ exercises });
  } catch (err: any) {
    console.error("[workoutx] equipment error:", err.message);
    res.json({ exercises: [] });
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
    const list = parseList(data);
    const exercises = list.slice(0, 20).map(toOut);
    cacheSet(cacheKey, exercises);
    res.json({ exercises });
  } catch (err: any) {
    console.error("[workoutx] muscle target error:", err.message);
    res.json({ exercises: [] });
  }
});

export default router;
