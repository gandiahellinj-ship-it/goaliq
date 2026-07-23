/**
 * GOALIQ Vision — adaptador de datos reales.
 *
 * Convierte los ganchos reales de la app (supabase-queries.ts) a las formas
 * que consume la interfaz /vision. REGLA: este archivo solo CONSUME los
 * ganchos existentes; nunca se modifica supabase-queries.ts ni la app antigua.
 *
 * Fase A (COMIDAS): plan semanal real → comidas de hoy. Los checks siguen
 * siendo efímeros (el registro real llega con FLUJO_DIARIO). Los planes
 * reales NO traen pasos de preparación ni fotos (fallback: iniciales).
 */
import { useMemo } from "react";
import { useMealPlan, useDailyMacros } from "./supabase-queries";
import type { MealRow, Ingredient } from "./supabase-queries";
import type { MealItem } from "@/types";

/* Convenciones de tipos de comida — mismos valores que usa la app antigua
   (ComidasTab.tsx). Duplicados aquí a propósito: no tocamos archivos de la
   app antigua; unificar es parte del punto 5 de la auditoría (limpieza). */
const MEAL_ORDER = ["breakfast", "snack_morning", "lunch", "snack_afternoon", "dinner"] as const;

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Desayuno",
  snack_morning: "Media mañana",
  lunch: "Comida",
  snack_afternoon: "Merienda",
  dinner: "Cena",
};

const MEAL_HOUR: Record<string, number> = {
  breakfast: 8,
  snack_morning: 11,
  lunch: 14,
  snack_afternoon: 17,
  dinner: 21,
};

const CALORIES_FALLBACK: Record<string, number> = {
  breakfast: 400,
  snack_morning: 175,
  lunch: 600,
  snack_afternoon: 175,
  dinner: 500,
};

/** JS getDay() (0=domingo) → nombre de día usado por el plan (monday…sunday). */
const WEEKDAY_BY_INDEX = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export interface VisionMealsData {
  /** true mientras cargan plan o macros. */
  loading: boolean;
  /** false si el usuario aún no tiene plan generado esta semana. */
  hasPlan: boolean;
  /** Comidas de HOY del plan real, en orden de hora. done=false (efímero). */
  meals: MealItem[];
  /** Objetivo kcal de hoy = suma de las kcal del plan de hoy. */
  caloriesGoal: number;
  /** Macros consumidos hoy de verdad (meal_logs); null si aún no hay registros. */
  macrosToday: { protein: number; carbs: number; fats: number } | null;
}

export function useVisionMeals(): VisionMealsData {
  const { data: plan, isLoading: planLoading } = useMealPlan();
  const { data: dailyMacros, isLoading: macrosLoading } = useDailyMacros();

  return useMemo(() => {
    const todayName = WEEKDAY_BY_INDEX[new Date().getDay()];
    const today = plan?.days?.find((d) => d.day === todayName);

    const meals: MealItem[] = (today?.meals ?? [])
      .slice()
      .sort(
        (a: MealRow, b: MealRow) =>
          MEAL_ORDER.indexOf(a.meal_type as (typeof MEAL_ORDER)[number]) -
          MEAL_ORDER.indexOf(b.meal_type as (typeof MEAL_ORDER)[number]),
      )
      .map((m: MealRow) => ({
        id: String(m.id),
        name: m.meal_name,
        time: `${String(MEAL_HOUR[m.meal_type] ?? 12).padStart(2, "0")}:00`,
        kcal: m.calories_approx ?? CALORIES_FALLBACK[m.meal_type] ?? 400,
        tag: MEAL_LABEL[m.meal_type] ?? m.meal_type,
        done: false,
        // Sin foto real todavía (proyecto de generación de imágenes pendiente)
        // → DishImage pinta el círculo con iniciales.
        ingredients: (m.ingredients ?? []).map((i: Ingredient) =>
          [i.amount, i.name].filter(Boolean).join(" ").trim(),
        ),
        // Los planes reales no traen preparación: el bloque se oculta solo.
      }));

    const caloriesGoal = meals.reduce((s, m) => s + m.kcal, 0);

    const macrosToday =
      dailyMacros && dailyMacros.count > 0
        ? {
            protein: dailyMacros.proteinToday,
            carbs: dailyMacros.carbsToday,
            fats: dailyMacros.fatsToday,
          }
        : null;

    return {
      loading: planLoading || macrosLoading,
      hasPlan: Boolean(plan) && meals.length > 0,
      meals,
      caloriesGoal,
      macrosToday,
    };
  }, [plan, planLoading, dailyMacros, macrosLoading]);
}
