import { Router } from "express";

const router = Router();

const WGER_BASE = "https://wger.de/api/v2";

// Language codes: 2=English, 3=Spanish
function langCode(lang: string): number {
  return lang === "es" ? 3 : 2;
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
  "peso muerto con mancuernas": "dumbbell deadlift",
  "prensa de piernas": "leg press",
  "sentadilla con mancuernas": "dumbbell squat",
  "press de banca con mancuernas": "dumbbell bench press",
  "elevaciones frontales": "front raise",
  "remo en maquina": "machine row",
  "remo en máquina": "machine row",
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
  // Try longest match first
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

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
}

// ── Wger fetch helpers ────────────────────────────────────────────────────────

async function wgerFetch(path: string): Promise<any> {
  const res = await fetch(`${WGER_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Wger fetch failed: ${res.status} ${path}`);
  return res.json();
}

interface WgerExerciseOut {
  id: number;
  name: string;
  description: string;
  muscles: string[];
  category: string;
  imageStart: string | null;
  imageEnd: string | null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

// Fetch images for an exercise base ID from the exerciseimage endpoint
async function fetchExerciseImages(baseId: number): Promise<{ imageStart: string | null; imageEnd: string | null }> {
  try {
    const data = await wgerFetch(`/exerciseimage/?exercise_base=${baseId}&format=json`);
    const images: any[] = data.results ?? [];
    if (!images.length) return { imageStart: null, imageEnd: null };
    // Filter to only main images (is_main=true first, then any)
    const mainImages = images.filter((img: any) => img.is_main);
    const ordered = mainImages.length ? mainImages : images;
    return {
      imageStart: ordered[0]?.image ?? null,
      imageEnd: ordered[1]?.image ?? ordered[0]?.image ?? null,
    };
  } catch {
    return { imageStart: null, imageEnd: null };
  }
}

async function buildExerciseOut(baseId: number, lang: number): Promise<WgerExerciseOut | null> {
  try {
    const info = await wgerFetch(`/exerciseinfo/${baseId}/?format=json`);

    // Find translation for the requested language (fall back to English=2)
    const translations: any[] = info.translations ?? [];
    const tr = translations.find((t: any) => t.language === lang)
      ?? translations.find((t: any) => t.language === 2)
      ?? translations[0];

    if (!tr) return null;

    // Try images from exerciseinfo first, then fall back to exerciseimage endpoint
    let imageStart: string | null = null;
    let imageEnd: string | null = null;

    const infoImages: any[] = info.images ?? [];
    if (infoImages.length) {
      imageStart = infoImages[0]?.image ?? null;
      imageEnd = infoImages[1]?.image ?? infoImages[0]?.image ?? null;
    }

    if (!imageStart) {
      const fetched = await fetchExerciseImages(baseId);
      imageStart = fetched.imageStart;
      imageEnd = fetched.imageEnd;
    }

    const muscles: string[] = [
      ...(info.muscles ?? []).map((m: any) => m.name_en ?? m.name ?? ""),
      ...(info.muscles_secondary ?? []).map((m: any) => m.name_en ?? m.name ?? ""),
    ].filter(Boolean);

    const categoryName = info.category?.name ?? "";

    return {
      id: baseId,
      name: tr.name ?? "",
      description: stripHtml(tr.description ?? ""),
      muscles,
      category: categoryName,
      imageStart,
      imageEnd,
    };
  } catch {
    return null;
  }
}

// Search wger by term, try both english and spanish language params
async function searchWger(term: string): Promise<number | null> {
  for (const language of ["english", "spanish"]) {
    try {
      const searchData = await wgerFetch(
        `/exercise/search/?term=${encodeURIComponent(term)}&language=${language}&format=json`,
      );
      const suggestions: any[] = searchData.suggestions ?? [];
      if (!suggestions.length) continue;
      const baseId: number = suggestions[0]?.data?.base_id ?? suggestions[0]?.data?.id;
      if (baseId) return baseId;
    } catch {
      // continue
    }
  }
  return null;
}

// ── GET /api/exercises/search?q=squat&lang=es ─────────────────────────────────

router.get("/exercises/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";

  if (!q) {
    res.status(400).json({ error: "q query param required" });
    return;
  }

  const cacheKey = `search:${q.toLowerCase()}:${lang}`;
  const cached = cacheGet<WgerExerciseOut | null>(cacheKey);
  if (cached !== null) {
    res.json({ exercise: cached, imageStart: cached?.imageStart ?? null, imageEnd: cached?.imageEnd ?? null });
    return;
  }

  try {
    // Translate Spanish → English for better matching
    const translated = translateExerciseName(q);
    const lc = langCode(lang);

    // Try search with translated name first, then original
    const searchTerms = translated !== q ? [translated, q] : [q];
    let baseId: number | null = null;

    for (const term of searchTerms) {
      baseId = await searchWger(term);
      if (baseId) break;
    }

    if (!baseId) {
      // Last resort: try just the first word of the translated name
      const firstWord = translated.split(" ")[0];
      if (firstWord.length > 3 && firstWord !== translated) {
        baseId = await searchWger(firstWord);
      }
    }

    if (!baseId) {
      cacheSet(cacheKey, null);
      res.json({ exercise: null, imageStart: null, imageEnd: null });
      return;
    }

    const exercise = await buildExerciseOut(baseId, lc);
    cacheSet(cacheKey, exercise);
    res.json({ exercise, imageStart: exercise?.imageStart ?? null, imageEnd: exercise?.imageEnd ?? null });
  } catch (err: any) {
    console.error("[wger] search error:", err.message);
    res.json({ exercise: null, imageStart: null, imageEnd: null });
  }
});

// ── GET /api/exercises/wger?muscle=10&lang=es ─────────────────────────────────

router.get("/exercises/wger", async (req, res) => {
  const muscleId = typeof req.query.muscle === "string" ? req.query.muscle : null;
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";
  const lc = langCode(lang);

  const cacheKey = `wger:muscle=${muscleId ?? "any"}:lang=${lang}`;
  const cached = cacheGet<WgerExerciseOut[]>(cacheKey);
  if (cached) {
    res.json({ exercises: cached });
    return;
  }

  try {
    let apiPath = `/exerciseinfo/?format=json&language=${lc}&limit=20`;
    if (muscleId) apiPath += `&muscles=${muscleId}`;

    const data = await wgerFetch(apiPath);
    const results: any[] = data.results ?? [];

    const exercises: WgerExerciseOut[] = (
      await Promise.all(
        results.slice(0, 12).map(async (item: any) => {
          const translations: any[] = item.translations ?? [];
          const tr = translations.find((t: any) => t.language === lc)
            ?? translations.find((t: any) => t.language === 2)
            ?? translations[0];
          if (!tr?.name) return null;

          // Try images from exerciseinfo, then fall back to exerciseimage endpoint
          let imageStart: string | null = null;
          let imageEnd: string | null = null;
          const infoImages: any[] = item.images ?? [];
          if (infoImages.length) {
            imageStart = infoImages[0]?.image ?? null;
            imageEnd = infoImages[1]?.image ?? infoImages[0]?.image ?? null;
          }
          if (!imageStart) {
            const fetched = await fetchExerciseImages(item.id);
            imageStart = fetched.imageStart;
            imageEnd = fetched.imageEnd;
          }

          const muscles: string[] = [
            ...(item.muscles ?? []).map((m: any) => m.name_en ?? m.name ?? ""),
            ...(item.muscles_secondary ?? []).map((m: any) => m.name_en ?? m.name ?? ""),
          ].filter(Boolean);

          return {
            id: item.id,
            name: tr.name,
            description: stripHtml(tr.description ?? ""),
            muscles,
            category: item.category?.name ?? "",
            imageStart,
            imageEnd,
          } as WgerExerciseOut;
        }),
      )
    ).filter((e): e is WgerExerciseOut => e !== null);

    cacheSet(cacheKey, exercises);
    res.json({ exercises });
  } catch (err: any) {
    console.error("[wger] exercises error:", err.message);
    res.json({ exercises: [] });
  }
});

export default router;
