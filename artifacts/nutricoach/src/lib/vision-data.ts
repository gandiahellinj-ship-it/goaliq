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
import {
  useMealPlan,
  useDailyMacros,
  useWorkoutPlan,
  useProfile,
  useStrengthLogs,
  getWeekStart,
} from "./supabase-queries";
import type { MealRow, Ingredient, Exercise as PlanExercise } from "./supabase-queries";
import type { MealItem, Exercise, ActivityRing } from "@/types";

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

/* ── Fase B · ENTRENOS ─────────────────────────────────────────────────── */

/** Estimación de duración — misma convención que la app antigua
    (Workouts.tsx): 45 s por serie + descansos, +10 min de calentamiento,
    redondeado a múltiplos de 5. Los planes reales NO traen kcal de entreno:
    no se inventa. */
function estimateDurationMin(exercises: PlanExercise[]): number {
  if (!exercises.length) return 0;
  let totalSeconds = 0;
  for (const ex of exercises) {
    const sets = ex.sets ?? 3;
    const restSec = ex.rest_sec ?? 60;
    totalSeconds += sets * 45 + sets * restSec;
  }
  return Math.round((totalSeconds / 60 + 10) / 5) * 5;
}

/** "strength" → "Fuerza", etc. — títulos legibles para workout_type. */
const WORKOUT_TYPE_LABEL: Record<string, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  bodyweight: "Peso corporal",
  mixed: "Mixto",
  hiit: "HIIT",
};

export interface VisionWorkoutData {
  loading: boolean;
  /** false si el usuario no tiene plan de entrenos. */
  hasPlan: boolean;
  /** true si HOY es día de descanso según el plan. */
  isRestDay: boolean;
  title: string;
  focus: string;
  durationMin: number;
  /** Ejercicios de HOY. done=false (efímero, como en COMIDAS). */
  exercises: Exercise[];
}

/* ── Fase C · HOME ─────────────────────────────────────────────────────── */

export interface VisionHomeData {
  loading: boolean;
  greeting: string;
  userName: string;
  /** "viernes, 24 de julio" con inicial mayúscula. */
  dateLabel: string;
  /** Chips reales: Proteína hoy (g) · Series esta semana. La racha y el
   *  % de Cumplimiento llegan con el bucle diario (decisión 24/07/2026). */
  chips: ActivityRing[];
}

export function useVisionHome(): VisionHomeData {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: dailyMacros, isLoading: macrosLoading } = useDailyMacros();
  // Todas las series registradas; se filtran a la semana actual (week_start).
  const { data: strengthLogs, isLoading: strengthLoading } = useStrengthLogs(null);

  return useMemo(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

    const raw = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    const dateLabel = raw.charAt(0).toUpperCase() + raw.slice(1);

    const weekStart = getWeekStart();
    // Cada fila de strength_logs es UNA serie registrada (peso × reps).
    const weeklySeries = (strengthLogs ?? []).filter((l) => l.week_start === weekStart).length;

    const chips: ActivityRing[] = [
      { label: "Proteína hoy", value: Math.round(dailyMacros?.proteinToday ?? 0), unit: "g" },
      { label: "Series esta semana", value: weeklySeries, unit: "" },
    ];

    return {
      loading: profileLoading || macrosLoading || strengthLoading,
      greeting,
      userName: profile?.full_name?.split(/\s+/)[0] ?? "",
      dateLabel,
      chips,
    };
  }, [profile, profileLoading, dailyMacros, macrosLoading, strengthLogs, strengthLoading]);
}

export function useVisionWorkout(): VisionWorkoutData {
  const { data: plan, isLoading } = useWorkoutPlan();

  return useMemo(() => {
    const todayName = WEEKDAY_BY_INDEX[new Date().getDay()];
    const today = plan?.days?.find((d) => d.day === todayName);
    const planExercises: PlanExercise[] = today?.workout?.exercises ?? [];

    const exercises: Exercise[] = planExercises.map((e, i) => ({
      id: e.exercise_id ?? `${todayName}-ex-${i}`,
      name: e.name,
      sets: e.sets ?? 3,
      // reps numéricas del plan; los de tiempo (cardio/timed) se expresan en min.
      reps:
        e.reps != null
          ? String(e.reps)
          : e.duration_sec != null
            ? `${Math.max(1, Math.round(e.duration_sec / 60))} min`
            : "—",
      muscle: e.muscles ?? "",
      done: false,
      // Sin clips reales aún (decisión de fuente abierta) → placeholder animado.
      tip: e.notes || undefined,
    }));

    const rawType = today?.workout?.workout_type ?? "";
    const title =
      WORKOUT_TYPE_LABEL[rawType.toLowerCase()] ??
      (rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : "Entrenamiento");

    // Focus = músculos únicos del día, en orden de aparición.
    const muscles = [...new Set(exercises.map((e) => e.muscle).filter(Boolean))];

    return {
      loading: isLoading,
      hasPlan: Boolean(plan),
      isRestDay: Boolean(plan) && (today?.isRestDay ?? true),
      title,
      focus: muscles.slice(0, 3).join(" · "),
      durationMin: today?.workout?.duration_minutes ?? estimateDurationMin(planExercises),
      exercises,
    };
  }, [plan, isLoading]);
}
