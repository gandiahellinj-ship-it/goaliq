import { Router } from "express";

const router = Router();

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const INDEX_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

// ── Spanish → English name translation for image lookup ───────────────────────
const ES_TO_EN: Record<string, string> = {
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
  "tijeras": "scissors",
  "bicicleta": "bicycle crunch",
  "russian twist": "russian twist",
  "plancha lateral": "side plank",
  "step up": "step up",
};

function translateName(name: string): string {
  const lower = name.toLowerCase();
  const sorted = Object.entries(ES_TO_EN).sort((a, b) => b[0].length - a[0].length);
  for (const [es, en] of sorted) {
    if (lower.includes(es)) return en;
  }
  return name;
}

type ExerciseEntry = { id: string; name: string; images: string[] };
type ImageResult = { imageStart: string; imageEnd: string } | null;

let exerciseIndex: ExerciseEntry[] | null = null;
let indexLoadPromise: Promise<ExerciseEntry[]> | null = null;

async function loadIndex(): Promise<ExerciseEntry[]> {
  if (exerciseIndex) return exerciseIndex;
  if (indexLoadPromise) return indexLoadPromise;
  indexLoadPromise = (async () => {
    console.log("[exercises] loading index from GitHub...");
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
    const data: ExerciseEntry[] = await res.json();
    exerciseIndex = data;
    console.log(`[exercises] index loaded — ${data.length} exercises`);
    return data;
  })();
  return indexLoadPromise;
}

function findBestMatch(index: ExerciseEntry[], query: string): ExerciseEntry | null {
  const q = query.toLowerCase().trim();
  const exact = index.find(e => e.name.toLowerCase() === q);
  if (exact) return exact;
  const startsWith = index.find(e => e.name.toLowerCase().startsWith(q));
  if (startsWith) return startsWith;
  const contains = index.find(e => e.name.toLowerCase().includes(q));
  if (contains) return contains;
  const words = q.split(/\s+/).filter(Boolean);
  const allWords = index.find(e => {
    const n = e.name.toLowerCase();
    return words.every(w => n.includes(w));
  });
  if (allWords) return allWords;
  const anyWord = index.find(e => {
    const n = e.name.toLowerCase();
    return words.some(w => w.length > 3 && n.includes(w));
  });
  return anyWord ?? null;
}

// Cache: name key → { imageStart, imageEnd } | null
const imageCache = new Map<string, ImageResult>();

router.get("/exercises/gif", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "name query param required" });
    return;
  }

  const key = name.toLowerCase();

  if (imageCache.has(key)) {
    const cached = imageCache.get(key);
    res.json(cached ?? { imageStart: null, imageEnd: null });
    return;
  }

  try {
    const index = await loadIndex();
    const translated = translateName(key);

    // Try translated name first (handles Spanish → English), then original
    let match = translated !== key ? findBestMatch(index, translated) : null;
    if (!match) match = findBestMatch(index, key);

    console.log(`[exercises] query="${key}" translated="${translated}" → match="${match?.name ?? "none"}"`);

    if (!match || !match.images?.length) {
      imageCache.set(key, null);
      res.json({ imageStart: null, imageEnd: null });
      return;
    }

    const imageStart = `${IMAGE_BASE}${match.images[0]}`;
    const imageEnd = match.images[1]
      ? `${IMAGE_BASE}${match.images[1]}`
      : imageStart;

    console.log("[exercises] imageStart:", imageStart);
    console.log("[exercises] imageEnd:", imageEnd);

    const result: ImageResult = { imageStart, imageEnd };
    imageCache.set(key, result);
    res.json(result);
  } catch (err: any) {
    console.error("[exercises] error:", err.message);
    res.json({ imageStart: null, imageEnd: null });
  }
});

export default router;
