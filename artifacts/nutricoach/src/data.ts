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
      { id: "e1", name: "Press banca con barra", sets: 4, reps: "8–10", muscle: "Pecho", done: true,
        clip: "/clips/exercises/press-banca.webm",
        tip: "Baja controlado hasta rozar el pecho, codos a ~45° del torso; empuja sin rebotar." },
      { id: "e2", name: "Press militar", sets: 3, reps: "10", muscle: "Hombros", done: true,
        clip: "/clips/exercises/press-militar.webm",
        tip: "Core y glúteos firmes; sube la barra sin arquear la zona lumbar." },
      { id: "e3", name: "Press inclinado mancuernas", sets: 3, reps: "12", muscle: "Pecho", done: false,
        clip: "/clips/exercises/press-inclinado.webm",
        tip: "Banco a 30°; baja hasta notar estiramiento y sube sin chocar las mancuernas." },
      { id: "e4", name: "Elevaciones laterales", sets: 3, reps: "15", muscle: "Hombros", done: false,
        clip: "/clips/exercises/elevaciones-laterales.webm",
        tip: "Sube hasta la altura del hombro, codos algo flexionados; sin impulso ni balanceo." },
      { id: "e5", name: "Extensión de tríceps en polea", sets: 3, reps: "12–15", muscle: "Tríceps", done: false,
        clip: "/clips/exercises/extension-triceps.webm",
        tip: "Codos pegados al cuerpo; extiende del todo y controla la vuelta." },
    ],
  },

  progress: {
    goalWeight: 78,
    weekLabel: "Semana 4",
    weekSeriesTotal: 81,
    muscleGroups: [
      { name: "Pecho", series: 22, advice: "Para un pectoral estético y lleno, asegúrate de equilibrar el trabajo del haz clavicular (superior) con el pectoral medio. Intenta que al menos el 40% del volumen sea en presses inclinados.",
        subgroups: [ { name: "Medio", series: 9, pct: 41 }, { name: "Superior", series: 9, pct: 41 }, { name: "Inferior", series: 4, pct: 18 } ] },
      { name: "Espalda", series: 14, advice: "La amplitud de la espalda se logra con jalones y dominadas (dorsal ancho), mientras que la densidad requiere remos pesados (trapecio y romboides). No descuides la lumbar para dar estabilidad.",
        subgroups: [ { name: "Dorsal Ancho", series: 7, pct: 50 }, { name: "Trapecio", series: 4, pct: 29 }, { name: "Lumbar", series: 3, pct: 21 } ] },
      { name: "Piernas", series: 18, advice: "El entrenamiento de pierna debe ser completo. Intenta balancear el empuje de rodilla (cuádriceps) con la bisagra de cadera (femorales y glúteos) para prevenir lesiones y mejorar la postura.",
        subgroups: [ { name: "Cuádriceps", series: 5, pct: 28 }, { name: "Pantorrillas", series: 5, pct: 28 }, { name: "Femorales", series: 4, pct: 22 }, { name: "Glúteos", series: 4, pct: 22 } ] },
      { name: "Hombros", series: 12, advice: "El deltoides lateral le da amplitud a tu silueta. Combina press militar para deltoides anterior con elevaciones laterales y pájaros para conseguir unos hombros verdaderamente redondeados o en 3D.",
        subgroups: [ { name: "Anterior", series: 4, pct: 33 }, { name: "Lateral", series: 4, pct: 33 }, { name: "Posterior", series: 4, pct: 33 } ] },
      { name: "Core", series: 6, advice: "Un core fuerte estabiliza toda tu columna. No busques solo fatiga; enfócate en la estabilidad y control mediante planchas y rotación con giros rusos.",
        subgroups: [ { name: "Abdominales", series: 3, pct: 50 }, { name: "Oblicuos", series: 3, pct: 50 } ] },
      { name: "Brazos", series: 9, advice: "Bíceps y tríceps ya reciben trabajo indirecto en cada press y cada remo. El tríceps es dos tercios del brazo: si buscas volumen, dale prioridad sobre el curl.",
        subgroups: [ { name: "Tríceps", series: 6, pct: 67 }, { name: "Bíceps", series: 3, pct: 33 } ] },
    ],
    stats: [
      { label: "Peso", value: "82.1 kg", delta: -0.3, goodWhen: "down" },
      { label: "Grasa corporal", value: "16.8%", delta: -0.6, goodWhen: "down" },
      { label: "Masa magra", value: "68.5 kg", delta: 0.4, goodWhen: "up" },
      { label: "Entrenos", value: "12 / mes", delta: 3, goodWhen: "up" },
    ],
    weightSeries: [
      { week: "10/06", weight: 83.6 },
      { week: "17/06", weight: 83.2 },
      { week: "24/06", weight: 82.8 },
      { week: "01/07", weight: 82.4 },
      { week: "08/07", weight: 82.1 },
    ],
  },
};
