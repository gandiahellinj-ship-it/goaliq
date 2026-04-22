import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { loadWorkoutXCache, getExercisesByLocationAndLevel } from "./workoutx-cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

// ── WorkoutX exercise pool ────────────────────────────────────────────────────

type WxPoolEntry = { name: string; id: string; target: string; equipment: string };

async function getExercisePool(location: string, level: string): Promise<WxPoolEntry[]> {
  await loadWorkoutXCache();
  const exercises = getExercisesByLocationAndLevel(location, level);

  const byTarget = new Map<string, typeof exercises>();
  for (const ex of exercises) {
    const t = ex.target.toLowerCase();
    if (!byTarget.has(t)) byTarget.set(t, []);
    byTarget.get(t)!.push(ex);
  }

  const pool: WxPoolEntry[] = [];
  for (const exList of byTarget.values()) {
    const shuffled = [...exList].sort(() => Math.random() - 0.5).slice(0, 15);
    for (const ex of shuffled) {
      pool.push({ name: ex.name, id: ex.id, target: ex.target, equipment: ex.equipment });
    }
  }

  console.log(`[aiGenerators] Pool: ${pool.length} exercises for ${location}/${level}`);
  return pool;
}

function reconcileExerciseIds(
  days: any[],
  wxMap: Map<string, string>,
  wxNameMap: Map<string, string>,
): any[] {
  return days.map(day => ({
    ...day,
    exercises: day.exercises.map((ex: any) => {
      // If AI returned a valid ID, trust it but overwrite name with exact WorkoutX name
      if (ex.exercise_id && wxNameMap.has(ex.exercise_id)) {
        return { ...ex, exercise_id: ex.exercise_id, name: wxNameMap.get(ex.exercise_id)! };
      }
      // Try exact name match
      const exactId = wxMap.get(ex.name.toLowerCase());
      if (exactId) {
        return { ...ex, exercise_id: exactId, name: wxNameMap.get(exactId) ?? ex.name };
      }
      // Partial match — any significant word from the exercise name appears in a WorkoutX name
      const words = ex.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      for (const [wxName, wxId] of wxMap.entries()) {
        if (words.some((w: string) => wxName.includes(w))) {
          return { ...ex, exercise_id: wxId, name: wxNameMap.get(wxId) ?? ex.name };
        }
      }
      return ex;
    }),
  }));
}

function getMealSystem(lang: "es" | "en"): string {
  if (lang === "en") {
    return "You are a professional nutritionist. LANGUAGE REQUIRED: Generate ALL content in English (UK). All meal names, ingredient names, portions, notes, and descriptions must be in English. Use internationally recognisable food terminology. You create personalised, realistic, and enjoyable weekly meal plans. You always respond with valid JSON only — no markdown, no explanation, no code blocks. Just raw JSON.";
  }
  return "You are a professional nutritionist. IMPORTANT: Generate ALL content in Spanish (Spain). All meal names, ingredient names, portions, notes, and descriptions must be in Spanish. Use Spanish food terminology and typical Spanish/Mediterranean foods when appropriate. You create personalized, realistic, and enjoyable weekly meal plans. You always respond with valid JSON only — no markdown, no explanation, no code blocks. Just raw JSON.";
}

function getWorkoutSystem(lang: "es" | "en"): string {
  if (lang === "en") {
    return "You are a professional personal trainer. LANGUAGE REQUIRED: Generate ALL content in English (UK). All exercise names, notes, warmup/cooldown descriptions, motivational phrases, and any other text must be in English. You create safe, effective, and personalised weekly training plans. You always respond with valid JSON only — no markdown, no explanation, no code blocks. Just raw JSON.";
  }
  return "Eres un entrenador personal profesional. IMPORTANTE: Genera TODO el contenido en español de España. Todos los nombres de ejercicios, notas, descripciones de calentamiento, enfriamiento, frases motivacionales y cualquier otro texto deben estar en español. Creas planes de entrenamiento semanales seguros, efectivos y personalizados. Siempre respondes únicamente con JSON válido — sin markdown, sin explicaciones, sin bloques de código. Solo JSON puro.";
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

function parseJsonSafely(text: string): unknown {
  const cleaned = stripMarkdown(text);

  // 1. Standard parse
  try { return JSON.parse(cleaned); } catch {}

  // 2. JSON repair (handles missing commas, trailing commas, etc.)
  try { return JSON.parse(jsonrepair(cleaned)); } catch {}

  // 3. Extract first array/object block and repair
  const block = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)?.[1];
  if (block) {
    try { return JSON.parse(block); } catch {}
    try { return JSON.parse(jsonrepair(block)); } catch {}
  }

  throw new Error("AI response was not valid JSON");
}

async function callClaude(system: string, userPrompt: string, maxTokens: number, model: string = MODEL): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

async function callClaudeWithRetry<T>(
  system: string,
  prompt: string,
  maxTokens: number,
  validate: (parsed: unknown) => parsed is T,
  model: string = MODEL,
): Promise<T> {
  const firstText = await callClaude(system, prompt, maxTokens, model);
  console.log("[aiGenerators] attempt 1 raw response length:", firstText?.length);
  console.log("[aiGenerators] attempt 1 raw response (first 500 chars):", firstText?.slice(0, 500));
  let firstParsed: unknown;
  try {
    firstParsed = parseJsonSafely(firstText);
  } catch (parseErr: any) {
    console.log("[aiGenerators] attempt 1 JSON parse error:", parseErr?.message);
    firstParsed = null;
  }
  console.log("[aiGenerators] attempt 1 parsed type:", Array.isArray(firstParsed) ? `array[${(firstParsed as any[]).length}]` : typeof firstParsed);
  if (validate(firstParsed)) return firstParsed;

  console.log("[aiGenerators] attempt 1 failed validation — retrying with strict prompt");

  const strictPrompt =
    prompt +
    "\n\nIMPORTANT: Return ONLY a raw JSON array. No text before or after. No markdown. No backticks.";
  const retryText = await callClaude(system, strictPrompt, maxTokens, model);
  console.log("[aiGenerators] attempt 2 raw response length:", retryText?.length);
  console.log("[aiGenerators] attempt 2 raw response (first 500 chars):", retryText?.slice(0, 500));
  let retryParsed: unknown;
  try {
    retryParsed = parseJsonSafely(retryText);
  } catch (parseErr: any) {
    console.log("[aiGenerators] attempt 2 JSON parse error:", parseErr?.message);
    retryParsed = null;
  }
  console.log("[aiGenerators] attempt 2 parsed type:", Array.isArray(retryParsed) ? `array[${(retryParsed as any[]).length}]` : typeof retryParsed);
  if (validate(retryParsed)) return retryParsed;

  throw new Error(`Plan generation failed after retry. attempt1Length=${firstText?.length}, attempt2Length=${retryText?.length}`);
}

// ─── Spanish ingredient categorization ────────────────────────────────────────

const SPANISH_CATEGORY_MAP: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ["pollo", "pechuga", "ternera", "salmón", "salmon", "atún", "atun", "huevo", "huevos",
               "gambas", "lentejas", "garbanzos", "tofu", "cerdo", "carne", "merluza", "bacalao",
               "sardinas", "filete", "lomo", "pavo", "jamón", "jamon", "chorizo", "proteína", "proteina",
               "anchoa", "pulpo", "mejillón", "mejillon", "dorada", "lubina", "rape", "calamar"],
    category: "protein",
  },
  {
    keywords: ["arroz", "pasta", "pan", "avena", "quinoa", "quinoá", "patata", "boniato", "harina",
               "macarrones", "espagueti", "espaguetis", "cereal", "maíz", "maiz", "galleta", "rebanada",
               "tortilla de maíz", "lenteja", "garbanzo", "alubia", "judía", "judias", "frijol"],
    category: "carbs",
  },
  {
    keywords: ["espinacas", "lechuga", "tomate", "pepino", "zanahoria", "cebolla", "pimiento", "brócoli",
               "brocoli", "calabacín", "calabacin", "champiñones", "champinones", "ajo", "apio",
               "rúcula", "rucula", "col", "berenjena", "coliflor", "alcachofa", "verdura", "ensalada",
               "vegetal", "acelga", "perejil", "albahaca", "cilantro", "tomillo", "romero", "orégano",
               "oregano", "cebolleta", "puerro", "nabo", "remolacha", "alcaparra"],
    category: "vegetables",
  },
  {
    keywords: ["leche", "yogur", "queso", "mantequilla", "nata", "lácteo", "lacteo", "kéfir", "kefir",
               "requesón", "requeson", "mozzarella", "parmesano", "feta", "ricotta"],
    category: "dairy",
  },
  {
    keywords: ["aceite", "aguacate", "nueces", "almendras", "semillas", "cacahuete", "tahini", "grasa",
               "mantequilla de cacahuete", "mantequilla de almendras", "anacardo", "pistachos",
               "pipas", "linaza", "chía", "chia", "sésamo", "sesamo"],
    category: "fats",
  },
  {
    keywords: ["manzana", "plátano", "platano", "naranja", "fresas", "fresa", "uvas", "limón", "limon",
               "mango", "melocotón", "melocoton", "arándanos", "arandanos", "kiwi", "pera", "ciruela",
               "fruta", "frambuesas", "cerezas", "piña", "pina", "sandía", "sandia", "melón", "melon",
               "higos", "dátiles", "datiles", "papaya", "granada", "mora"],
    category: "fruit",
  },
];

export function inferCategory(ingredientName: string): string {
  const lower = ingredientName.toLowerCase();
  for (const { keywords, category } of SPANISH_CATEGORY_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "other";
}

// ─── Ingredient sanitization (kept for replaceIngredient) ─────────────────────

const VALID_CATEGORIES = new Set(["protein", "carbs", "vegetables", "fats", "dairy", "fruit", "other"]);

function sanitizeIngredient(raw: unknown): { name: string; amount: string; category: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const amount =
    typeof obj.amount === "string" && obj.amount.trim() ? obj.amount.trim() : "—";
  const rawCat =
    typeof obj.category === "string" ? obj.category.trim().toLowerCase() : "";
  const category = VALID_CATEGORIES.has(rawCat) ? rawCat : "other";
  const visual_ref = typeof obj.visual_ref === "string" && obj.visual_ref.trim() ? obj.visual_ref.trim() : undefined;
  return { name, amount, category, visual_ref };
}

// ─── Meal plan ────────────────────────────────────────────────────────────────

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const SPANISH_DAY_MAP: Record<string, string> = {
  // Spanish names (with and without accents)
  lunes: "monday", martes: "tuesday", "miércoles": "wednesday", miercoles: "wednesday",
  jueves: "thursday", viernes: "friday", "sábado": "saturday", sabado: "saturday",
  domingo: "sunday",
  // English full names — in case Haiku returns English instead of Spanish
  monday: "monday", tuesday: "tuesday", wednesday: "wednesday",
  thursday: "thursday", friday: "friday", saturday: "saturday", sunday: "sunday",
  // Common abbreviations
  mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday",
  fri: "friday", sat: "saturday", sun: "sunday",
};

// Reverse map: English internal names → Spanish — used to force English day_names
// returned by the AI back to Spanish before the standard normalizeDay bucketing.
const ENGLISH_TO_SPANISH_DAY: Record<string, string> = {
  monday: "lunes", tuesday: "martes", wednesday: "miércoles",
  thursday: "jueves", friday: "viernes", saturday: "sábado", sunday: "domingo",
  mon: "lunes", tue: "martes", wed: "miércoles", thu: "jueves",
  fri: "viernes", sat: "sábado", sun: "domingo",
};

function normalizeDay(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SPANISH_DAY_MAP[lower] ?? lower;
}

function isFlatMealChunk9(val: unknown): val is any[] {
  return Array.isArray(val) && val.length >= 9;
}

function isFlatMealChunk3(val: unknown): val is any[] {
  return Array.isArray(val) && val.length >= 3;
}

function flatMealsToNestedDays(flatMeals: any[]): any[] {
  const byDay: Record<string, any[]> = {};
  for (const d of ALL_DAYS) byDay[d] = [];

  for (const meal of flatMeals) {
    const rawDay = (meal.day_name ?? "").toLowerCase().trim();
    // Convert any English day name to Spanish first, then normalizeDay maps to ALL_DAYS format
    const asSpanish = ENGLISH_TO_SPANISH_DAY[rawDay] ?? meal.day_name ?? "";
    const dayName = normalizeDay(asSpanish);
    if (!(dayName in byDay)) continue;

    // Normalize ingredients — ensure each has a category (infer from Spanish keywords if missing)
    const rawIngredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    const ingredients = rawIngredients.map((ing: any) => {
      if (!ing || typeof ing !== "object") return ing;
      const existingCat = typeof ing.category === "string" && VALID_CATEGORIES.has(ing.category.toLowerCase())
        ? ing.category.toLowerCase() : null;
      return {
        ...ing,
        category: existingCat ?? inferCategory(ing.name ?? ""),
      };
    });

    const PADDING_INGREDIENTS = [
      { name: "Aceite de oliva", amount: "1 cucharada", visual_ref: "1 cda", category: "fats" },
      { name: "Sal", amount: "al gusto", visual_ref: "al gusto", category: "other" },
      { name: "Verduras de temporada", amount: "100g", visual_ref: "1 puñado", category: "vegetables" },
    ];
    const paddedIngredients = [...ingredients];
    for (let pi = 0; paddedIngredients.length < 3; pi++) {
      paddedIngredients.push(PADDING_INGREDIENTS[pi % PADDING_INGREDIENTS.length]);
    }

    byDay[dayName].push({
      mealType: (meal.meal_type ?? "other").toLowerCase(),
      name: typeof meal.meal_name === "string" && meal.meal_name.trim() ? meal.meal_name.trim() : "Meal",
      ingredients: paddedIngredients,
      plate_distribution: meal.plate_distribution ?? {},
      calories: meal.calories_approx ?? 0,
      notes: meal.notes ?? "",
    });
  }

  return ALL_DAYS.map((day) => ({ day, meals: byDay[day] }));
}

export async function generateMealPlanForUser(profile: {
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  goalType: string;
  dietType: string;
  allergies: string[];
  likedFoods: string[];
  dislikedFoods: string[];
  trainingDaysPerWeek: number;
  [key: string]: unknown;
}, lang: "es" | "en" = "es") {
  const allergies = (profile.allergies as string[]).filter(Boolean);
  const dislikedFoods = (profile.dislikedFoods as string[]).filter(Boolean);
  const likedFoods = (profile.likedFoods as string[]).filter(Boolean);
  const name = typeof (profile as any).fullName === "string" ? (profile as any).fullName : "the user";

  const goalPace = (profile as any).goalPace ?? "moderate";
  const paceGuidance: Record<string, string> = {
    gentle:     "Use a small caloric adjustment (±250 kcal/day). Prioritise sustainability and muscle preservation over speed.",
    moderate:   "Use a moderate caloric adjustment (±500 kcal/day). Balance progress with long-term adherence.",
    aggressive: "Use a larger caloric adjustment (±750-1000 kcal/day). Maximise rate of change while maintaining nutritional adequacy.",
  };

  const fastingProtocol = (profile as any).fastingProtocol as string | null | undefined;
  const fastingWindows: Record<string, string> = {
    "12:12": "12-hour eating window (e.g. 08:00–20:00). Distribute all meals within this window.",
    "16:8":  "8-hour eating window (e.g. 12:00–20:00). No breakfast — first meal at noon.",
    "18:6":  "6-hour eating window (e.g. 13:00–19:00). Two meals max within the window.",
    "20:4":  "4-hour eating window (e.g. 16:00–20:00). One main meal plus a small meal within the window.",
    "5:2":   "5 normal days, 2 restricted days (~500 kcal each). Mark restricted days with very low-calorie meals.",
  };
  const fastingInstruction = fastingProtocol && fastingProtocol !== "none"
    ? `FASTING: User practices ${fastingProtocol} intermittent fasting. ${fastingWindows[fastingProtocol] ?? ""} Do NOT schedule breakfast outside the eating window.`
    : null;

  const personContext = `Person:
- Name: ${name}
- Goal: ${profile.goalType.replace(/_/g, " ")}
- Goal pace: ${goalPace} — ${paceGuidance[goalPace] ?? paceGuidance.moderate}
- Diet type: ${profile.dietType.replace(/_/g, " ")}
- Fasting protocol: ${fastingProtocol ?? "none"}
- Allergies: ${allergies.join(", ") || "none"}
- Disliked foods: ${dislikedFoods.join(", ") || "none"}
- Liked foods (include when possible): ${likedFoods.join(", ") || "none"}
- Current weight: ${profile.weightKg}kg${profile.targetWeightKg ? ` | Target weight: ${profile.targetWeightKg}kg` : ""}
- Age: ${profile.age}, Sex: ${profile.sex}${fastingInstruction ? `\n\n${fastingInstruction}` : ""}`;

  const langInstruction = lang === "en"
    ? "LANGUAGE REQUIRED: All content must be in English (UK). Meal names, ingredient names, notes — everything in English."
    : "IDIOMA OBLIGATORIO: Todo el contenido debe estar en español de España. Nombres de comidas, ingredientes, notas — todo en español.";

  const dayNames = lang === "en"
    ? { chunk1: "monday, tuesday, wednesday", chunk2: "thursday, friday, saturday", chunk3: "sunday" }
    : { chunk1: "lunes, martes, miércoles", chunk2: "jueves, viernes, sábado", chunk3: "domingo" };

  const dayNameRule = lang === "en"
    ? "- CRITICAL: Use ONLY these exact English day names: monday, tuesday, wednesday, thursday, friday, saturday, sunday."
    : "- CRITICAL: Use ONLY these exact Spanish day names: lunes, martes, miércoles, jueves, viernes, sábado, domingo. Never use English day names.";

  const paddingNote = lang === "en"
    ? "Add olive oil, salt, or seasonal vegetables if needed."
    : "Add aceite de oliva, sal, or vegetables if needed.";

  const schemaInstructions = `Each object must follow this exact schema:
{
  "day_name": string (day name in lowercase),
  "meal_type": string (breakfast | lunch | dinner),
  "meal_name": string,
  "ingredients": [{ "name": string, "amount": string, "visual_ref": string, "category": string (protein | carbs | vegetables | fats | dairy | fruit | other) }],
  "plate_distribution": { "protein": number, "carbs": number, "fat": number, "vegetables": number },
  "calories_approx": number,
  "prep_time_minutes": number,
  "notes": string
}
Rules:
${dayNameRule}
- CRITICAL: Every meal MUST have at least 3 ingredients. ${paddingNote}
- CRITICAL: Assign correct category to every ingredient.
- Strictly respect the diet type and allergies. Never include disliked foods.
- Vary meals (no repeated meals). Adjust calories to match the goal.
- plate_distribution values must sum to 100.
- ${langInstruction}
- Return ONLY the JSON array, nothing else.`;

  // 16:8, 18:6 and 20:4 protocols skip breakfast — 2 meals/day instead of 3.
  // Using 3 for none/12:12/5:2 which include all three meal slots.
  const mealsPerDay = ["16:8", "18:6", "20:4"].includes(fastingProtocol ?? "") ? 2 : 3;

  const MEAL_SYSTEM = getMealSystem(lang);

  // Split into 3 chunks of ≤9 meals each — Haiku reliably generates 9 meals per call
  // but fails when asked for 12 (logs showed array[9]/array[11] for 12-meal prompts).
  // All 3 run in parallel; wall-clock time is the slowest chunk (~8-12s total).
  const chunk1Total = 3 * mealsPerDay;
  const chunk3Total = 1 * mealsPerDay;
  const prompt1 = `Create meals for ${dayNames.chunk1} (3 days × ${mealsPerDay} meals = ${chunk1Total} objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly ${chunk1Total} objects covering ONLY ${dayNames.chunk1}.\n${schemaInstructions}`;
  const prompt2 = `Create meals for ${dayNames.chunk2} (3 days × ${mealsPerDay} meals = ${chunk1Total} objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly ${chunk1Total} objects covering ONLY ${dayNames.chunk2}.\n${schemaInstructions}`;
  const prompt3 = `Create meals for ${dayNames.chunk3} (1 day × ${mealsPerDay} meals = ${chunk3Total} objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly ${chunk3Total} objects covering ONLY ${dayNames.chunk3}.\n${schemaInstructions}`;

  const makeChunkValidator = (min: number) => (val: unknown): val is any[] =>
    Array.isArray(val) && val.length >= min;

  const [chunk1, chunk2, chunk3] = await Promise.all([
    callClaudeWithRetry(MEAL_SYSTEM, prompt1, 4000, makeChunkValidator(chunk1Total), "claude-haiku-4-5-20251001"),
    callClaudeWithRetry(MEAL_SYSTEM, prompt2, 4000, makeChunkValidator(chunk1Total), "claude-haiku-4-5-20251001"),
    callClaudeWithRetry(MEAL_SYSTEM, prompt3, 1500, makeChunkValidator(chunk3Total), "claude-haiku-4-5-20251001"),
  ]);

  return flatMealsToNestedDays([...chunk1, ...chunk2, ...chunk3]);
}

// ─── Workout plan ─────────────────────────────────────────────────────────────

function isWorkoutArray(val: unknown, expectedDays?: number): val is any[] {
  if (!Array.isArray(val) || val.length === 0) return false;
  if (expectedDays && val.length !== expectedDays) {
    console.warn(`[workout] Expected ${expectedDays} days, got ${val.length} — retrying`);
    return false;
  }
  return val.every((day: any) =>
    Array.isArray(day.exercises) &&
    day.exercises.length >= 3 &&
    day.exercises.every((ex: any) => typeof ex.name === "string" && ex.name.length > 0),
  );
}

export async function generateWorkoutPlanForUser(profile: {
  goalType: string;
  trainingLevel: string;
  trainingDaysPerWeek: number;
  trainingLocation: string;
  [key: string]: unknown;
}, lang: "es" | "en" = "es") {
  const trainingDays = profile.trainingDaysPerWeek;
  const location = (profile.trainingLocation ?? "gym").toLowerCase();
  const level = profile.trainingLevel ?? "intermediate";

  // ── Step 1: Pre-select exercises from WorkoutX cache ────────────────────────
  const pool = await getExercisePool(location, level);
  console.log(`[aiGenerators] WorkoutX pool: ${pool.length} exercises for location="${location}" level="${level}"`);

  // Build reconciliation maps from the full pool (before trimming)
  const wxMap = new Map(pool.map(e => [e.name.toLowerCase(), e.id]));
  const wxNameMap = new Map(pool.map(e => [e.id, e.name]));

  // Trim pool size to keep the prompt within token budget
  const maxPoolSize = trainingDays >= 6 ? 60 : trainingDays >= 4 ? 80 : 100;
  const trimmedPool = pool.slice(0, maxPoolSize);
  console.log(`[aiGenerators] Trimmed pool to ${trimmedPool.length} exercises (maxPoolSize=${maxPoolSize} for trainingDays=${trainingDays})`);

  // Compact format for large plans to save tokens
  const poolLines = trainingDays >= 6
    ? trimmedPool.map(e => `${e.id}:${e.name}`).join("\n")
    : trimmedPool.map(e => `${e.id}:${e.name} [${e.target}, ${e.equipment}]`).join("\n");

  // ── Step 2: AI structures the plan using the pre-selected pool ───────────────
  const WORKOUT_SYSTEM = lang === "en"
    ? "You are a professional personal trainer organizing a workout plan. You always respond with valid JSON only — no markdown, no explanation, no code blocks. Just raw JSON."
    : "Eres un entrenador personal profesional organizando un plan de entrenamiento. Siempre respondes únicamente con JSON válido — sin markdown, sin explicaciones, sin bloques de código. Solo JSON puro.";

  const langNoteInstruction = lang === "en"
    ? "Notes, warmup, cooldown, and workout_type must be in English."
    : "Las notas, calentamiento, enfriamiento y workout_type deben estar en español. Los nombres de ejercicios (name) y exercise_id deben copiarse EXACTAMENTE del pool — no los traduzcas.";

  const goalApproach: Record<string, string> = {
    lose_weight:   "Short rest (30-45s). Mix compound lifts with cardio bursts. 5-6 exercises/day.",
    gain_muscle:   "Longer rest (60-90s). Focus on progressive overload, 8-12 reps. 5-7 exercises/day.",
    maintain:      "Balanced sets/reps. Mix strength and endurance. 5-6 exercises/day.",
    recomposition: "Alternate heavy compound and cardio-focused days. 5-6 exercises/day.",
  };
  const goalKey = profile.goalType ?? "maintain";
  const goalGuidance = goalApproach[goalKey] ?? goalApproach.maintain;

  const sessionStructure: Record<number, string> = {
    2: "Full Body A / Full Body B — completely different exercises each day",
    3: "Push Day (chest, shoulders, triceps) / Pull Day (back, biceps) / Leg Day (quads, hamstrings, glutes)",
    4: "Upper Body / Lower Body / Push Day / Pull Day",
    5: "Push / Pull / Legs / Upper Body / Cardio+Core",
    6: "Push / Pull / Legs / Push (different) / Pull (different) / Legs (different)",
    7: "Push / Pull / Legs / Upper Body / Lower Body / Full Body / Active Recovery (light cardio + core)",
  };
  const structure = sessionStructure[trainingDays] ?? sessionStructure[3];

  const prompt = `You are organizing a ${trainingDays}-day workout plan. The exercises are PRE-SELECTED — DO NOT change or invent exercise names or IDs.

USER:
- Goal: ${goalKey.replace(/_/g, " ")} — ${goalGuidance}
- Goal pace: ${(profile as any).goalPace ?? "moderate"} (gentle = lower volume/intensity, moderate = standard, aggressive = higher volume/intensity)
- Level: ${level}
- Location: ${location}
- Days/week: ${trainingDays}

WEEKLY STRUCTURE: ${structure}

EXERCISE POOL — use ONLY these exercises (format: ID:Name [target, equipment]):
${poolLines}

RULES:
- Copy name and exercise_id EXACTLY from the pool above — no modifications, no translations
- Each exercise may appear AT MOST ONCE across the whole week
- Each day must have 5-7 exercises from the pool
- Distribute muscle groups logically (no same primary muscle on consecutive days)
- Set sets/reps/rest based on the user's goal and level
- exercise_type: "strength" if uses equipment weight, "bodyweight" if body weight, "timed" if held for time, "cardio" if aerobic

${langNoteInstruction}

CRITICAL: Return a JSON array with EXACTLY ${trainingDays} objects — one per training day. Count them before responding. If you return ${trainingDays - 1} or ${trainingDays + 1} objects the response will be rejected and you must retry. No more, no less than ${trainingDays}.

Each object:
{
  "day_name": string — MUST be a weekday name: monday, tuesday, wednesday, thursday, friday, saturday, or sunday. Never use "day 1", "day 2" etc. Example values: "monday", "tuesday", "wednesday".
  "workout_type": string (descriptive session name),
  "duration_minutes": number,
  "exercises": [
    {
      "name": string (EXACT name from pool),
      "exercise_id": string (EXACT ID from pool, e.g. "0024"),
      "muscles": string (primary muscles, e.g. "Chest, Triceps"),
      "sets": number,
      "reps": string (e.g. "10-12" or "45 seconds"),
      "rest_seconds": number,
      "notes": string (form tip),
      "exercise_type": "strength" | "bodyweight" | "timed" | "cardio"
    }
  ],
  "warmup": string,
  "cooldown": string,
  "notes": string
}

Return ONLY the JSON array, nothing else.`;

  const maxTokens = trainingDays >= 6 ? 8000 : trainingDays >= 5 ? 6000 : 4000;
  const model = trainingDays >= 6 ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
  console.log(`[aiGenerators] Workout: trainingDays=${trainingDays}, maxTokens=${maxTokens}, model=${model}`);
  const workoutData = await callClaudeWithRetry(WORKOUT_SYSTEM, prompt, maxTokens, (val) => isWorkoutArray(val, trainingDays), model);
  const processedDays = (workoutData as any[]).map((day: any) => ({
    ...day,
    exercises: (day.exercises ?? []).map((ex: any) => ({
      ...ex,
      sets: ex.sets || 3,
      reps: ex.reps || "10-12",
      rest_seconds: ex.rest_seconds || 60,
      notes: ex.notes || "",
      exercise_type: ex.exercise_type || "strength",
      exercise_id: ex.exercise_id || null,
    })),
  }));

  // Safety net: fill in any missing exercise_ids from the pool
  return reconcileExerciseIds(processedDays, wxMap, wxNameMap);
}

// ─── Replace single ingredient ─────────────────────────────────────────────────

export async function replaceIngredientInMeal(
  ingredientName: string,
  category: string,
  dietType: string,
  allergies: string[],
  dislikedFoods: string[] = [],
  lang: "es" | "en" = "es",
): Promise<{ name: string; amount: string; category: string }> {
  const allForbidden = [...allergies, ...dislikedFoods].filter(Boolean);
  const forbiddenNote =
    allForbidden.length > 0
      ? `NEVER use these ingredients or their derivatives: ${allForbidden.join(", ")}.`
      : "";

  const dietRules: Record<string, string> = {
    vegan: "The replacement MUST be plant-based only (no meat, dairy, eggs, honey, or any animal product).",
    vegetarian: "The replacement must contain no meat, poultry, or fish.",
    pescatarian: "The replacement must contain no meat or poultry.",
    keto: "The replacement must be very low in carbohydrates.",
    paleo: "The replacement must be a whole food with no grains, legumes, or dairy.",
    gluten_free: "The replacement MUST be completely gluten-free.",
  };
  const dietKey = dietType.toLowerCase().replace("-", "_");
  const dietInstruction = dietRules[dietKey] ?? `The replacement must fit a ${dietType} diet.`;

  const langInstruction = lang === "en"
    ? "LANGUAGE: Respond in English. Use English food names."
    : "IDIOMA: Responde en español. Usa nombres de alimentos en español.";

  const prompt = `Replace the ingredient "${ingredientName}" (category: ${category}) in a meal.

DIET: ${dietType}. ${dietInstruction}
${forbiddenNote}
${langInstruction}

Provide ONE suitable alternative from the same food category (${category}). Return only this JSON object:
{
  "name": "Replacement Ingredient Name",
  "amount": "same portion size as the original",
  "category": "${category}"
}`;

  const systemPrompt = getMealSystem(lang);
  const text = await callClaude(systemPrompt, prompt, 200);
  const parsed = parseJsonSafely(text);
  return sanitizeIngredient(parsed) ?? { name: ingredientName, amount: "—", category };
}
