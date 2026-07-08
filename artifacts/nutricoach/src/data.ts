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
      {
        id: "m1", name: "Yogur griego con frutos rojos", time: "08:30", kcal: 320, tag: "Desayuno", done: true,
        image: "/images/dishes/desayuno.png",
        ingredients: ["200 g yogur griego natural", "60 g frambuesas", "50 g arándanos", "20 g nueces", "15 g miel", "10 g copos de avena"],
        preparation: ["Pon el yogur en un bol.", "Reparte los frutos rojos y las nueces.", "Riega con miel y espolvorea la avena."],
      },
      {
        id: "m2", name: "Bowl de pollo y arroz", time: "13:00", kcal: 640, tag: "Comida", done: true,
        image: "/images/dishes/comida.png",
        ingredients: ["150 g pechuga de pollo", "120 g arroz cocido", "80 g brócoli", "10 ml aceite de oliva", "1 diente de ajo", "sal y pimienta"],
        preparation: ["Cocina el arroz.", "Saltea el pollo con ajo, sal y pimienta.", "Cuece el brócoli al vapor.", "Monta el bol y aliña con aceite."],
      },
      {
        id: "m3", name: "Batido de proteína", time: "16:30", kcal: 220, tag: "Snack", done: true,
        image: "/images/dishes/snack.png",
        ingredients: ["250 ml leche desnatada", "30 g proteína de suero (cacao)", "1 plátano", "5 g cacao puro", "hielo"],
        preparation: ["Añade todo a la batidora.", "Bate 30 s hasta que espume."],
      },
      {
        id: "m4", name: "Salmón con verduras", time: "20:00", kcal: 520, tag: "Cena", done: false,
        image: "/images/dishes/cena.png",
        ingredients: ["160 g salmón fresco", "100 g espárragos verdes", "80 g coles de Bruselas", "60 g brócoli", "10 ml aceite de oliva", "½ limón", "eneldo fresco", "sal"],
        preparation: ["Precalienta el horno a 200 °C.", "Coloca el salmón y las verduras en la bandeja.", "Aliña con aceite, limón y eneldo.", "Hornea 15–18 min."],
      },
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
