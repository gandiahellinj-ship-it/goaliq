import { Router } from "express";

const router = Router();

const WGER_BASE = "https://wger.de/api/v2";

// Language codes: 2=English, 3=Spanish
function langCode(lang: string): number {
  return lang === "es" ? 3 : 2;
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

async function buildExerciseOut(baseId: number, lang: number): Promise<WgerExerciseOut | null> {
  try {
    const info = await wgerFetch(`/exerciseinfo/${baseId}/?format=json`);

    // Find translation for the requested language (fall back to English=2)
    const translations: any[] = info.translations ?? [];
    const tr = translations.find((t: any) => t.language === lang)
      ?? translations.find((t: any) => t.language === 2)
      ?? translations[0];

    if (!tr) return null;

    const images: any[] = info.images ?? [];
    const imageStart = images[0]?.image ?? null;
    const imageEnd = images[1]?.image ?? images[0]?.image ?? null;

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
    const langParam = lang === "es" ? "spanish" : "english";
    const searchData = await wgerFetch(`/exercise/search/?term=${encodeURIComponent(q)}&language=${langParam}&format=json`);
    const suggestions: any[] = searchData.suggestions ?? [];

    if (!suggestions.length) {
      cacheSet(cacheKey, null);
      res.json({ exercise: null, imageStart: null, imageEnd: null });
      return;
    }

    const baseId: number = suggestions[0]?.data?.base_id ?? suggestions[0]?.data?.id;
    if (!baseId) {
      cacheSet(cacheKey, null);
      res.json({ exercise: null, imageStart: null, imageEnd: null });
      return;
    }

    const exercise = await buildExerciseOut(baseId, langCode(lang));
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

          const images: any[] = item.images ?? [];
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
            imageStart: images[0]?.image ?? null,
            imageEnd: images[1]?.image ?? images[0]?.image ?? null,
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
