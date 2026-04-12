import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Ingredient = { name: string; amount: string; category: string; visual_ref?: string };
export type PlateDistribution = Record<string, number>;

export type MealRow = {
  id: string;
  day_name: string;
  meal_type: string;
  meal_name: string;
  ingredients: Ingredient[];
  plate_distribution: PlateDistribution;
};

export type DayMeals = {
  day: string;
  meals: MealRow[];
};

export type MealPlan = {
  days: DayMeals[];
  weekStart: string;
};

export type Exercise = {
  name: string;
  muscles?: string;
  sets?: number;
  reps?: number;
  duration_sec?: number;
  rest_sec?: number;
  notes?: string;
};

export type WorkoutRow = {
  id: string;
  day_name: string;
  workout_type: string;
  duration_minutes?: number;
  exercises: Exercise[];
  notes: string;
};

export type DayWorkout = {
  day: string;
  isRestDay: boolean;
  workout?: WorkoutRow;
};

export type WorkoutPlan = {
  days: DayWorkout[];
  weekStart: string;
  trainingDays: Set<string>;
};

export type ProgressLog = {
  id: string;
  log_date: string;
  weight_kg: number | null;
  workout_completed: boolean;
  meals_followed: boolean;
  notes: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  age: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  training_days_per_week: number | null;
  goal: string | null;
  diet_type: string | null;
};

export type ProgressStats = {
  currentWeightKg: number | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  completedWorkoutsThisWeek: number;
  totalWorkoutsThisWeek: number;
  weeklyAdherencePercent: number;
  weightHistory: { date: string; weightKg: number }[];
  streak: number;
  todayWorkoutDone: boolean;
};

// ─── Ingredient sanitization ───────────────────────────────────────────────────
// Guards against malformed AI output or stale DB data rendering in the UI.

const VALID_INGREDIENT_CATEGORIES = new Set([
  "protein", "carbs", "vegetables", "fats", "dairy", "fruit", "other",
]);

const SPANISH_CATEGORY_MAP: Record<string, string> = {
  verduras: "vegetables",
  vegetales: "vegetables",
  frutas: "fruit",
  fruta: "fruit",
  "proteína": "protein",
  proteina: "protein",
  "proteínas": "protein",
  proteinas: "protein",
  carnes: "protein",
  "lácteos": "dairy",
  lacteos: "dairy",
  carbohidratos: "carbs",
  carbohidrato: "carbs",
  grasas: "fats",
  grasa: "fats",
  otros: "other",
  otro: "other",
};

const KEYWORD_CATEGORY_MAP: Array<{ category: string; keywords: string[] }> = [
  {
    category: "vegetables",
    keywords: [
      "espinacas", "lechuga", "tomate", "tomates", "pepino", "zanahoria",
      "zanahorias", "cebolla", "ajo", "pimiento", "brócoli", "brocoli",
      "calabacín", "calabacin", "berenjena", "apio", "puerro", "rúcula",
      "rucula", "col", "coliflor", "judías", "judias", "guisantes",
      "champiñones", "champinones", "setas", "alcachofas", "espárragos",
      "esparragos", "remolacha", "maíz", "maiz", "patata", "patatas",
      "boniato",
    ],
  },
  {
    category: "fruit",
    keywords: [
      "manzana", "plátano", "platano", "naranja", "fresas", "uvas",
      "mango", "piña", "pina", "sandía", "sandia", "melón", "melon",
      "pera", "melocotón", "melocoton", "kiwi", "limón", "limon",
      "lima", "arándanos", "arandanos", "frambuesas", "cerezas",
      "higos", "granada",
    ],
  },
  {
    category: "protein",
    keywords: [
      "pollo", "pechuga", "ternera", "salmón", "salmon", "atún", "atun",
      "huevos", "huevo", "gambas", "merluza", "bacalao", "sardinas",
      "lentejas", "garbanzos", "alubias", "tofu", "tempeh", "carne",
      "cerdo", "cordero", "pavo", "lubina", "dorada", "mejillones",
    ],
  },
  {
    category: "dairy",
    keywords: [
      "leche", "yogur", "yogurt", "queso", "mantequilla", "nata",
      "kéfir", "kefir", "requesón", "requesón", "mozzarella",
    ],
  },
  {
    category: "carbs",
    keywords: [
      "arroz", "pasta", "pan", "avena", "quinoa", "cuscús", "cuscus",
      "harina", "cereales", "granola",
    ],
  },
  {
    category: "fats",
    keywords: [
      "aceite", "aguacate", "nueces", "almendras", "cacahuetes",
      "semillas", "tahini", "pistachos", "anacardos",
    ],
  },
];

function detectCategoryFromName(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const { category, keywords } of KEYWORD_CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return "other";
}

function sanitizeIngredient(raw: unknown): Ingredient | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const amount = typeof obj.amount === "string" && obj.amount.trim() ? obj.amount.trim() : "—";
  const rawCat = typeof obj.category === "string" ? obj.category.trim().toLowerCase() : "";
  let category: string;
  if (VALID_INGREDIENT_CATEGORIES.has(rawCat)) {
    category = rawCat;
  } else if (SPANISH_CATEGORY_MAP[rawCat]) {
    category = SPANISH_CATEGORY_MAP[rawCat];
  } else {
    category = detectCategoryFromName(name);
  }
  const visual_ref = typeof obj.visual_ref === "string" && obj.visual_ref.trim() ? obj.visual_ref.trim() : undefined;
  return { name, amount, category, visual_ref };
}

function sanitizeIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeIngredient).filter((i): i is Ingredient => i !== null);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, age, weight_kg, target_weight_kg, training_days_per_week, goal, diet_type")
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────

export function useMealPlan() {
  const weekStart = getWeekStart();
  return useQuery({
    queryKey: ["meal_plans", weekStart],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("week_start", weekStart);
      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Sanitize ingredients on every row coming out of the DB
      const safeRows: MealRow[] = (data as MealRow[]).map(r => ({
        ...r,
        meal_name: typeof r.meal_name === "string" && r.meal_name.trim() ? r.meal_name.trim() : "Meal",
        meal_type: typeof r.meal_type === "string" && r.meal_type.trim() ? r.meal_type.trim() : "other",
        ingredients: sanitizeIngredients(r.ingredients),
        plate_distribution: (r.plate_distribution && typeof r.plate_distribution === "object" && !Array.isArray(r.plate_distribution))
          ? r.plate_distribution
          : {},
      }));

      const grouped: DayMeals[] = ALL_DAYS.map(day => ({
        day,
        meals: safeRows.filter(r => r.day_name === day).sort((a, b) => {
          const order = ["breakfast", "lunch", "dinner", "snack"];
          return order.indexOf(a.meal_type) - order.indexOf(b.meal_type);
        }),
      }));

      return { days: grouped, weekStart } as MealPlan;
    },
  });
}

// ─── Workout Plan ─────────────────────────────────────────────────────────────

export function useWorkoutPlan() {
  const weekStart = getWeekStart();
  return useQuery({
    queryKey: ["workout_plans", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("week_start", weekStart);
      if (error) throw error;

      const rows = (data || []) as WorkoutRow[];
      const trainingDays = new Set(rows.map(r => r.day_name));

      if (trainingDays.size === 0) return null;

      const days: DayWorkout[] = ALL_DAYS.map(day => ({
        day,
        isRestDay: !trainingDays.has(day),
        workout: rows.find(r => r.day_name === day),
      }));

      return { days, weekStart, trainingDays } as WorkoutPlan;
    },
  });
}

// ─── Progress Logs (for calendar) ─────────────────────────────────────────────

export function useProgressLogs(year: number, month: number) {
  return useQuery({
    queryKey: ["progress_logs", year, month],
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const startDate = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${pad(month)}-${lastDay}`;
      const { data, error } = await supabase
        .from("progress_logs")
        .select("*")
        .gte("log_date", startDate)
        .lte("log_date", endDate);
      if (error) throw error;
      return (data || []) as ProgressLog[];
    },
  });
}

// ─── Progress Stats (for dashboard + progress page) ───────────────────────────

export function useProgressStats() {
  return useQuery({
    queryKey: ["progress_stats"],
    queryFn: async () => {
      const weekStart = getWeekStart();

      const [{ data: profile }, { data: logs }, { data: workouts }] = await Promise.all([
        supabase.from("profiles").select("weight_kg, target_weight_kg, training_days_per_week").maybeSingle(),
        supabase.from("progress_logs").select("*").order("log_date", { ascending: true }),
        supabase.from("workout_plans").select("day_name").eq("week_start", weekStart),
      ]);

      const typedLogs = (logs || []) as ProgressLog[];

      // This week: Monday to Sunday
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const thisWeekLogs = typedLogs.filter(l => {
        const d = new Date(l.log_date);
        return d >= weekStartDate && d <= weekEndDate;
      });

      const completedWorkoutsThisWeek = thisWeekLogs.filter(l => l.workout_completed).length;
      const totalWorkoutsThisWeek = (workouts || []).length;

      const weeklyAdherence =
        totalWorkoutsThisWeek > 0
          ? Math.round((completedWorkoutsThisWeek / totalWorkoutsThisWeek) * 100)
          : 0;

      const withWeight = typedLogs.filter(l => l.weight_kg != null);
      const currentWeightKg =
        withWeight.length > 0
          ? withWeight[withWeight.length - 1].weight_kg
          : ((profile as any)?.weight_kg ?? null);

      // ─── Streak calculation ───────────────────────────────────────────────
      // Use this week's training day names as reference for all weeks
      const trainingDaySet = new Set((workouts || []).map((r: any) => r.day_name as string));
      const completionMap = new Map<string, boolean>();
      typedLogs.forEach(l => completionMap.set(l.log_date, l.workout_completed));

      // Local-date helper — avoids UTC shift for users outside UTC
      const toLocalDateStr = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayBase = new Date();
      todayBase.setHours(0, 0, 0, 0);
      const todayStr = toLocalDateStr(todayBase);
      const todayWorkoutDone = completionMap.get(todayStr) === true;

      // If today is a training day but not yet completed, start the backward
      // count from yesterday so past completions are not zeroed out.
      const todayIsTrainingDay =
        trainingDaySet.size === 0 || trainingDaySet.has(DAY_NAMES[todayBase.getDay()]);
      const startOffset = todayIsTrainingDay && !todayWorkoutDone ? 1 : 0;

      let streak = 0;
      for (let i = startOffset; i <= 90; i++) {
        const d = new Date(todayBase);
        d.setDate(d.getDate() - i);
        const dayName = DAY_NAMES[d.getDay()];
        if (trainingDaySet.size > 0 && !trainingDaySet.has(dayName)) continue; // skip rest days
        const dateStr = toLocalDateStr(d);
        if (completionMap.get(dateStr) === true) {
          streak++;
        } else {
          break;
        }
      }

      return {
        currentWeightKg,
        startWeightKg: (profile as any)?.weight_kg ?? currentWeightKg,
        targetWeightKg: (profile as any)?.target_weight_kg ?? null,
        completedWorkoutsThisWeek,
        totalWorkoutsThisWeek,
        weeklyAdherencePercent: weeklyAdherence,
        weightHistory: withWeight.map(l => ({ date: l.log_date, weightKg: l.weight_kg! })),
        streak,
        todayWorkoutDone,
      } as ProgressStats;
    },
  });
}

// ─── Food Preferences ─────────────────────────────────────────────────────────

export type FoodPreferences = {
  liked_foods: string[];
  disliked_foods: string[];
  allergies: string[];
  intolerances: string[];
};

export function useFoodPreferences() {
  return useQuery({
    queryKey: ["food_preferences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_preferences")
        .select("liked_foods, disliked_foods, allergies, intolerances")
        .maybeSingle();
      if (error) throw error;
      return (data ?? { liked_foods: [], disliked_foods: [], allergies: [], intolerances: [] }) as FoodPreferences;
    },
  });
}

// ─── Ingredient Swap Pools ────────────────────────────────────────────────────
// Each option has a reason (shown in the picker UI) and optional bestFor goal tags.
// Diet-specific pools are tried first; "any" is the fallback.

export type SwapOption = {
  name: string;
  amount: string;
  reason: string;
  bestFor?: Array<"lose_fat" | "gain_muscle">;
};

const INGREDIENT_POOLS: Record<string, Record<string, SwapOption[]>> = {
  protein: {
    any: [
      { name: "Chicken breast", amount: "150g", reason: "Lean & versatile", bestFor: ["lose_fat"] },
      { name: "Turkey breast", amount: "150g", reason: "Very lean protein", bestFor: ["lose_fat"] },
      { name: "Tuna (canned)", amount: "120g", reason: "High protein, low fat", bestFor: ["lose_fat"] },
      { name: "Salmon fillet", amount: "150g", reason: "Rich in omega-3s", bestFor: ["gain_muscle"] },
      { name: "Lean beef strips", amount: "150g", reason: "Iron-rich protein", bestFor: ["gain_muscle"] },
      { name: "Shrimp", amount: "150g", reason: "Low calorie, high protein", bestFor: ["lose_fat"] },
      { name: "Eggs", amount: "2 whole", reason: "Complete amino profile", bestFor: ["gain_muscle"] },
      { name: "Sardines", amount: "100g", reason: "Omega-3 rich" },
      { name: "Edamame", amount: "100g", reason: "Plant-based & fibre-rich" },
      { name: "Cottage cheese", amount: "150g", reason: "Slow-digesting protein", bestFor: ["gain_muscle"] },
    ],
    vegan: [
      { name: "Firm tofu", amount: "180g", reason: "Neutral flavour, versatile", bestFor: ["lose_fat"] },
      { name: "Tempeh", amount: "150g", reason: "Fermented & high protein", bestFor: ["gain_muscle"] },
      { name: "Chickpeas", amount: "150g", reason: "Protein & fibre combo" },
      { name: "Black beans", amount: "150g", reason: "High fibre legume" },
      { name: "Red lentils", amount: "120g", reason: "Quick-cooking, iron-rich" },
      { name: "Seitan", amount: "100g", reason: "High protein meat alternative", bestFor: ["gain_muscle"] },
      { name: "Pea protein powder", amount: "1 scoop", reason: "Pure plant protein", bestFor: ["gain_muscle"] },
      { name: "White beans", amount: "150g", reason: "Mild & protein-rich" },
      { name: "Hemp seeds", amount: "30g", reason: "Complete amino profile" },
    ],
    vegetarian: [
      { name: "Eggs", amount: "2-3 whole", reason: "Complete amino profile", bestFor: ["gain_muscle"] },
      { name: "Greek yogurt", amount: "150g", reason: "High protein & gut-friendly" },
      { name: "Paneer", amount: "120g", reason: "High protein dairy" },
      { name: "Cottage cheese", amount: "150g", reason: "Slow-digesting protein", bestFor: ["gain_muscle"] },
      { name: "Firm tofu", amount: "180g", reason: "Low fat plant protein", bestFor: ["lose_fat"] },
      { name: "Chickpeas", amount: "150g", reason: "Protein & fibre combo" },
      { name: "Mozzarella", amount: "80g", reason: "Calcium-rich protein" },
    ],
    keto: [
      { name: "Salmon fillet", amount: "200g", reason: "High fat, zero carbs", bestFor: ["gain_muscle"] },
      { name: "Ribeye steak", amount: "180g", reason: "Protein & healthy fats", bestFor: ["gain_muscle"] },
      { name: "Chicken thighs", amount: "200g", reason: "Juicy & high protein" },
      { name: "Eggs", amount: "3 whole", reason: "Keto staple", bestFor: ["gain_muscle"] },
      { name: "Bacon", amount: "100g", reason: "Zero carbs" },
      { name: "Ground beef", amount: "180g", reason: "Calorie-dense protein", bestFor: ["gain_muscle"] },
      { name: "Smoked salmon", amount: "120g", reason: "Omega-3 rich, no carbs" },
      { name: "Lamb chops", amount: "180g", reason: "Rich protein & iron" },
    ],
    pescatarian: [
      { name: "Salmon fillet", amount: "150g", reason: "Omega-3 powerhouse", bestFor: ["gain_muscle"] },
      { name: "Tuna steak", amount: "160g", reason: "Lean & high protein", bestFor: ["lose_fat"] },
      { name: "Shrimp", amount: "180g", reason: "Low calorie seafood", bestFor: ["lose_fat"] },
      { name: "Cod fillet", amount: "160g", reason: "Very lean white fish", bestFor: ["lose_fat"] },
      { name: "Mackerel", amount: "130g", reason: "Rich in healthy fats" },
      { name: "Eggs", amount: "2 whole", reason: "Complete amino profile" },
    ],
    high_protein: [
      { name: "Chicken breast", amount: "200g", reason: "Highest lean protein", bestFor: ["gain_muscle"] },
      { name: "Turkey breast", amount: "200g", reason: "Very lean & high protein", bestFor: ["gain_muscle"] },
      { name: "Eggs", amount: "3 whole", reason: "Complete amino profile", bestFor: ["gain_muscle"] },
      { name: "Cottage cheese", amount: "200g", reason: "Slow-release protein", bestFor: ["gain_muscle"] },
      { name: "Tuna (canned)", amount: "160g", reason: "Pure protein, low fat", bestFor: ["gain_muscle"] },
      { name: "Greek yogurt", amount: "200g", reason: "Protein-packed dairy", bestFor: ["gain_muscle"] },
    ],
  },
  carbs: {
    any: [
      { name: "Brown rice", amount: "80g", reason: "Whole grain, steady energy" },
      { name: "Quinoa", amount: "80g", reason: "Complete protein grain", bestFor: ["lose_fat"] },
      { name: "Sweet potato", amount: "150g", reason: "High fibre, low GI", bestFor: ["lose_fat"] },
      { name: "Rolled oats", amount: "80g", reason: "Sustained energy release", bestFor: ["gain_muscle"] },
      { name: "Whole wheat pasta", amount: "90g", reason: "High fibre pasta", bestFor: ["gain_muscle"] },
      { name: "Whole grain bread", amount: "2 slices", reason: "Convenient complex carb" },
      { name: "Couscous", amount: "80g", reason: "Quick-cooking grain" },
      { name: "Buckwheat", amount: "80g", reason: "Gluten-free whole grain", bestFor: ["lose_fat"] },
      { name: "Barley", amount: "80g", reason: "Very high fibre" },
      { name: "Baby potatoes", amount: "150g", reason: "Satisfying whole food" },
    ],
    keto: [
      { name: "Cauliflower rice", amount: "200g", reason: "Zero net carbs", bestFor: ["lose_fat"] },
      { name: "Zucchini noodles", amount: "200g", reason: "Light & low carb", bestFor: ["lose_fat"] },
      { name: "Shirataki noodles", amount: "200g", reason: "Nearly zero calories", bestFor: ["lose_fat"] },
    ],
    vegan: [
      { name: "Brown rice", amount: "80g", reason: "Whole grain energy" },
      { name: "Quinoa", amount: "80g", reason: "Contains all essential amino acids", bestFor: ["lose_fat"] },
      { name: "Sweet potato", amount: "150g", reason: "Nutrient-dense carb", bestFor: ["lose_fat"] },
      { name: "Oats", amount: "80g", reason: "Beta-glucan for heart health", bestFor: ["gain_muscle"] },
      { name: "Rice noodles", amount: "80g", reason: "Light & versatile" },
      { name: "Buckwheat", amount: "80g", reason: "High in magnesium" },
    ],
    gluten_free: [
      { name: "Brown rice", amount: "80g", reason: "Naturally gluten-free" },
      { name: "Quinoa", amount: "80g", reason: "Protein-rich & GF" },
      { name: "Rice noodles", amount: "90g", reason: "Light GF option" },
      { name: "Buckwheat", amount: "80g", reason: "Nutty & gluten-free" },
      { name: "Sweet potato", amount: "150g", reason: "GF whole food carb" },
    ],
  },
  vegetables: {
    any: [
      { name: "Broccoli", amount: "120g", reason: "Vitamin C powerhouse", bestFor: ["lose_fat"] },
      { name: "Spinach", amount: "80g", reason: "Iron-rich leafy green", bestFor: ["lose_fat"] },
      { name: "Kale", amount: "80g", reason: "Super nutrient-dense", bestFor: ["lose_fat"] },
      { name: "Asparagus", amount: "120g", reason: "Low calorie & prebiotic" },
      { name: "Bell peppers", amount: "100g", reason: "Rich in vitamin C" },
      { name: "Zucchini", amount: "120g", reason: "Mild & very low calorie", bestFor: ["lose_fat"] },
      { name: "Green beans", amount: "120g", reason: "High fibre, low calorie" },
      { name: "Cauliflower", amount: "150g", reason: "Versatile & low carb", bestFor: ["lose_fat"] },
      { name: "Mushrooms", amount: "100g", reason: "Umami flavour boost" },
      { name: "Bok choy", amount: "100g", reason: "Calcium-rich Asian green" },
      { name: "Cucumber", amount: "100g", reason: "Hydrating & crunchy" },
      { name: "Cherry tomatoes", amount: "80g", reason: "Lycopene antioxidant" },
      { name: "Mixed greens", amount: "80g", reason: "Micronutrient mix" },
      { name: "Carrots", amount: "100g", reason: "Beta-carotene rich" },
      { name: "Sugar snap peas", amount: "100g", reason: "Crunchy & sweet" },
      { name: "Beetroot", amount: "80g", reason: "Nitrates for performance", bestFor: ["gain_muscle"] },
      { name: "Edamame", amount: "80g", reason: "Plant protein in veg form" },
      { name: "Cabbage", amount: "100g", reason: "Very high fibre, low calorie" },
    ],
  },
  fats: {
    any: [
      { name: "Avocado", amount: "½ medium", reason: "Heart-healthy monounsats" },
      { name: "Olive oil", amount: "1 tbsp", reason: "Anti-inflammatory fat" },
      { name: "Almonds", amount: "30g", reason: "Vitamin E & magnesium" },
      { name: "Walnuts", amount: "30g", reason: "ALA omega-3 rich" },
      { name: "Pumpkin seeds", amount: "25g", reason: "Zinc & magnesium source" },
      { name: "Sunflower seeds", amount: "25g", reason: "Vitamin E source" },
      { name: "Tahini", amount: "1 tbsp", reason: "Sesame-based richness" },
      { name: "Peanut butter", amount: "1 tbsp", reason: "Protein + fat combo", bestFor: ["gain_muscle"] },
      { name: "Almond butter", amount: "1 tbsp", reason: "Nutrient-dense spread" },
      { name: "Cashews", amount: "30g", reason: "Creamy, magnesium-rich" },
    ],
    keto: [
      { name: "Butter", amount: "2 tbsp", reason: "Pure saturated fat" },
      { name: "Coconut oil", amount: "1 tbsp", reason: "MCTs for quick energy" },
      { name: "Heavy cream", amount: "50ml", reason: "Rich keto fat" },
      { name: "Macadamia nuts", amount: "30g", reason: "Highest fat nut" },
      { name: "Avocado", amount: "1 whole", reason: "Keto-perfect fats" },
      { name: "Cream cheese", amount: "50g", reason: "Creamy low-carb fat" },
      { name: "MCT oil", amount: "1 tbsp", reason: "Instant keto fuel" },
    ],
    vegan: [
      { name: "Avocado", amount: "½ medium", reason: "Heart-healthy fats" },
      { name: "Olive oil", amount: "1 tbsp", reason: "Anti-inflammatory" },
      { name: "Coconut oil", amount: "1 tbsp", reason: "Plant-based cooking fat" },
      { name: "Tahini", amount: "2 tbsp", reason: "Sesame richness" },
      { name: "Flaxseeds", amount: "1 tbsp", reason: "Plant omega-3 source" },
      { name: "Chia seeds", amount: "1 tbsp", reason: "Omega-3 & fibre" },
      { name: "Peanut butter", amount: "2 tbsp", reason: "Protein + fat" },
    ],
  },
  fruit: {
    any: [
      { name: "Mixed berries", amount: "100g", reason: "Antioxidant-packed", bestFor: ["lose_fat"] },
      { name: "Blueberries", amount: "80g", reason: "High in anthocyanins", bestFor: ["lose_fat"] },
      { name: "Strawberries", amount: "100g", reason: "Vitamin C, low sugar", bestFor: ["lose_fat"] },
      { name: "Raspberries", amount: "80g", reason: "Very low sugar, high fibre", bestFor: ["lose_fat"] },
      { name: "Apple", amount: "1 medium", reason: "Fibre-rich & satisfying" },
      { name: "Banana", amount: "1 medium", reason: "Quick energy boost", bestFor: ["gain_muscle"] },
      { name: "Mango chunks", amount: "100g", reason: "Vitamin C & tropical" },
      { name: "Orange", amount: "1 medium", reason: "Vitamin C source" },
      { name: "Peach", amount: "1 medium", reason: "Low calorie & sweet" },
      { name: "Kiwi", amount: "2 whole", reason: "Vitamin C & digestive aid" },
      { name: "Pineapple chunks", amount: "100g", reason: "Bromelain enzyme" },
    ],
  },
  dairy: {
    any: [
      { name: "Greek yogurt", amount: "150g", reason: "High protein, gut-friendly", bestFor: ["gain_muscle"] },
      { name: "Cottage cheese", amount: "150g", reason: "Slow-release protein", bestFor: ["gain_muscle"] },
      { name: "Low-fat milk", amount: "200ml", reason: "Calcium & protein" },
      { name: "Feta cheese", amount: "40g", reason: "Bold flavour, lower fat" },
      { name: "Mozzarella", amount: "50g", reason: "Mild, lower calorie" },
      { name: "Parmesan", amount: "20g", reason: "Intense flavour, small amount" },
      { name: "Ricotta", amount: "80g", reason: "Creamy & versatile" },
    ],
    vegan: [
      { name: "Oat milk", amount: "200ml", reason: "Creamy dairy-free milk" },
      { name: "Soy milk", amount: "200ml", reason: "Highest protein plant milk" },
      { name: "Almond milk", amount: "200ml", reason: "Light dairy-free option", bestFor: ["lose_fat"] },
      { name: "Coconut yogurt", amount: "150g", reason: "Probiotic plant yogurt" },
      { name: "Cashew cream", amount: "50ml", reason: "Rich dairy-free cream" },
    ],
    keto: [
      { name: "Heavy cream", amount: "50ml", reason: "Rich, zero carbs" },
      { name: "Cream cheese", amount: "50g", reason: "Low carb & creamy" },
      { name: "Brie cheese", amount: "40g", reason: "Full fat keto choice" },
      { name: "Cheddar cheese", amount: "40g", reason: "Sharp flavour, keto-safe" },
    ],
  },
  other: {
    any: [
      { name: "Fresh herbs", amount: "to taste", reason: "Adds freshness" },
      { name: "Lemon juice", amount: "1 tbsp", reason: "Brightens any dish" },
      { name: "Nutritional yeast", amount: "1 tbsp", reason: "B12 & umami flavour" },
      { name: "Low-sodium soy sauce", amount: "1 tbsp", reason: "Umami depth" },
      { name: "Apple cider vinegar", amount: "1 tsp", reason: "Gut health support" },
      { name: "Mixed spices", amount: "1 tsp", reason: "Flavour without calories" },
      { name: "Balsamic vinegar", amount: "1 tbsp", reason: "Sweet & tangy finish" },
    ],
  },
};

// ─── Smart swap option builder ─────────────────────────────────────────────────

function rankByGoal(candidates: SwapOption[], goalType: string | null): SwapOption[] {
  const goalKey = goalType?.toLowerCase().replace(/[- ]/g, "_") ?? "";
  const primary = candidates.filter(c => c.bestFor?.includes(goalKey as "lose_fat" | "gain_muscle"));
  const rest = candidates.filter(c => !c.bestFor?.includes(goalKey as "lose_fat" | "gain_muscle"));
  return [...primary, ...rest];
}

export async function getSwapOptions(
  category: string,
  currentName: string,
  currentAmount: string,
  dietType: string | null,
  goalType: string | null,
  dislikedFoods: string[],
  allergies: string[],
): Promise<SwapOption[]> {
  const normalise = (s: string) => s.toLowerCase().trim();
  const excluded = new Set([currentName, ...dislikedFoods, ...allergies].map(normalise));

  // Fetch DB swaps from ingredient_swaps table
  let dbQuery = supabase
    .from("ingredient_swaps")
    .select("replacement_ingredient")
    .eq("food_category", category);
  if (dietType) {
    dbQuery = dbQuery.or(`diet_type.eq.${dietType},diet_type.is.null`);
  }
  const { data: dbSwaps } = await dbQuery.limit(20);

  const candidates: SwapOption[] = [];
  const seen = new Set<string>();

  const addIfSafe = (opt: SwapOption) => {
    const key = normalise(opt.name);
    if (!excluded.has(key) && !seen.has(key)) {
      seen.add(key);
      candidates.push(opt);
    }
  };

  // DB swaps first (with a generic reason)
  for (const row of dbSwaps ?? []) {
    addIfSafe({ name: row.replacement_ingredient, amount: currentAmount, reason: "Curated alternative" });
  }

  // Built-in pools: diet-specific → "any"
  const pool = INGREDIENT_POOLS[category] ?? {};
  const dietKey = dietType?.toLowerCase().replace(/[- ]/g, "_") ?? "";
  for (const opt of [...(pool[dietKey] ?? []), ...(pool["any"] ?? [])]) {
    addIfSafe(opt);
  }

  // Rank goal-aligned options first, return top 4
  return rankByGoal(candidates, goalType).slice(0, 4);
}

// ─── Swap Ingredient Mutation ─────────────────────────────────────────────────

export function useSwapIngredient() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStart();

  return useMutation({
    mutationFn: async ({
      mealId,
      ingredientIndex,
      chosenSwap,
    }: {
      mealId: string;
      ingredientIndex: number;
      chosenSwap: SwapOption;
    }) => {
      const { data: mealRow, error: fetchErr } = await supabase
        .from("meal_plans")
        .select("ingredients")
        .eq("id", mealId)
        .single();
      if (fetchErr) throw fetchErr;

      const ingredients: Ingredient[] = mealRow.ingredients;
      const current = ingredients[ingredientIndex];
      if (!current) throw new Error("Ingredient not found");

      const newIngredient: Ingredient = {
        name: chosenSwap.name,
        amount: chosenSwap.amount || current.amount,
        category: current.category,
      };

      const updated = ingredients.map((ing, i) => (i === ingredientIndex ? newIngredient : ing));

      const { error: updateErr } = await supabase
        .from("meal_plans")
        .update({ ingredients: updated })
        .eq("id", mealId);
      if (updateErr) throw updateErr;

      return { mealId, ingredientIndex, newIngredient };
    },

    onSuccess: ({ mealId, ingredientIndex, newIngredient }) => {
      queryClient.setQueryData(["meal_plans", weekStart], (old: MealPlan | null) => {
        if (!old) return old;
        return {
          ...old,
          days: old.days.map(d => ({
            ...d,
            meals: d.meals.map(m => {
              if (m.id !== mealId) return m;
              return {
                ...m,
                ingredients: m.ingredients.map((ing, i) =>
                  i === ingredientIndex ? newIngredient : ing,
                ),
              };
            }),
          })),
        };
      });
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useLogWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weightKg: number) => {
      const userId = await getUserId();
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("progress_logs").upsert(
        { user_id: userId, log_date: today, weight_kg: weightKg },
        { onConflict: "user_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress_logs"] });
      queryClient.invalidateQueries({ queryKey: ["progress_stats"] });
    },
  });
}

export function useToggleWorkoutComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, completed }: { date: string; completed: boolean }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("progress_logs").upsert(
        { user_id: userId, log_date: date, workout_completed: completed },
        { onConflict: "user_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress_logs"] });
      queryClient.invalidateQueries({ queryKey: ["progress_stats"] });
    },
  });
}

// ─── Generate / Regenerate Workout Plan ──────────────────────────────────────

export function useGenerateWorkoutPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Workout plan generation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout_plans"] });
    },
  });
}

// ─── Generate / Regenerate Meal Plan ─────────────────────────────────────────

export function useGenerateMealPlan() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStart();

  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      // ── Step 1: verify auth ────────────────────────────────────────────────
      console.log("[generateMealPlan] Step 1: checking auth");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      console.log("[generateMealPlan] Step 1 OK — user:", user.id);

      // ── Step 2: snapshot existing row IDs (do NOT delete yet) ─────────────
      // We record the IDs now so we can target them for deletion later,
      // only after the new plan is confirmed valid and fully inserted.
      console.log("[generateMealPlan] Step 2: reading existing row IDs for weekStart:", weekStart);
      const { data: existingRows, error: readError } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start", weekStart);
      if (readError) {
        console.error("[generateMealPlan] Step 2 FAILED — read error:", readError);
        throw new Error("Could not read existing meal plan: " + readError.message);
      }
      const oldIds: number[] = (existingRows ?? []).map((r: any) => r.id);
      console.log("[generateMealPlan] Step 2 OK — existing row IDs:", oldIds.length, "rows");

      // ── Step 3: call API to generate new plan ──────────────────────────────
      console.log("[generateMealPlan] Step 3: POST /api/meals");
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[generateMealPlan] Step 3 FAILED — API error:", res.status, body);
        throw new Error(body.error ?? `API error ${res.status}`);
      }
      const data = await res.json();
      const rawDays: any[] = data.days ?? [];
      console.log("[generateMealPlan] Step 3 OK — days received:", rawDays.length);

      // ── Step 4: validate and flatten into flat DB rows ────────────────────
      console.log("[generateMealPlan] Step 4: validating and flattening AI days");
      if (rawDays.length < 7) {
        throw new Error(`Incomplete plan received (${rawDays.length}/7 days). Old plan kept — please try again.`);
      }
      const rows = rawDays.flatMap((day: any) =>
        ((day.meals ?? []) as any[])
          .filter((meal: any) => meal && typeof meal === "object")
          .map((meal: any) => {
            const rawPlateDist = meal.plateDistribution ?? meal.plate_distribution;
            const plateDist =
              rawPlateDist && typeof rawPlateDist === "object" && !Array.isArray(rawPlateDist)
                ? rawPlateDist
                : {};
            return {
              user_id: user.id,
              week_start: weekStart,
              day_name: typeof day.day === "string" ? day.day : "monday",
              meal_type: typeof (meal.mealType ?? meal.meal_type) === "string"
                ? (meal.mealType ?? meal.meal_type)
                : "other",
              meal_name: typeof (meal.name ?? meal.meal_name) === "string" && (meal.name ?? meal.meal_name).trim()
                ? (meal.name ?? meal.meal_name).trim()
                : "Meal",
              ingredients: sanitizeIngredients(meal.ingredients),
              plate_distribution: plateDist,
            };
          })
      );
      if (rows.length < 7) {
        throw new Error(`Plan validation failed — too few meals (${rows.length}). Old plan kept — please try again.`);
      }
      console.log("[generateMealPlan] Step 4 OK — flat rows built:", rows.length);

      // ── Step 5: insert new rows (old rows still intact at this point) ──────
      console.log("[generateMealPlan] Step 5: inserting", rows.length, "new rows");
      const { error: insertError } = await supabase.from("meal_plans").insert(rows);
      if (insertError) {
        console.error("[generateMealPlan] Step 5 FAILED — insert error:", insertError);
        throw new Error("New plan could not be saved: " + insertError.message + ". Old plan kept.");
      }
      console.log("[generateMealPlan] Step 5 OK — new rows inserted");

      // ── Step 6: new plan confirmed — now delete old rows by their IDs ──────
      if (oldIds.length > 0) {
        console.log("[generateMealPlan] Step 6: removing", oldIds.length, "old rows");
        const { error: deleteError } = await supabase
          .from("meal_plans")
          .delete()
          .in("id", oldIds);
        if (deleteError) {
          // New plan is already saved — log the warning but don't fail the mutation.
          // The UI will show both old and new meals until the next cache refresh,
          // but on next load only the new rows will appear correctly.
          console.warn("[generateMealPlan] Step 6 WARNING — old row cleanup failed:", deleteError.message);
        } else {
          console.log("[generateMealPlan] Step 6 OK — old rows removed");
        }
      } else {
        console.log("[generateMealPlan] Step 6 SKIPPED — no old rows to remove");
      }
    },
    onSuccess: () => {
      // ── Step 7: invalidate query cache so UI re-fetches ───────────────────
      console.log("[generateMealPlan] Step 7: invalidating query cache for weekStart:", weekStart);
      queryClient.invalidateQueries({ queryKey: ["meal_plans", weekStart] });
      console.log("[generateMealPlan] Step 7 OK — cache invalidated");
    },
    onError: (err) => {
      console.error("[generateMealPlan] FAILED — existing plan preserved:", err);
    },
  });
}

// ─── Flex Days ──────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

export function useFlexDays(year: number, month: number) {
  return useQuery({
    queryKey: ["flex_days", year, month],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/flex-days?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch flex days");
      const data = await res.json();
      return (data.dates || []) as string[];
    },
  });
}

export function useToggleFlexDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, isFlexDay }: { date: string; isFlexDay: boolean }) => {
      const token = await getAccessToken();
      const res = await fetch("/api/flex-days", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date, remove: isFlexDay }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update flex day");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flex_days"] });
    },
  });
}

// ─── Workout History ─────────────────────────────────────────────────────────

export type WorkoutHistoryRecord = {
  workout_date: string;
  workout_type: string;
  exercises: Exercise[];
  duration_minutes: number;
};

export function useWorkoutHistory(year: number, month: number) {
  return useQuery({
    queryKey: ["workout_history", year, month],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/workout-history?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch workout history");
      const data = await res.json();
      return (data.history || []) as WorkoutHistoryRecord[];
    },
  });
}

export function useSaveWorkoutHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload:
        | { date: string; workout_type: string; exercises: Exercise[]; duration_minutes: number }
        | { date: string; remove: true },
    ) => {
      const token = await getAccessToken();
      const res = await fetch("/api/workout-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update workout history");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout_history"] });
    },
  });
}
