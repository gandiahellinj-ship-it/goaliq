/**
 * GOALIQ Vision — type definitions for the 5-floor swipeable dashboard.
 * Floors: Home · Comidas · Entrenos · Progreso · Ajustes.
 */

export type FloorId = "home" | "meals" | "workout" | "progress" | "settings";

export interface Floor {
  id: FloorId;
  /** 1-based index, used for the side dot-nav and aria labels. */
  index: number;
  label: string;
}

/* ── Floor 1 · Home ─────────────────────────────────────────────────── */

export interface ActivityRing {
  label: string;
  value: number;
  /** Objetivo — solo lo usa la maqueta; los chips reales no tienen objetivo aún. */
  goal?: number;
  unit: string;
}

export interface HomeData {
  greeting: string;
  userName: string;
  /** Frase motivacional (solo maqueta; sin fuente real aún). */
  phrase?: string;
  dateLabel: string;
  /** Racha de días sellados. OCULTA hasta que exista el bucle diario
   *  (decisión José 24/07/2026) — si es undefined, no se pinta. */
  streak?: number;
  /** Big central ring (overall daily completion). Solo maqueta. */
  dailyGoal?: ActivityRing;
  /** Chips numéricos (datos reales: Proteína hoy · Series esta semana). */
  rings: ActivityRing[];
}

/* ── Floor 2 · Comidas ──────────────────────────────────────────────── */

export interface Macro {
  label: string;
  current: number;
  goal: number;
  unit: string;
}

export interface MealItem {
  id: string;
  name: string;
  /** e.g. "08:30" */
  time: string;
  kcal: number;
  /** Etiqueta del tipo de comida ("Desayuno", "Media mañana", …). Datos reales
   *  usan los 5 tipos del plan; la maqueta usaba 4 fijos. */
  tag: string;
  done: boolean;
  /** Transparent-PNG dish photo under /images/dishes/ (optional → initials fallback). */
  image?: string;
  /** Ingredientes ESTRUCTURADOS para la foto generada (con visual_ref en inglés):
   *  fuente de la clave de caché compartida + del prompt. Distinto de `ingredients`
   *  (cadenas para mostrar). */
  imageIngredients?: { name: string; visual_ref?: string; category?: string }[];
  /** true si el plato es bebida (variante de prompt del vaso). */
  isDrink?: boolean;
  /** 5–8 ingredients with quantity, e.g. "200 g yogur griego". */
  ingredients?: string[];
  /** 2–4 short preparation steps. */
  preparation?: string[];
}

export interface MealData {
  caloriesCurrent: number;
  caloriesGoal: number;
  macros: Macro[];
  meals: MealItem[];
}

/* ── Floor 3 · Entrenos ─────────────────────────────────────────────── */

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  muscle: string;
  done: boolean;
  /** Looping demo clip under /clips/exercises/ (optional → animated placeholder). */
  clip?: string;
  /** 1–2 short technique cues. */
  tip?: string;
}

export interface WorkoutData {
  title: string;
  focus: string;
  durationMin: number;
  /** kcal estimadas del entreno. Los planes reales no la traen → se omite. */
  totalKcal?: number;
  exercises: Exercise[];
}

/* ── Floor 4 · Progreso ─────────────────────────────────────────────── */

export interface ProgressStat {
  label: string;
  value: string;
  delta: number;
  /** Direction the delta is "good" — used only for color, not the sign. */
  goodWhen: "up" | "down";
}

export interface WeightPoint {
  week: string;
  weight: number;
}

export interface MuscleSubgroup {
  name: string;
  series: number;
  /** Share of the group's series, 0–100. */
  pct: number;
}

export interface MuscleGroup {
  name: string;
  /** Series completed this week (drives mountain height + colour). */
  series: number;
  subgroups: MuscleSubgroup[];
  /** Coach advice (verbatim mock), shown in the contextual analysis. */
  advice: string;
}

export interface ProgressData {
  stats: ProgressStat[];
  weightSeries: WeightPoint[];
  goalWeight: number;
  /** Muscle-landscape (Phase 4b). */
  weekLabel: string;
  weekSeriesTotal: number;
  muscleGroups: MuscleGroup[];
}

/* ── Aggregate (Floor 5 · Ajustes uses live hooks, no mock) ─────────── */

export interface VisionData {
  home: HomeData;
  meal: MealData;
  workout: WorkoutData;
  progress: ProgressData;
}
