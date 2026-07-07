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
  goal: number;
  unit: string;
}

export interface HomeData {
  greeting: string;
  userName: string;
  phrase: string;
  dateLabel: string;
  streak: number;
  /** Big central ring (overall daily completion). */
  dailyGoal: ActivityRing;
  /** Secondary rings shown smaller below. */
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
  tag: "Desayuno" | "Comida" | "Cena" | "Snack";
  done: boolean;
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
}

export interface WorkoutData {
  title: string;
  focus: string;
  durationMin: number;
  totalKcal: number;
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

export interface ProgressData {
  stats: ProgressStat[];
  weightSeries: WeightPoint[];
  goalWeight: number;
}

/* ── Aggregate (Floor 5 · Ajustes uses live hooks, no mock) ─────────── */

export interface VisionData {
  home: HomeData;
  meal: MealData;
  workout: WorkoutData;
  progress: ProgressData;
}
