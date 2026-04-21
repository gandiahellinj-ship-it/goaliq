import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

// ── WorkoutX exercise name pre-fetch ──────────────────────────────────────────

function mapDifficulty(level: string): string {
  const l = level?.toLowerCase();
  if (l === "beginner" || l === "principiante") return "beginner";
  if (l === "intermediate" || l === "intermedio") return "intermediate";
  return ""; // advanced = no filter
}

async function fetchWorkoutXExercises(
  location: string,
  trainingLevel: string = "intermediate",
  limit = 100,
): Promise<{ name: string; id: string; difficulty: string; equipment: string; target: string }[]> {
  try {
    const LOCATION_EQUIPMENT: Record<string, string[]> = {
      gym:     ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight"],
      home:    ["body weight", "resistance band", "dumbbell", "kettlebell"],
      outdoor: ["body weight", "kettlebell", "resistance band"],
    };
    const equipmentList = LOCATION_EQUIPMENT[location?.toLowerCase()] ?? LOCATION_EQUIPMENT.gym;
    const perEquipment = Math.ceil(limit / equipmentList.length);
    const diffParam = mapDifficulty(trainingLevel);

    const WORKOUTX_KEY = process.env.WORKOUTX_API_KEY ?? "";
    const results = await Promise.allSettled(
      equipmentList.map(eq => {
        const url = diffParam
          ? `https://api.workoutxapp.com/v1/exercises/equipment/${encodeURIComponent(eq)}?limit=${perEquipment}&difficulty=${diffParam}`
          : `https://api.workoutxapp.com/v1/exercises/equipment/${encodeURIComponent(eq)}?limit=${perEquipment}`;
        return fetch(url, {
          headers: { "X-WorkoutX-Key": WORKOUTX_KEY },
          signal: AbortSignal.timeout(8000),
        }).then(r => r.json());
      }),
    );

    const seen = new Set<string>();
    const exercises: { name: string; id: string; difficulty: string; equipment: string; target: string }[] = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const list = result.value.data ?? result.value.exercises ?? (Array.isArray(result.value) ? result.value : []);
      for (const ex of list) {
        if (ex.name && ex.id && !seen.has(ex.id)) {
          seen.add(ex.id);
          exercises.push({
            name: ex.name,
            id: ex.id,
            difficulty: ex.difficulty ?? "",
            equipment: ex.equipment ?? "",
            target: ex.target ?? "",
          });
        }
      }
    }
    return exercises.slice(0, limit);
  } catch {
    return [];
  }
}

function reconcileExerciseIds(days: any[], wxMap: Map<string, string>): any[] {
  return days.map(day => ({
    ...day,
    exercises: day.exercises.map((ex: any) => {
      if (ex.exercise_id) return ex;
      // Exact name match
      const exactId = wxMap.get(ex.name.toLowerCase());
      if (exactId) return { ...ex, exercise_id: exactId };
      // Partial match — any significant word from the exercise name appears in a WorkoutX name
      const words = ex.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      for (const [wxName, wxId] of wxMap.entries()) {
        if (words.some((w: string) => wxName.includes(w))) {
          return { ...ex, exercise_id: wxId };
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
  const name = typeof (profile as any).fullName === "string" ? (profile as any).fullName : "the user";

  const personContext = `Person:
- Name: ${name}
- Goal: ${profile.goalType.replace(/_/g, " ")}
- Diet type: ${profile.dietType.replace(/_/g, " ")}
- Allergies: ${allergies.join(", ") || "none"}
- Disliked foods: ${dislikedFoods.join(", ") || "none"}
- Current weight: ${profile.weightKg}kg${profile.targetWeightKg ? ` | Target weight: ${profile.targetWeightKg}kg` : ""}
- Age: ${profile.age}, Sex: ${profile.sex}`;

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

  const MEAL_SYSTEM = getMealSystem(lang);

  // Split into 3 chunks of ≤9 meals each — Haiku reliably generates 9 meals per call
  // but fails when asked for 12 (logs showed array[9]/array[11] for 12-meal prompts).
  // All 3 run in parallel; wall-clock time is the slowest chunk (~8-12s total).
  const prompt1 = `Create meals for ${dayNames.chunk1} (3 days × 3 meals = 9 objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly 9 objects covering ONLY ${dayNames.chunk1}.\n${schemaInstructions}`;
  const prompt2 = `Create meals for ${dayNames.chunk2} (3 days × 3 meals = 9 objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly 9 objects covering ONLY ${dayNames.chunk2}.\n${schemaInstructions}`;
  const prompt3 = `Create meals for ${dayNames.chunk3} (1 day × 3 meals = 3 objects) for this person:\n${personContext}\n\nReturn a JSON array with exactly 3 objects covering ONLY ${dayNames.chunk3}.\n${schemaInstructions}`;

  const [chunk1, chunk2, chunk3] = await Promise.all([
    callClaudeWithRetry(MEAL_SYSTEM, prompt1, 4000, isFlatMealChunk9, "claude-haiku-4-5-20251001"),
    callClaudeWithRetry(MEAL_SYSTEM, prompt2, 4000, isFlatMealChunk9, "claude-haiku-4-5-20251001"),
    callClaudeWithRetry(MEAL_SYSTEM, prompt3, 1500, isFlatMealChunk3, "claude-haiku-4-5-20251001"),
  ]);

  return flatMealsToNestedDays([...chunk1, ...chunk2, ...chunk3]);
}

// ─── Workout plan ─────────────────────────────────────────────────────────────

function isWorkoutArray(val: unknown): val is any[] {
  if (!Array.isArray(val) || val.length === 0) return false;
  return val.every((day: any) =>
    Array.isArray(day.exercises) &&
    day.exercises.length >= 4 &&
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
  const WORKOUT_SYSTEM = getWorkoutSystem(lang);

  const langInstruction = lang === "en"
    ? "LANGUAGE REQUIRED: Exercise names must match exactly the names from the EXERCISE LIBRARY above. Notes, warmup/cooldown descriptions, and workout_type must be in English."
    : "IDIOMA: Las notas, descripciones de calentamiento y enfriamiento, y workout_type deben estar en español. PERO los nombres de ejercicios (campo 'name') deben estar en inglés exactamente como aparecen en la lista de ejercicios proporcionada. Ejemplo: usa 'Barbell Squat' no 'Sentadilla con barra'.";

  const LOCATION_EQUIPMENT: Record<string, string> = {
    gym:     "barbell, dumbbell, cable machine, smith machine, leg press, lat pulldown machine, leverage machines",
    home:    "bodyweight, resistance bands, dumbbells, kettlebell",
    outdoor: "bodyweight, kettlebell, resistance bands, park equipment",
  };
  const locationKey = (profile.trainingLocation ?? "gym").toLowerCase();
  const allowedEquipment = LOCATION_EQUIPMENT[locationKey] ?? LOCATION_EQUIPMENT.gym;

  // Pre-fetch WorkoutX exercise names so the AI uses exact matchable names
  const workoutxExercises = await fetchWorkoutXExercises(
    profile.trainingLocation ?? "gym",
    profile.trainingLevel ?? "intermediate",
    100,
  );
  console.log(`[aiGenerators] WorkoutX exercises fetched: ${workoutxExercises.length} for location="${profile.trainingLocation}" level="${profile.trainingLevel}"`);

  const exerciseLibraryBlock = workoutxExercises.length > 0
    ? `\nEXERCISE LIBRARY: You MUST use exercises from this list. These are the exact names available with visual demonstrations (format: ID:Name (target, equipment)). Only use exercises appropriate for the training location and goal:\n${workoutxExercises.map(e => `${e.id}:${e.name} (${e.target}, ${e.equipment})`).join(", ")}\n\nCRITICAL: Use the EXACT exercise names from the list above. Set exercise_id to the corresponding ID (e.g. "0024"). Do not translate, modify, or invent exercise names.\nNote: For cardio exercises (running, jogging, cycling), you may use descriptive names like "Treadmill Run", "Outdoor Jog", "Cycling" — these will show a cardio icon instead of a GIF. Set exercise_id to null for cardio exercises.\n`
    : "";

  const prompt = `Create a weekly workout plan for this person:
- Goal: ${profile.goalType.replace(/_/g, " ")}
- Training level: ${profile.trainingLevel}
- Training days per week: ${trainingDays}
- Training location: ${profile.trainingLocation}

TRAINING LOCATION: The user trains at ${profile.trainingLocation}.
ALLOWED EQUIPMENT: ${allowedEquipment}
CRITICAL: Only suggest exercises using the allowed equipment above. Never suggest barbell or machine exercises for home/outdoor users. Never suggest bodyweight-only exercises when gym equipment is available (unless warmup or cardio burst).
${exerciseLibraryBlock}
GOAL-SPECIFIC TRAINING APPROACH:
- lose_weight: Mix cardio + strength. 40% cardio (HIIT, circuits, metabolic conditioning), 40% full body strength, 20% core/mobility. Keep rest periods short (30-45s) to maintain heart rate.
- gain_muscle: Focus on progressive overload. 70% hypertrophy strength training (8-12 reps), 20% compound movements (5 reps heavy), 10% mobility/stretching. Longer rest periods (60-90s).
- maintain: Balanced mix. 33% strength, 33% cardio/endurance, 33% flexibility/mobility/yoga-style.
- recomposition: Alternate strength and cardio days. 50% strength (compound lifts), 30% HIIT/cardio, 20% core and mobility.

MUSCLE GROUP DISTRIBUTION RULES:
- NEVER train the same primary muscle group on consecutive days
- NEVER repeat the same exercise twice in the same week
- Rotate through ALL of these muscle groups across the week: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, cardio
- Session structure by days per week:
  * 2 days: Full Body A / Full Body B (completely different exercises)
  * 3 days: Push Day / Pull Day / Leg Day
  * 4 days: Upper Body / Lower Body / Push Day / Pull Day
  * 5 days: Push / Pull / Legs / Upper Body / Cardio+Core
  * 6 days: Push / Pull / Legs / Push / Pull / Legs (different exercises each rotation)

EXERCISE VARIETY REQUIREMENTS:
- Include a mix of these exercise types across the week:
  * Compound barbell/dumbbell lifts (squat, deadlift, bench press, overhead press, row)
  * Bodyweight movements (push-ups, pull-ups, dips, lunges, step-ups)
  * Cardio bursts (jumping jacks, mountain climbers, burpees, jump rope, sprints)
  * Isolation exercises (curls, lateral raises, tricep extensions, leg curls)
  * Core work (planks, dead bugs, russian twists, hanging leg raises)
  * Mobility/flexibility (hip flexor stretch, thoracic rotation, foam rolling)
  * HIIT circuits (work/rest intervals like 40s on / 20s off)
- For gym users: use barbells, dumbbells, cables, machines
- For home users: use bodyweight, resistance bands, dumbbells only
- For outdoor users: use running, bodyweight, park equipment

WEEKLY STRUCTURE EXAMPLE FOR LOSE WEIGHT / 3 DAYS:
- Monday: HIIT Cardio + Core (burpees, mountain climbers, jump squats, plank variations)
- Wednesday: Full Body Strength Circuit (squat, push-up, row, lunge, shoulder press)
- Friday: Metabolic Conditioning (kettlebell swings, box jumps, battle ropes, sled push)

WEEKLY STRUCTURE EXAMPLE FOR GAIN MUSCLE / 4 DAYS:
- Monday: Push Day (bench press, overhead press, incline dumbbell press, lateral raises, tricep dips)
- Tuesday: Pull Day (barbell row, lat pulldown, face pulls, bicep curls, rear delt flies)
- Thursday: Leg Day (squat, romanian deadlift, leg press, walking lunges, calf raises)
- Friday: Arms + Core (skull crushers, hammer curls, cable pushdown, hanging leg raises, ab wheel)

Return a JSON array with exactly ${trainingDays} workout objects.
Each object must follow this exact schema:
{
  day_name: string (e.g. Monday),
  workout_type: string (descriptive, e.g. 'Push Day — Chest & Triceps' or 'HIIT Cardio + Core'),
  duration_minutes: number,
  exercises: [
    {
      name: string (exact exercise name from the EXERCISE LIBRARY above),
      exercise_id: string (the ID from the EXERCISE LIBRARY, e.g. "0024"),
      muscles: string (primary muscles worked, max 2-3, e.g. "Chest, Triceps" or "Quads, Glutes"),
      sets: number,
      reps: string (e.g. '10-12' or '45 seconds' or '5 heavy'),
      rest_seconds: number,
      notes: string (form tip or intensity note),
      exercise_type: "strength" | "cardio" | "bodyweight" | "timed"
    }
  ],
  warmup: string (specific 5 min warmup for this session),
  cooldown: string (specific 5 min cooldown for this session),
  notes: string (session coaching note)
}

VARIETY RULES - CRITICAL:
- Each exercise must appear AT MOST ONCE across the entire week plan
- No exercise name can be repeated in any day
- Use different exercises for each training day — maximum variety
- If training chest on Monday and Thursday, use completely different chest exercises each day
- Aim for at least 20+ unique exercises across the week

CRITICAL: Every single exercise MUST have sets (a positive number) and reps (a non-empty string like '10-12' or '30 seconds'). Never leave sets or reps empty, null, or undefined.

CRITICAL - EXERCISE TYPE: Every exercise MUST have an exercise_type field. Use exactly one of:
- "strength": uses external weight (barbell, dumbbell, machine, cable, kettlebell). Examples: Bench press, Squat with bar, Bicep curl, Lat pulldown, Cable fly, Leg press.
- "cardio": aerobic/endurance exercise (running, cycling, rowing, burpees, jump rope, box jumps, mountain climbers, jumping jacks). Examples: Sprints, Rowing machine, Burpees, Jump rope.
- "bodyweight": no external weight added. Examples: Push-ups, Pull-ups (unweighted), Bodyweight squats, Lunges without weight, Dips, Ab crunches.
- "timed": held for time, no weight or rep counting. Examples: Plank (40 seconds), Dead hang, Wall sit, L-sit, Hollow hold, Superman hold, Static stretches.
Never leave exercise_type empty, null, or undefined.

${langInstruction}

Return ONLY the JSON array, nothing else.`;

  const workoutData = await callClaudeWithRetry(WORKOUT_SYSTEM, prompt, 4000, isWorkoutArray, "claude-haiku-4-5-20251001");
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

  // Reconcile missing exercise_ids using the WorkoutX library
  const wxMap = new Map(workoutxExercises.map(e => [e.name.toLowerCase(), e.id]));
  return reconcileExerciseIds(processedDays, wxMap);
}

// ─── Replace single ingredient ─────────────────────────────────────────────────

export async function replaceIngredientInMeal(
  ingredientName: string,
  category: string,
  dietType: string,
  allergies: string[],
  dislikedFoods: string[] = [],
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

  const prompt = `Replace the ingredient "${ingredientName}" (category: ${category}) in a meal.

DIET: ${dietType}. ${dietInstruction}
${forbiddenNote}

Provide ONE suitable alternative from the same food category (${category}). Return only this JSON object:
{
  "name": "Replacement Ingredient Name",
  "amount": "same portion size as the original",
  "category": "${category}"
}`;

  const text = await callClaude(MEAL_SYSTEM, prompt, 200);
  const parsed = parseJsonSafely(text);
  return sanitizeIngredient(parsed) ?? { name: ingredientName, amount: "—", category };
}
