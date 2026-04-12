import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5-20251001";

const MEAL_SYSTEM =
  "You are a professional nutritionist. IMPORTANT: Generate ALL content in Spanish (Spain). All meal names, ingredient names, portions, notes, and descriptions must be in Spanish. Use Spanish food terminology and typical Spanish/Mediterranean foods when appropriate. You create personalized, realistic, and enjoyable weekly meal plans. You always respond with valid JSON only — no markdown, no explanation, no code blocks. Just raw JSON.";

const WORKOUT_SYSTEM =
  "Eres un entrenador personal profesional. IMPORTANTE: Genera TODO el contenido en español de España. Todos los nombres de ejercicios, notas, descripciones de calentamiento, enfriamiento, frases motivacionales y cualquier otro texto deben estar en español. Creas planes de entrenamiento semanales seguros, efectivos y personalizados. Siempre respondes únicamente con JSON válido — sin markdown, sin explicaciones, sin bloques de código. Solo JSON puro.";

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

async function callClaude(system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
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
): Promise<T> {
  const firstText = await callClaude(system, prompt, maxTokens);
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
  const retryText = await callClaude(system, strictPrompt, maxTokens);
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
  lunes: "monday", martes: "tuesday", "miércoles": "wednesday", miercoles: "wednesday",
  jueves: "thursday", viernes: "friday", "sábado": "saturday", sabado: "saturday",
  domingo: "sunday",
};

function normalizeDay(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SPANISH_DAY_MAP[lower] ?? lower;
}

function isFlatMealArray(val: unknown): val is any[] {
  return Array.isArray(val) && val.length >= 21;
}

function flatMealsToNestedDays(flatMeals: any[]): any[] {
  const byDay: Record<string, any[]> = {};
  for (const d of ALL_DAYS) byDay[d] = [];

  for (const meal of flatMeals) {
    const dayName = normalizeDay(meal.day_name ?? "");
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
}) {
  const allergies = (profile.allergies as string[]).filter(Boolean);
  const dislikedFoods = (profile.dislikedFoods as string[]).filter(Boolean);
  const name = typeof (profile as any).fullName === "string" ? (profile as any).fullName : "the user";

  const prompt = `Create a 7-day meal plan for this person:
- Name: ${name}
- Goal: ${profile.goalType.replace(/_/g, " ")}
- Diet type: ${profile.dietType.replace(/_/g, " ")}
- Allergies: ${allergies.join(", ") || "none"}
- Disliked foods: ${dislikedFoods.join(", ") || "none"}
- Current weight: ${profile.weightKg}kg${profile.targetWeightKg ? ` | Target weight: ${profile.targetWeightKg}kg` : ""}
- Age: ${profile.age}
- Sex: ${profile.sex}

Return a JSON array with exactly 21 objects (3 meals x 7 days).
Each object must follow this exact schema:
{
  "day_name": string (IMPORTANT: use Spanish day names in lowercase — lunes, martes, miércoles, jueves, viernes, sábado, domingo),
  "meal_type": string (breakfast | lunch | dinner),
  "meal_name": string,
  "ingredients": [{ "name": string, "amount": string, "visual_ref": string, "category": string (one of: protein | carbs | vegetables | fats | dairy | fruit | other) }],
  "plate_distribution": { "protein": number, "carbs": number, "fat": number, "vegetables": number },
  "calories_approx": number,
  "prep_time_minutes": number,
  "notes": string
}

For each ingredient, add a visual_ref field with a simple everyday reference that helps the user visualize the quantity. Examples:
- 30g jamón → '2 lonchas finas'
- 140g pechuga → '1 filete mediano'
- 200g yogur → '1 yogur grande'
- 150g arroz cocido → '1 taza'
- 1 cucharada → '1 cda' (keep as is)
- 2 unidades → '2 unidades' (keep as is)
- 80g espinacas → '2 puñados'
- 100ml leche → 'medio vaso'
- 30g queso → '1 loncha gruesa'
- 50g avena → '5 cucharadas'
Keep visual_ref short (max 3-4 words) and in Spanish. If the amount is already intuitive (cucharada, unidades, rebanada), repeat it or leave a simple confirmation.

Rules:
- CRITICAL: Every single meal MUST have at least 3 ingredients. Never return a meal with fewer than 3 ingredients. If a meal would have fewer, add basic items like aceite de oliva, sal, or vegetables.
- CRITICAL: Assign the correct category to every ingredient (protein | carbs | vegetables | fats | dairy | fruit | other).
- Strictly respect the diet type and allergies
- Never include disliked foods
- Make meals realistic and easy to prepare
- Vary the meals across the week (no repeated meals)
- Adjust caloric density to match the goal
- plate_distribution values must sum to 100
- Return ONLY the JSON array, nothing else`;

  const flatMeals = await callClaudeWithRetry(MEAL_SYSTEM, prompt, 8000, isFlatMealArray);
  return flatMealsToNestedDays(flatMeals);
}

// ─── Workout plan ─────────────────────────────────────────────────────────────

function isWorkoutArray(val: unknown): val is any[] {
  return Array.isArray(val) && val.length > 0;
}

export async function generateWorkoutPlanForUser(profile: {
  goalType: string;
  trainingLevel: string;
  trainingDaysPerWeek: number;
  trainingLocation: string;
  [key: string]: unknown;
}) {
  const trainingDays = profile.trainingDaysPerWeek;

  const prompt = `Create a weekly workout plan for this person:
- Goal: ${profile.goalType.replace(/_/g, " ")}
- Training level: ${profile.trainingLevel}
- Training days per week: ${trainingDays}
- Training location: ${profile.trainingLocation}

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
      name: string (specific exercise name, never generic),
      muscles: string (primary muscles worked, max 2-3, e.g. "Chest, Triceps" or "Quads, Glutes"),
      sets: number,
      reps: string (e.g. '10-12' or '45 seconds' or '5 heavy'),
      rest_seconds: number,
      notes: string (form tip or intensity note)
    }
  ],
  warmup: string (specific 5 min warmup for this session),
  cooldown: string (specific 5 min cooldown for this session),
  notes: string (session coaching note)
}

IDIOMA OBLIGATORIO: Todos los nombres de ejercicios, notas, descripciones de calentamiento, enfriamiento y cualquier texto deben estar en español de España. Ejemplo correcto: "Sentadilla", "Press de banca", "Peso muerto". NUNCA uses inglés.

Return ONLY the JSON array, nothing else.`;

  return callClaudeWithRetry(WORKOUT_SYSTEM, prompt, 4000, isWorkoutArray);
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
