import { Router } from "express";

const router = Router();

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const INDEX_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

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
    const match = findBestMatch(index, key);

    console.log(`[exercises] query="${key}" → match="${match?.name ?? "none"}"`);

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
