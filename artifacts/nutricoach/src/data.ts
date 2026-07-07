/**
 * GOALIQ Vision — mock data for the dashboard floors.
 * Static fixtures only; swap for real queries later without touching the UI.
 * (Floor 5 · Ajustes uses live hooks and has no mock here.)
 */

import type { Floor, VisionData } from "./types";

export const FLOORS: Floor[] = [
  { id: "home", index: 1, label: "Inicio" },
  { id: "meals", index: 2, label: "Comidas" },
  { id: "workout", index: 3, label: "Entrenos" },
  { id: "progress", index: 4, label: "Progreso" },
  { id: "settings", index: 5, label: "Ajustes" },
];

export const visionData: VisionData = {
  home: {
    greeting: "Buenos días",
    userName: "José",
    phrase: "Cada sesión cuenta. Vas firme este mes — sigue así.",
    dateLabel: "Viernes, 26 de junio",
    streak: 12,
    dailyGoal: { label: "Objetivo diario", value: 72, goal: 100, unit: "%" },
    rings: [
      { label: "Movimiento", value: 540, goal: 700, unit: "kcal" },
      { label: "Pasos", value: 8200, goal: 10000, unit: "" },
      { label: "Agua", value: 1.6, goal: 2.5, unit: "L" },
    ],
  },

  meal: {
    caloriesCurrent: 1480,
    caloriesGoal: 2200,
    macros: [
      { label: "Proteína", current: 112, goal: 165, unit: "g" },
      { label: "Carbos", current: 148, goal: 240, unit: "g" },
      { label: "Grasas", current: 44, goal: 70, unit: "g" },
    ],
    meals: [
      { id: "m1", name: "Yogur griego con frutos rojos", time: "08:30", kcal: 320, tag: "Desayuno", done: true },
      { id: "m2", name: "Bowl de pollo y arroz", time: "13:00", kcal: 640, tag: "Comida", done: true },
      { id: "m3", name: "Batido de proteína", time: "16:30", kcal: 220, tag: "Snack", done: true },
      { id: "m4", name: "Salmón con verduras", time: "20:00", kcal: 520, tag: "Cena", done: false },
    ],
  },

  workout: {
    title: "Tren Superior · Fuerza",
    focus: "Pecho · Hombros · Tríceps",
    durationMin: 52,
    totalKcal: 410,
    exercises: [
      { id: "e1", name: "Press banca con barra", sets: 4, reps: "8–10", muscle: "Pecho", done: true },
      { id: "e2", name: "Press militar", sets: 3, reps: "10", muscle: "Hombros", done: true },
      { id: "e3", name: "Press inclinado mancuernas", sets: 3, reps: "12", muscle: "Pecho", done: false },
      { id: "e4", name: "Elevaciones laterales", sets: 3, reps: "15", muscle: "Hombros", done: false },
      { id: "e5", name: "Extensión de tríceps en polea", sets: 3, reps: "12–15", muscle: "Tríceps", done: false },
    ],
  },

  progress: {
    goalWeight: 78,
    stats: [
      { label: "Peso", value: "82.4 kg", delta: -1.2, goodWhen: "down" },
      { label: "Grasa corporal", value: "16.8%", delta: -0.6, goodWhen: "down" },
      { label: "Masa magra", value: "68.5 kg", delta: 0.4, goodWhen: "up" },
      { label: "Entrenos", value: "12 / mes", delta: 3, goodWhen: "up" },
    ],
    weightSeries: [
      { week: "S1", weight: 85.1 },
      { week: "S2", weight: 84.6 },
      { week: "S3", weight: 84.0 },
      { week: "S4", weight: 83.5 },
      { week: "S5", weight: 83.0 },
      { week: "S6", weight: 82.4 },
    ],
  },
};
