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
  calories_approx: number | null;
  notes?: string | null;
};

export type DayMeals = {
  day: string;
  meals: MealRow[];
};

export type MealPlan = {
  id?: number | null;
  days: DayMeals[];
  weekStart: string;
};

export type Exercise = {
  name: string;
  exercise_id?: string | null;
  muscles?: string;
  sets?: number;
  reps?: number;
  duration_sec?: number;
  rest_sec?: number;
  notes?: string;
  exercise_type?: "strength" | "cardio" | "bodyweight" | "timed";
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
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/meals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch meal plan");
      }
      const data = await res.json();
      if (!data?.days) return null;

      // Normalize camelCase API response to MealRow shape
      const days = (data.days as any[]).map((day: any) => ({
        day: day.day,
        meals: (day.meals ?? []).map((meal: any): MealRow => ({
          id: meal.id ?? `${day.day}-${meal.mealType ?? meal.meal_type}`,
          day_name: day.day,
          meal_type: meal.mealType ?? meal.meal_type ?? "other",
          meal_name: meal.name ?? meal.meal_name ?? "Meal",
          ingredients: sanitizeIngredients(meal.ingredients ?? []),
          plate_distribution: meal.plate_distribution ?? {},
          calories_approx: meal.calories ?? meal.calories_approx ?? null,
          notes: meal.notes ?? null,
        })),
      }));

      return { days, weekStart: data.weekStart ?? weekStart, id: data.id ?? null };
    },
  });
}

// ─── Workout Plan ─────────────────────────────────────────────────────────────

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function normalizeDayName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (WEEKDAYS.includes(lower)) return lower;
  // "day 1" → "monday", "day 2" → "tuesday", etc.
  const match = lower.match(/day\s*(\d+)/);
  if (match) {
    const idx = parseInt(match[1]) - 1;
    return WEEKDAYS[idx % 7] ?? lower;
  }
  return lower;
}

export function useWorkoutPlan() {
  return useQuery({
    queryKey: ["workout_plans"],
    queryFn: async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/workouts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) return null; // no plan yet — not an error
        if (!res.ok) throw new Error("Failed to fetch workout plan");
        const data = await res.json();

        const rows = (data.days ?? []).map((r: any) => ({
          ...r,
          day_name: normalizeDayName(r.day_name),
        })) as WorkoutRow[];
        const trainingDays = new Set(rows.map(r => r.day_name));

        if (trainingDays.size === 0) return null;

        const days: DayWorkout[] = ALL_DAYS.map(day => ({
          day,
          isRestDay: !trainingDays.has(day),
          workout: rows.find(r => r.day_name === day),
        }));

        return { days, weekStart: data.weekStart, trainingDays } as WorkoutPlan;
      } catch (err) {
        console.error("[useWorkoutPlan] error:", err);
        return null;
      }
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

// ─── Spanish food name translations for swap options ──────────────────────────

const FOOD_NAMES_ES: Record<string, string> = {
  // protein
  "chicken breast": "Pechuga de pollo",
  "turkey breast": "Pechuga de pavo",
  "tuna (canned)": "Atún (lata)",
  "salmon fillet": "Filete de salmón",
  "lean beef strips": "Tiras de ternera magra",
  "shrimp": "Gambas",
  "eggs": "Huevos",
  "sardines": "Sardinas",
  "edamame": "Edamame",
  "cottage cheese": "Queso cottage",
  "firm tofu": "Tofu firme",
  "tempeh": "Tempeh",
  "chickpeas": "Garbanzos",
  "black beans": "Alubias negras",
  "red lentils": "Lentejas rojas",
  "seitan": "Seitán",
  "pea protein powder": "Proteína de guisante",
  "white beans": "Alubias blancas",
  "hemp seeds": "Semillas de cáñamo",
  "greek yogurt": "Yogur griego",
  "paneer": "Queso paneer",
  "mozzarella": "Mozzarella",
  "ribeye steak": "Entrecot de ternera",
  "chicken thighs": "Muslos de pollo",
  "bacon": "Bacón",
  "ground beef": "Carne picada de ternera",
  "smoked salmon": "Salmón ahumado",
  "lamb chops": "Chuletas de cordero",
  "tuna steak": "Filete de atún",
  "cod fillet": "Filete de bacalao",
  "mackerel": "Caballa",
  // carbs
  "brown rice": "Arroz integral",
  "sweet potato": "Boniato",
  "oats": "Avena",
  "quinoa": "Quinoa",
  "whole wheat pasta": "Pasta integral",
  "whole grain bread": "Pan integral",
  "couscous": "Cuscús",
  "buckwheat": "Trigo sarraceno",
  "barley": "Cebada",
  "baby potatoes": "Patatitas",
  "cauliflower rice": "Arroz de coliflor",
  "zucchini noodles": "Fideos de calabacín",
  "shirataki noodles": "Fideos shirataki",
  "rice noodles": "Fideos de arroz",
  // vegetables
  "broccoli": "Brócoli",
  "spinach": "Espinacas",
  "kale": "Col rizada",
  "asparagus": "Espárragos",
  "bell peppers": "Pimientos",
  "zucchini": "Calabacín",
  "green beans": "Judías verdes",
  "cauliflower": "Coliflor",
  "mushrooms": "Champiñones",
  "bok choy": "Col china",
  "cucumber": "Pepino",
  "cherry tomatoes": "Tomates cherry",
  "mixed greens": "Mezcla de lechugas",
  "carrots": "Zanahorias",
  "sugar snap peas": "Tirabeques",
  "beetroot": "Remolacha",
  "cabbage": "Col",
  // fats
  "avocado": "Aguacate",
  "olive oil": "Aceite de oliva",
  "almonds": "Almendras",
  "walnuts": "Nueces",
  "pumpkin seeds": "Pipas de calabaza",
  "sunflower seeds": "Pipas de girasol",
  "tahini": "Tahini",
  "peanut butter": "Mantequilla de cacahuete",
  "almond butter": "Mantequilla de almendras",
  "cashews": "Anacardos",
  "butter": "Mantequilla",
  "coconut oil": "Aceite de coco",
  "heavy cream": "Nata para montar",
  "macadamia nuts": "Nueces de macadamia",
  "cream cheese": "Queso crema",
  "mct oil": "Aceite MCT",
  "flaxseeds": "Semillas de lino",
  "chia seeds": "Semillas de chía",
  // fruit
  "mixed berries": "Frutos del bosque",
  "blueberries": "Arándanos",
  "strawberries": "Fresas",
  "raspberries": "Frambuesas",
  "apple": "Manzana",
  "banana": "Plátano",
  "mango chunks": "Trozos de mango",
  "orange": "Naranja",
  "peach": "Melocotón",
  "kiwi": "Kiwi",
  "pineapple chunks": "Trozos de piña",
  // dairy
  "low-fat milk": "Leche semidesnatada",
  "feta cheese": "Queso feta",
  "parmesan": "Parmesano",
  "ricotta": "Ricotta",
  "oat milk": "Leche de avena",
  "soy milk": "Leche de soja",
  "almond milk": "Leche de almendras",
  "coconut yogurt": "Yogur de coco",
  "cashew cream": "Crema de anacardos",
  "brie cheese": "Queso brie",
  "cheddar cheese": "Queso cheddar",
  // other
  "fresh herbs": "Hierbas frescas",
  "lemon juice": "Zumo de limón",
  "nutritional yeast": "Levadura nutricional",
  "low-sodium soy sauce": "Salsa de soja baja en sodio",
  "apple cider vinegar": "Vinagre de manzana",
  "mixed spices": "Especias mixtas",
  "balsamic vinegar": "Vinagre balsámico",
};

function translateFoodName(name: string, lang: "es" | "en"): string {
  if (lang !== "es") return name;
  return FOOD_NAMES_ES[name.toLowerCase()] ?? name;
}

// ─── Spanish reason translations for swap options ─────────────────────────────

const SWAP_REASONS_ES: Record<string, string> = {
  "Lean & versatile": "Magro y versátil",
  "Very lean protein": "Proteína muy magra",
  "High protein, low fat": "Alto en proteína, bajo en grasa",
  "Rich in omega-3s": "Rico en omega-3",
  "Iron-rich protein": "Proteína rica en hierro",
  "Low calorie, high protein": "Bajo en calorías, alto en proteína",
  "Complete amino profile": "Perfil de aminoácidos completo",
  "Omega-3 rich": "Rico en omega-3",
  "Plant-based & fibre-rich": "Vegetal y rico en fibra",
  "Slow-digesting protein": "Proteína de absorción lenta",
  "Neutral flavour, versatile": "Sabor neutro y versátil",
  "Fermented & high protein": "Fermentado y alto en proteína",
  "Protein & fibre combo": "Combo de proteína y fibra",
  "High fibre legume": "Legumbre alta en fibra",
  "Quick-cooking, iron-rich": "Cocción rápida, rico en hierro",
  "High protein meat alternative": "Alternativa cárnica alta en proteína",
  "Pure plant protein": "Proteína vegetal pura",
  "Mild & protein-rich": "Suave y rico en proteína",
  "Complete protein grain": "Cereal con proteína completa",
  "High protein & gut-friendly": "Alto en proteína y amigable con el intestino",
  "High protein dairy": "Lácteo alto en proteína",
  "Low fat plant protein": "Proteína vegetal baja en grasa",
  "High fat, zero carbs": "Alto en grasa, sin carbohidratos",
  "Protein & healthy fats": "Proteína y grasas saludables",
  "Juicy & high protein": "Jugoso y rico en proteína",
  "Keto staple": "Básico keto",
  "Zero carbs": "Sin carbohidratos",
  "Calorie-dense protein": "Proteína calórica",
  "Omega-3 rich, no carbs": "Rico en omega-3, sin carbohidratos",
  "Rich protein & iron": "Proteína y hierro",
  "Omega-3 powerhouse": "Fuente potente de omega-3",
  "Lean & high protein": "Magro y alto en proteína",
  "Low calorie seafood": "Marisco bajo en calorías",
  "Very lean white fish": "Pescado blanco muy magro",
  "Rich in healthy fats": "Rico en grasas saludables",
  "Highest lean protein": "Mayor proteína magra",
  "Slow-release protein": "Proteína de liberación lenta",
  "Very lean & high protein": "Muy magro y alto en proteína",
  "Pure protein, low fat": "Proteína pura, baja en grasa",
  "Protein-packed dairy": "Lácteo con mucha proteína",
  "Whole grain energy": "Energía de cereal integral",
  "Nutrient-dense carb": "Carbohidrato nutritivo",
  "Sustained energy release": "Liberación sostenida de energía",
  "Contains all essential amino acids": "Contiene todos los aminoácidos esenciales",
  "High fibre, low GI": "Alto en fibra, bajo índice glucémico",
  "High fibre pasta": "Pasta alta en fibra",
  "Convenient complex carb": "Carbohidrato complejo práctico",
  "Quick-cooking grain": "Cereal de cocción rápida",
  "Gluten-free whole grain": "Cereal integral sin gluten",
  "Very high fibre": "Muy alto en fibra",
  "Satisfying whole food": "Alimento completo y saciante",
  "Zero net carbs": "Sin carbohidratos netos",
  "Light & low carb": "Ligero y bajo en carbohidratos",
  "Nearly zero calories": "Prácticamente sin calorías",
  "Beta-glucan for heart health": "Beta-glucano para la salud cardíaca",
  "Light & versatile": "Ligero y versátil",
  "High in magnesium": "Alto en magnesio",
  "Naturally gluten-free": "Naturalmente sin gluten",
  "Protein-rich & GF": "Rico en proteína y sin gluten",
  "Light GF option": "Opción ligera sin gluten",
  "Nutty & gluten-free": "Sabor a nuez y sin gluten",
  "GF whole food carb": "Carbohidrato integral sin gluten",
  "Vitamin C powerhouse": "Gran fuente de vitamina C",
  "Iron-rich leafy green": "Hoja verde rica en hierro",
  "Super nutrient-dense": "Superalimento denso en nutrientes",
  "Low calorie & prebiotic": "Bajo en calorías y prebiótico",
  "Rich in vitamin C": "Rico en vitamina C",
  "Mild & very low calorie": "Suave y muy bajo en calorías",
  "High fibre, low calorie": "Alto en fibra, bajo en calorías",
  "Versatile & low carb": "Versátil y bajo en carbohidratos",
  "Umami flavour boost": "Potenciador de sabor umami",
  "Calcium-rich Asian green": "Verdura asiática rica en calcio",
  "Hydrating & crunchy": "Hidratante y crujiente",
  "Lycopene antioxidant": "Antioxidante de licopeno",
  "Micronutrient mix": "Mix de micronutrientes",
  "Beta-carotene rich": "Rico en betacaroteno",
  "Crunchy & sweet": "Crujiente y dulce",
  "Nitrates for performance": "Nitratos para el rendimiento",
  "Plant protein in veg form": "Proteína vegetal en verdura",
  "Very high fibre, low calorie": "Muy alto en fibra, bajo en calorías",
  "Heart-healthy monounsats": "Grasas monoinsaturadas cardioprotectoras",
  "Anti-inflammatory fat": "Grasa antiinflamatoria",
  "Vitamin E & magnesium": "Vitamina E y magnesio",
  "ALA omega-3 rich": "Rico en ALA omega-3",
  "Zinc & magnesium source": "Fuente de zinc y magnesio",
  "Vitamin E source": "Fuente de vitamina E",
  "Sesame-based richness": "Cremosidad de sésamo",
  "Protein + fat combo": "Combo proteína y grasa",
  "Nutrient-dense spread": "Crema nutritiva",
  "Creamy, magnesium-rich": "Cremoso y rico en magnesio",
  "Pure saturated fat": "Grasa saturada pura",
  "MCTs for quick energy": "MCT para energía rápida",
  "Rich keto fat": "Grasa keto rica",
  "Highest fat nut": "Fruto seco más graso",
  "Keto-perfect fats": "Grasas perfectas para keto",
  "Creamy low-carb fat": "Grasa cremosa baja en carbohidratos",
  "Instant keto fuel": "Combustible keto instantáneo",
  "Heart-healthy fats": "Grasas cardioprotectoras",
  "Anti-inflammatory": "Antiinflamatorio",
  "Plant-based cooking fat": "Grasa de cocina vegetal",
  "Sesame richness": "Cremosidad de sésamo",
  "Plant omega-3 source": "Fuente vegetal de omega-3",
  "Omega-3 & fibre": "Omega-3 y fibra",
  "Protein + fat": "Proteína y grasa",
  "Antioxidant-packed": "Cargado de antioxidantes",
  "High in anthocyanins": "Alto en antocianinas",
  "Vitamin C, low sugar": "Vitamina C, bajo en azúcar",
  "Very low sugar, high fibre": "Muy bajo en azúcar, alto en fibra",
  "Fibre-rich & satisfying": "Rico en fibra y saciante",
  "Quick energy boost": "Aporte rápido de energía",
  "Vitamin C & tropical": "Vitamina C y sabor tropical",
  "Vitamin C source": "Fuente de vitamina C",
  "Low calorie & sweet": "Bajo en calorías y dulce",
  "Vitamin C & digestive aid": "Vitamina C y digestivo",
  "Bromelain enzyme": "Enzima bromelaína",
  "High protein, gut-friendly": "Alto en proteína y digestivo",
  "Bold flavour, lower fat": "Sabor intenso, menos grasa",
  "Mild, lower calorie": "Suave, menos calorías",
  "Intense flavour, small amount": "Sabor intenso en poca cantidad",
  "Creamy & versatile": "Cremoso y versátil",
  "Creamy dairy-free milk": "Leche vegetal cremosa",
  "Highest protein plant milk": "Leche vegetal con más proteína",
  "Light dairy-free option": "Opción ligera sin lácteos",
  "Probiotic plant yogurt": "Yogur vegetal probiótico",
  "Rich dairy-free cream": "Crema vegetal rica",
  "Rich, zero carbs": "Rico, sin carbohidratos",
  "Low carb & creamy": "Bajo en carbohidratos y cremoso",
  "Full fat keto choice": "Opción keto con grasa completa",
  "Sharp flavour, keto-safe": "Sabor intenso, apto para keto",
  "Adds freshness": "Aporta frescura",
  "Brightens any dish": "Realza cualquier plato",
  "B12 & umami flavour": "B12 y sabor umami",
  "Umami depth": "Profundidad umami",
  "Gut health support": "Apoyo a la salud intestinal",
  "Flavour without calories": "Sabor sin calorías",
  "Sweet & tangy finish": "Toque dulce y ácido",
  "Calcium & protein": "Calcio y proteína",
  "Calcium-rich protein": "Proteína rica en calcio",
  "Curated alternative": "Alternativa curada",
  "Whole grain, steady energy": "Cereal integral, energía estable",
};

function translateReason(reason: string, lang: "es" | "en"): string {
  if (lang !== "es") return reason;
  return SWAP_REASONS_ES[reason] ?? reason;
}

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
  lang: "es" | "en" = "es",
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

  // Rank goal-aligned options first, translate names and reasons if needed, return top 4
  return rankByGoal(candidates, goalType)
    .slice(0, 4)
    .map(opt => ({
      ...opt,
      name: translateFoodName(opt.name, lang),
      reason: translateReason(opt.reason, lang),
    }));
}

// ─── Swap Ingredient Mutation ─────────────────────────────────────────────────

export function useSwapIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mealPlanId,
      dayOfWeek,
      mealType,
      ingredientName,
      lang,
      chosenReplacement,
    }: {
      mealPlanId: number;
      dayOfWeek: string;
      mealType: string;
      ingredientName: string;
      lang?: string;
      chosenReplacement?: { name: string; amount: string };
    }) => {
      const token = await getAccessToken();
      const res = await fetch("/api/meals/replace-ingredient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mealPlanId, dayOfWeek, mealType, ingredientName, lang: lang ?? "es", chosenReplacement }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to replace ingredient");
      }
      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal_plans"] });
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
    mutationKey: ["generate-workout"],
    mutationFn: async ({ lang = "es" }: { lang?: "es" | "en" } = {}) => {
      const token = await getAccessToken();
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
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
    mutationKey: ["generate-meal"],
    mutationFn: async ({ token: providedToken, lang: providedLang }: { token?: string; lang?: "es" | "en" } = {}) => {
      const token = providedToken ?? await getAccessToken();
      const lang: "es" | "en" = providedLang ?? (localStorage.getItem("goaliq_lang") as "es" | "en") ?? "es";

      const res = await fetch("/api/meals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lang }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Meal plan generation failed. Please try again.");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal_plans", weekStart] });
      queryClient.invalidateQueries({ queryKey: ["meal_plans"] });
    },
  });
}

// ─── Flex Days ──────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  // Session absent or expired — try refreshing before giving up
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed?.access_token) return refreshed.access_token;

  throw new Error("No active session");
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

// ─── Strength Logs ───────────────────────────────────────────────────────────

export type StrengthLog = {
  id: number;
  exercise_name: string;
  muscle_group: string;
  weight_kg: number;
  reps: number;
  logged_at: string;
  week_start: string;
};

export function useStrengthLogs(muscle: string | null) {
  return useQuery({
    queryKey: ["strength_logs", muscle],
    queryFn: async () => {
      const token = await getAccessToken();
      const url = muscle
        ? `/api/strength?muscle=${encodeURIComponent(muscle)}`
        : "/api/strength";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch strength logs");
      const data = await res.json();
      return (data.logs || []) as StrengthLog[];
    },
    enabled: muscle !== undefined,
  });
}

export function useSaveStrengthLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      exerciseName: string;
      muscleGroup: string;
      weightKg: number;
      reps: number;
      distanceKm?: number;
      durationMin?: number;
      paceMinPerKm?: number;
      heartRateAvg?: number;
    }) => {
      const token = await getAccessToken();
      const res = await fetch("/api/strength", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save strength log");
      }
      return res.json() as Promise<{
        log: StrengthLog;
        isNewPR: boolean;
        prDelta: number | null;
        prevMax: number | null;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strength_logs"] });
      queryClient.invalidateQueries({ queryKey: ["strength_muscles"] });
    },
  });
}

export function useStrengthMuscles() {
  return useQuery({
    queryKey: ["strength_muscles"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/strength/muscles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch muscle groups");
      const data = await res.json();
      return (data.muscles || []) as string[];
    },
  });
}

export function useStrengthGroups() {
  return useQuery({
    queryKey: ["strength_groups"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/strength/groups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch strength groups");
      const data = await res.json();
      return (data.groups || []) as string[];
    },
  });
}

export function useStrengthGroupLogs(group: string | null) {
  return useQuery({
    queryKey: ["strength_group_logs", group],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/strength/group?group=${encodeURIComponent(group!)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch group logs");
      const data = await res.json();
      return {
        byMuscle: (data.byMuscle || {}) as Record<string, StrengthLog[]>,
        muscles: (data.muscles || []) as string[],
      };
    },
    enabled: group !== null,
  });
}

// ─── Wger exercise database ────────────────────────────────────────────────────

export type WgerExercise = {
  id: number;
  name: string;
  description: string;
  muscles: string[];
  category: string;
  imageStart: string | null;
  imageEnd: string | null;
};

export function useWgerExercises(muscle: string | null, lang: string) {
  return useQuery({
    queryKey: ["wger_exercises", muscle, lang],
    queryFn: async () => {
      const url = muscle
        ? `/api/exercises/wger?muscle=${encodeURIComponent(muscle)}&lang=${lang}`
        : `/api/exercises/wger?lang=${lang}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch Wger exercises");
      const data = await res.json();
      return (data.exercises || []) as WgerExercise[];
    },
    enabled: muscle !== null,
    staleTime: 60 * 60 * 1000, // 1 hour
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
