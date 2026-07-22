export interface Supplement {
  id: string;
  emoji: string;
  name: string;
  shortDesc: string;
}

export const SUPPLEMENTS: Supplement[] = [
  { id: "proteina_polvo", emoji: "🥛", name: "Proteína en polvo",   shortDesc: "Síntesis muscular y recuperación" },
  { id: "creatina",       emoji: "⚡", name: "Creatina",            shortDesc: "Fuerza, potencia y energía muscular" },
  { id: "vitamina_d",     emoji: "☀️", name: "Vitamina D",          shortDesc: "Huesos, inmunidad y hormonas" },
  { id: "magnesio",       emoji: "🌙", name: "Magnesio",            shortDesc: "Sueño, recuperación y energía" },
  { id: "omega_3",        emoji: "🐟", name: "Omega 3",             shortDesc: "Antiinflamatorio y salud cardiovascular" },
  { id: "vitamina_c",     emoji: "🍊", name: "Vitamina C",          shortDesc: "Inmunidad y antioxidante" },
  { id: "zinc",           emoji: "🔩", name: "Zinc",               shortDesc: "Testosterona, inmunidad y cicatrización" },
  { id: "hierro",         emoji: "🩸", name: "Hierro",             shortDesc: "Energía y transporte de oxígeno" },
  { id: "colageno",       emoji: "💪", name: "Colágeno",           shortDesc: "Articulaciones, piel y tendones" },
  { id: "vitamina_b",     emoji: "⚗️", name: "Vitamina B complejo", shortDesc: "Energía, metabolismo y sistema nervioso" },
  { id: "calcio",         emoji: "🦴", name: "Calcio",             shortDesc: "Huesos, músculos y función nerviosa" },
  { id: "vitamina_a",     emoji: "👁️", name: "Vitamina A",         shortDesc: "Visión, inmunidad y piel" },
  { id: "vitamina_e",     emoji: "🛡️", name: "Vitamina E",         shortDesc: "Antioxidante y salud cardiovascular" },
  { id: "cafeina",        emoji: "☕", name: "Cafeína",            shortDesc: "Rendimiento deportivo y concentración" },
];

export interface SupplementTimingOption {
  time: string;
  desc: string;
  notificationHour: number;
  slots: string[];
}

export interface SupplementTiming {
  options: SupplementTimingOption[];
  tip: string;
}

export const SUPPLEMENT_TIMING: Record<string, SupplementTiming> = {
  proteina_polvo: {
    options: [
      {
        time: "⏱ Post-entreno",
        desc: "30 min después del ejercicio",
        notificationHour: 10,
        slots: ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00"],
      },
      {
        time: "🌅 Con el desayuno",
        desc: "Junto a tu primera comida",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
    ],
    tip: "La whey tiene el mayor valor biológico. Tómala en los 30 min después del entreno para activar la síntesis muscular.",
  },
  creatina: {
    options: [
      {
        time: "🏋️ Pre o post-entreno",
        desc: "La consistencia diaria importa más que el momento exacto",
        notificationHour: 10,
        slots: ["8:00", "9:00", "10:00", "11:00", "17:00", "18:00"],
      },
      {
        time: "🍽️ Con las comidas",
        desc: "La insulina postprandial ayuda a su absorción celular",
        notificationHour: 13,
        slots: ["8:00", "13:00", "14:00", "20:00", "21:00"],
      },
    ],
    tip: "3-5g/día aumenta los depósitos de fosfocreatina. El momento exacto importa poco — lo importante es tomarla todos los días.",
  },
  vitamina_d: {
    options: [
      {
        time: "🍳 Con el desayuno",
        desc: "Tómala con la comida más grasa del día para mejor absorción",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
      {
        time: "🥗 Con la comida",
        desc: "La vitamina D es liposoluble — necesita grasas para absorberse",
        notificationHour: 13,
        slots: ["12:00", "13:00", "14:00", "15:00"],
      },
    ],
    tip: "Es liposoluble — se absorbe hasta 50% mejor con una comida con grasas saludables como aguacate o aceite de oliva.",
  },
  magnesio: {
    options: [
      {
        time: "🌙 Antes de dormir",
        desc: "Mejora la calidad del sueño y la recuperación nocturna",
        notificationHour: 22,
        slots: ["21:00", "21:30", "22:00", "22:30", "23:00"],
      },
      {
        time: "🍽️ Con la cena",
        desc: "Reduce calambres musculares post-entrenamiento",
        notificationHour: 21,
        slots: ["19:00", "20:00", "21:00", "21:30"],
      },
    ],
    tip: "El magnesio glicinato por la noche mejora el sueño y reduce el cortisol. Evita el óxido de magnesio — tiene peor absorción.",
  },
  omega_3: {
    options: [
      {
        time: "🍽️ Con las comidas",
        desc: "Reduce el sabor a pescado y mejora la absorción de EPA/DHA",
        notificationHour: 13,
        slots: ["8:00", "9:00", "13:00", "14:00", "20:00"],
      },
      {
        time: "🥗 Con la comida principal",
        desc: "Junto a grasas naturales para máxima biodisponibilidad",
        notificationHour: 14,
        slots: ["12:00", "13:00", "14:00", "15:00"],
      },
    ],
    tip: "Mejora la absorción de EPA y DHA hasta un 40% tomándolo con comida. Busca mínimo 1g de EPA+DHA combinados.",
  },
  vitamina_c: {
    options: [
      {
        time: "🌅 Con el desayuno",
        desc: "Potencia la absorción de hierro de los alimentos",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
      {
        time: "🌙 Con la cena",
        desc: "Antioxidante nocturno para recuperación celular",
        notificationHour: 21,
        slots: ["19:00", "20:00", "21:00", "21:30"],
      },
    ],
    tip: "Tomar vitamina C con alimentos ricos en hierro vegetal aumenta su absorción hasta 3 veces. Divide la dosis en 2 tomas.",
  },
  zinc: {
    options: [
      {
        time: "🌙 Antes de dormir",
        desc: "Optimiza la producción de testosterona durante el sueño",
        notificationHour: 22,
        slots: ["21:00", "21:30", "22:00", "22:30", "23:00"],
      },
      {
        time: "⏰ En ayunas",
        desc: "Mejor absorción sin competencia de otros minerales",
        notificationHour: 7,
        slots: ["6:30", "7:00", "7:30", "8:00"],
      },
    ],
    tip: "El zinc en ayunas tiene mejor absorción pero puede causar náuseas. Empieza con dosis baja y tómalo con un pequeño snack si es necesario.",
  },
  hierro: {
    options: [
      {
        time: "⏰ En ayunas",
        desc: "Máxima absorción lejos de calcio y café",
        notificationHour: 7,
        slots: ["6:30", "7:00", "7:30", "8:00"],
      },
      {
        time: "🍊 Con vitamina C",
        desc: "La vitamina C triplica la absorción del hierro no hemo",
        notificationHour: 9,
        slots: ["8:00", "8:30", "9:00", "9:30", "10:00"],
      },
    ],
    tip: "Evita tomar hierro con café, té o lácteos — reducen su absorción hasta un 60%. La vitamina C es tu mejor aliada.",
  },
  colageno: {
    options: [
      {
        time: "⏱ Pre-entreno",
        desc: "30 min antes con vitamina C activa la síntesis de colágeno",
        notificationHour: 9,
        slots: ["7:00", "8:00", "9:00", "10:00", "17:00", "18:00"],
      },
      {
        time: "🌅 En ayunas",
        desc: "Máxima absorción de aminoácidos en estado de reposo",
        notificationHour: 7,
        slots: ["6:30", "7:00", "7:30", "8:00"],
      },
    ],
    tip: "Tomar colágeno con vitamina C antes del ejercicio potencia la síntesis en tendones y cartílagos hasta un 60%.",
  },
  vitamina_b: {
    options: [
      {
        time: "🌅 Con el desayuno",
        desc: "Activa el metabolismo energético para todo el día",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
      {
        time: "⏰ En ayunas",
        desc: "Mejor absorción en estómago vacío, especialmente B12",
        notificationHour: 7,
        slots: ["6:30", "7:00", "7:30", "8:00"],
      },
    ],
    tip: "Las vitaminas B son hidrosolubles — el exceso se elimina por orina. Tómalas por la mañana para aprovechar su efecto energizante.",
  },
  calcio: {
    options: [
      {
        time: "🍽️ Con las comidas",
        desc: "Máximo 500mg por toma para mejor absorción intestinal",
        notificationHour: 13,
        slots: ["8:00", "9:00", "13:00", "14:00", "20:00"],
      },
      {
        time: "🌙 Con la cena",
        desc: "El calcio nocturno puede mejorar la densidad ósea",
        notificationHour: 21,
        slots: ["19:00", "20:00", "21:00", "21:30"],
      },
    ],
    tip: "Divide la dosis en 2 tomas de máximo 500mg — el intestino no puede absorber más de una vez. Evita tomarlo con hierro.",
  },
  vitamina_a: {
    options: [
      {
        time: "🍳 Con el desayuno",
        desc: "Liposoluble — se absorbe mejor con grasas en la comida",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
      {
        time: "🥗 Con la comida principal",
        desc: "Junto a aceite de oliva o aguacate para máxima absorción",
        notificationHour: 13,
        slots: ["12:00", "13:00", "14:00", "15:00"],
      },
    ],
    tip: "La vitamina A es liposoluble y se acumula en el organismo. No superes la dosis recomendada — el exceso puede ser tóxico.",
  },
  vitamina_e: {
    options: [
      {
        time: "🍽️ Con las comidas",
        desc: "Liposoluble — requiere grasas dietéticas para absorberse",
        notificationHour: 13,
        slots: ["8:00", "9:00", "13:00", "14:00", "20:00"],
      },
      {
        time: "🥗 Con la comida más grasa",
        desc: "Potente antioxidante que protege las células del daño oxidativo",
        notificationHour: 14,
        slots: ["12:00", "13:00", "14:00", "15:00"],
      },
    ],
    tip: "Como antioxidante liposoluble, la vitamina E se almacena en tejido adiposo. Tómala con tu comida más abundante en grasas saludables.",
  },
  cafeina: {
    options: [
      {
        time: "⏱ 30-60 min pre-entreno",
        desc: "Pico de efecto en 45 min — máximo rendimiento en el entreno",
        notificationHour: 9,
        slots: ["7:00", "8:00", "9:00", "10:00", "17:00", "18:00"],
      },
      {
        time: "🌅 Por la mañana",
        desc: "Evita tomarlo después de las 14h para no afectar el sueño",
        notificationHour: 8,
        slots: ["7:00", "7:30", "8:00", "8:30", "9:00"],
      },
    ],
    tip: "La cafeína mejora el rendimiento hasta un 12%. No la tomes después de las 14:00 — tiene vida media de 5-6 horas y puede arruinar tu sueño.",
  },
};

/* ── Supplement variants ─────────────────────────────────────────────────
   Mirrors the inline SUPPLEMENT_VARIANTS in pages/Onboarding.tsx so the
   Vision supplements modal shows exactly the same options as onboarding.
   (Single source could be enforced by importing this from Onboarding too.) */

export interface SupplementVariant {
  name: string;
  info: string;
}

export function getSupplementVariants(
  isES: boolean,
): Record<string, SupplementVariant[]> {
  return {
    proteina_polvo: [
      { name: isES ? "Whey concentrada" : "Concentrated whey", info: isES ? "Económica. Contiene lactosa." : "Budget-friendly. Contains lactose." },
      { name: isES ? "Whey isolada" : "Whey isolate", info: isES ? "Sin lactosa. >90% proteína." : "Lactose-free. >90% protein." },
      { name: isES ? "Proteína vegana" : "Vegan protein", info: isES ? "Guisante/arroz. Plant-based." : "Pea/rice. Plant-based." },
      { name: isES ? "Caseína" : "Casein", info: isES ? "Digestión lenta. Ideal antes de dormir." : "Slow digestion. Ideal before bed." },
    ],
    creatina: [
      { name: isES ? "Monohidrato" : "Monohydrate", info: isES ? "La más estudiada y eficaz." : "Most studied and effective." },
      { name: isES ? "HCl (clorhidrato)" : "HCl (hydrochloride)", info: isES ? "Mayor solubilidad, dosis menor." : "Higher solubility, smaller dose." },
      { name: "Kre-Alkalyn", info: isES ? "Sin fase de carga obligatoria." : "No loading phase required." },
      { name: isES ? "Etil éster" : "Ethyl ester", info: isES ? "Absorción más rápida." : "Faster absorption." },
    ],
    colageno: [
      { name: isES ? "Marino (tipo I)" : "Marine (type I)", info: isES ? "Mayor biodisponibilidad. Piel y tendones." : "Higher bioavailability. Skin and tendons." },
      { name: isES ? "Bovino (tipo I/III)" : "Bovine (type I/III)", info: isES ? "Económico. Piel y articulaciones." : "Budget-friendly. Skin and joints." },
      { name: isES ? "Tipo II" : "Type II", info: isES ? "Específico para cartílago." : "Specific for cartilage." },
      { name: isES ? "Péptidos hidrolizados" : "Hydrolyzed peptides", info: isES ? "Fácil absorción en líquidos." : "Easy absorption in liquids." },
    ],
    magnesio: [
      { name: "Bisglicinato", info: isES ? "Máxima absorción y tolerancia digestiva." : "Maximum absorption and digestive tolerance." },
      { name: "Citrato", info: isES ? "Buena biodisponibilidad." : "Good bioavailability." },
      { name: "Malato", info: isES ? "Ideal para energía y fatiga." : "Ideal for energy and fatigue." },
      { name: "L-treonato", info: isES ? "Mejora sueño y memoria." : "Improves sleep and memory." },
    ],
    omega_3: [
      { name: isES ? "Aceite de pescado" : "Fish oil", info: isES ? "Buena relación EPA/DHA." : "Good EPA/DHA ratio." },
      { name: isES ? "Aceite de krill" : "Krill oil", info: isES ? "En fosfolípidos, mejor absorción." : "In phospholipids, better absorption." },
      { name: isES ? "Algas (vegano)" : "Algae (vegan)", info: isES ? "Fuente directa de DHA." : "Direct DHA source." },
      { name: isES ? "EPA/DHA concentrado" : "Concentrated EPA/DHA", info: isES ? "Alta dosis en cápsulas pequeñas." : "High dose in small capsules." },
    ],
    vitamina_d: [
      { name: isES ? "Vitamina D3" : "Vitamin D3", info: isES ? "Forma más activa y biodisponible." : "Most active and bioavailable form." },
      { name: "D3 + K2", info: isES ? "K2 dirige el calcio a los huesos." : "K2 directs calcium to bones." },
      { name: isES ? "D2 (vegano)" : "D2 (vegan)", info: isES ? "Origen vegetal. Menos potente." : "Plant-based. Less potent." },
    ],
    zinc: [
      { name: "Picolinato", info: isES ? "La forma mejor absorbida." : "Best absorbed form." },
      { name: "Citrato", info: isES ? "Buena tolerancia digestiva." : "Good digestive tolerance." },
      { name: "Gluconato", info: isES ? "Económico, menor biodisponibilidad." : "Budget-friendly, lower bioavailability." },
      { name: "ZMA (Zinc+Mg+B6)", info: isES ? "Popular para recuperación nocturna." : "Popular for nighttime recovery." },
    ],
    hierro: [
      { name: "Bisglicinato", info: isES ? "El más suave para el estómago." : "Easiest on the stomach." },
      { name: isES ? "Sulfato ferroso" : "Ferrous sulfate", info: isES ? "Económico, puede irritar." : "Budget-friendly, may cause irritation." },
      { name: isES ? "Hierro hemo" : "Heme iron", info: isES ? "Mayor biodisponibilidad natural." : "Higher natural bioavailability." },
    ],
    vitamina_c: [
      { name: isES ? "Ácido ascórbico" : "Ascorbic acid", info: isES ? "Forma básica y económica." : "Basic and budget-friendly form." },
      { name: isES ? "Ascorbato sódico" : "Sodium ascorbate", info: isES ? "Sin acidez, para estómagos sensibles." : "No acidity, for sensitive stomachs." },
      { name: "Liposomal", info: isES ? "Mayor biodisponibilidad celular." : "Higher cellular bioavailability." },
    ],
    vitamina_b: [
      { name: isES ? "Complejo B completo" : "Full B complex", info: isES ? "Cubre todas las vitaminas B." : "Covers all B vitamins." },
      { name: isES ? "Solo B12" : "B12 only", info: isES ? "Esencial para veganos." : "Essential for vegans." },
      { name: "B6+B12+ácido fólico", info: isES ? "Trío clave para energía." : "Key trio for energy." },
    ],
    calcio: [
      { name: isES ? "Carbonato de calcio" : "Calcium carbonate", info: isES ? "Económico. Tomar con comida." : "Budget-friendly. Take with food." },
      { name: isES ? "Citrato de calcio" : "Calcium citrate", info: isES ? "Se absorbe en ayunas." : "Absorbs on empty stomach." },
      { name: "Calcio + D3 + K2", info: isES ? "Sinergia ideal para huesos." : "Ideal synergy for bones." },
    ],
    vitamina_a: [
      { name: "Retinol", info: isES ? "Forma preformada, absorción directa." : "Preformed form, direct absorption." },
      { name: "Beta-caroteno", info: isES ? "El cuerpo la convierte según necesite." : "Body converts as needed." },
    ],
    vitamina_e: [
      { name: isES ? "Tocoferol mixto" : "Mixed tocopherols", info: isES ? "La forma más completa y natural." : "Most complete and natural form." },
      { name: "Alfa-tocoferol", info: isES ? "La más estudiada. Forma estándar." : "Most studied. Standard form." },
    ],
    cafeina: [
      { name: "L-teanina + cafeína", info: isES ? "Alerta sin ansiedad ni crash." : "Alert without anxiety or crash." },
      { name: isES ? "Cafeína anhidra" : "Anhydrous caffeine", info: isES ? "Pura y potente. Dosis exacta." : "Pure and potent. Exact dose." },
      { name: isES ? "Té verde natural" : "Natural green tea", info: isES ? "Liberación gradual, menor crash." : "Gradual release, less crash." },
      { name: isES ? "Pre-entreno completo" : "Full pre-workout", info: isES ? "Cafeína + beta-alanina + citrulina." : "Caffeine + beta-alanine + citrulline." },
    ],
  };
}

/* ── Stored shape (matches food_preferences.supplements JSONB) ───────────── */

export interface StoredSupplement {
  id: string;
  timingIndex: number;
  variantIndex: number;
  /** "HH:MM" — the exact hour the reminder fires. */
  notificationTime: string;
}

/** Default notification time string for a supplement+timing, e.g. "08:00". */
export function defaultNotificationTime(id: string, timingIndex: number): string {
  const hour = SUPPLEMENT_TIMING[id]?.options[timingIndex]?.notificationHour ?? 8;
  return `${String(hour).padStart(2, "0")}:00`;
}
