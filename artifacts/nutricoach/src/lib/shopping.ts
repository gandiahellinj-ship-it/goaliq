import { useState, useEffect, useMemo } from "react";
import { useMealPlan, useFoodPreferences, type MealPlan } from "./supabase-queries";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MealSource = {
  day: string;      // "monday"
  mealType: string; // "lunch"
};

export type ShoppingItem = {
  key: string;
  name: string;
  amount: string;
  category: string;
  /** Total number of times this ingredient appears across all meals (pre-dedup). */
  mealCount: number;
  sources: MealSource[];
  isCustom?: boolean;
};

export type CustomItem = {
  id: string;
  name: string;
  amount: string;
};

export type ShoppingCategory = {
  key: string;
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  /** Category ordering in a standard supermarket layout. */
  supermarketOrder: number;
  items: ShoppingItem[];
};

export type SortMode = "category" | "supermarket";

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  order: number;        // Nutritional category order
  supermarketOrder: number; // Aisle order: produce → meat → dairy → pantry
}> = {
  vegetables: { label: "Vegetables", emoji: "🥦", colorClass: "text-green-700",   bgClass: "bg-green-50",    borderClass: "border-green-200",   order: 0, supermarketOrder: 0 },
  fruit:      { label: "Fruits",     emoji: "🍎", colorClass: "text-pink-700",    bgClass: "bg-pink-50",     borderClass: "border-pink-200",    order: 1, supermarketOrder: 1 },
  protein:    { label: "Protein",    emoji: "🥩", colorClass: "text-emerald-700", bgClass: "bg-emerald-50",  borderClass: "border-emerald-200", order: 2, supermarketOrder: 2 },
  dairy:      { label: "Dairy",      emoji: "🧀", colorClass: "text-yellow-700",  bgClass: "bg-yellow-50",   borderClass: "border-yellow-200",  order: 3, supermarketOrder: 3 },
  carbs:      { label: "Carbs",      emoji: "🌾", colorClass: "text-orange-700",  bgClass: "bg-orange-50",   borderClass: "border-orange-200",  order: 4, supermarketOrder: 4 },
  fats:       { label: "Fats",       emoji: "🥑", colorClass: "text-violet-700",  bgClass: "bg-violet-50",   borderClass: "border-violet-200",  order: 5, supermarketOrder: 5 },
  other:      { label: "Other",      emoji: "🫙", colorClass: "text-stone-600",   bgClass: "bg-stone-50",    borderClass: "border-stone-200",   order: 6, supermarketOrder: 6 },
};

// ─── Unit normalization ───────────────────────────────────────────────────────

// ─── Spice / condiment keywords — always show "al gusto" ─────────────────────

const SPICE_KEYS = new Set([
  "sal", "pimienta", "sal y pimienta", "oregano", "azafran", "comino",
  "curry", "pimenton", "paprika", "canela", "nuez moscada", "cilantro",
  "perejil", "tomillo", "romero", "laurel", "albahaca", "jengibre",
  "curcuma", "cayena", "cardamomo", "anis", "hinojo", "mostaza en polvo",
  "hierbas provenzales", "mezcla de especias", "especias mixtas",
  "pimienta negra", "pimienta blanca", "pimienta roja",
]);

function isSpice(normalizedKey: string): boolean {
  return SPICE_KEYS.has(normalizedKey);
}

// ─── "al gusto" detection ─────────────────────────────────────────────────────

const GUSTO_TERMS = ["al gusto", "to taste", "a taste", "una pizca", "a pinch",
  "pizca", "pinch", "gusto", "taste", "según gusto", "cantidad necesaria", "c/n"];

function isGustoAmount(amount: string): boolean {
  const lower = amount.toLowerCase().trim();
  return GUSTO_TERMS.some(t => lower.includes(t));
}

// ─── Unit normalization ───────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  gram: "g", grams: "g", gramo: "g", gramos: "g",
  kilogram: "kg", kilograms: "kg", kilogramo: "kg", kilogramos: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l", litro: "l", litros: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
  cucharada: "tbsp", cucharadas: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
  cucharadita: "tsp", cucharaditas: "tsp",
  cup: "cup", cups: "cup", taza: "cup", tazas: "cup",
  ounce: "oz", ounces: "oz", oz: "oz",
  pound: "lb", pounds: "lb", lb: "lb",
  piece: "piece", pieces: "piece", pieza: "piece", piezas: "piece",
  unidad: "piece", unidades: "piece", unit: "piece", units: "piece",
  slice: "slice", slices: "slice", rebanada: "slice", rebanadas: "slice",
  strip: "strip", strips: "strip",
  clove: "clove", cloves: "clove", diente: "clove", dientes: "clove",
  handful: "handful", handfuls: "handful", punado: "handful",
  sprig: "sprig", sprigs: "sprig", ramita: "sprig", ramitas: "sprig",
  stalk: "stalk", stalks: "stalk",
  leaf: "leaf", leaves: "leaf", hoja: "leaf", hojas: "leaf",
  can: "can", cans: "can", lata: "can", latas: "can",
  scoop: "scoop", scoops: "scoop",
};

function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] ?? lower;
}

// ml equivalents for volume units — used to unify liquid measurements
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, l: 1000,
  tbsp: 15, tsp: 5, cup: 240,
};

// g equivalents for weight units
const WEIGHT_TO_G: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.35, lb: 453.6,
};

// Units treated as countable (round up to integers)
const COUNT_UNITS = new Set(["piece", "slice", "can", "scoop", "clove", "handful", "sprig", "stalk", "leaf", "strip"]);

function isVolumeUnit(u: string): boolean { return u in VOLUME_TO_ML; }
function isWeightUnit(u: string): boolean { return u in WEIGHT_TO_G; }
function isCountUnit(u: string): boolean { return COUNT_UNITS.has(u); }

function normalizeKey(name: string): string {
  let s = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\s+/g, " ")
    .trim();

  // Normalize common ingredient variations so they consolidate under one key
  s = s
    .replace(/^aceite de oliva virgen extra$/, "aceite de oliva")
    .replace(/^aceite de oliva virgen$/, "aceite de oliva")
    .replace(/^aceite de oliva extra virgen$/, "aceite de oliva")
    .replace(/^sal marina.*/, "sal")
    .replace(/^sal gruesa.*/, "sal")
    .replace(/^sal himalaya.*/, "sal")
    .replace(/^sal y pimienta.*/, "sal y pimienta")
    .replace(/^pimienta (negra|blanca|roja|molida|recien molida|en grano).*/, "pimienta")
    .replace(/^aguacate.*/, "aguacate")
    .replace(/^mantequilla.*/, "mantequilla")
    .replace(/^limon.*/, "limon")
    .replace(/^zumo de limon.*/, "zumo de limon")
    .replace(/^caldo de (pollo|verduras|carne) .*/, (_, t) => `caldo de ${t}`)
    .replace(/^yogur griego.*/, "yogur griego")
    .replace(/^queso cottage.*/, "queso cottage")
    .replace(/^pechuga de pollo.*/, "pechuga de pollo")
    .replace(/^filete de salmon.*/, "filete de salmon")
    .replace(/^arroz integral.*/, "arroz integral")
    .replace(/^boniato.*/, "boniato")
    .replace(/^tomate(s)?$/, "tomate")
    .replace(/^tomate(s)? (triturado|en lata|cherry).*/, (_, _s, t) => `tomate ${t}`)
    .replace(/^ajo(s)?$/, "ajo")
    .replace(/^cebolla(s)?$/, "cebolla")
    .replace(/^aceite de coco.*/, "aceite de coco")
    .replace(/^leche (entera|semi|semidesnatada|desnatada)$/, "leche");

  return s;
}

function parseAmount(amount: string): { num: number; unit: string } | null {
  const trimmed = amount.trim();
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const frac = parseFloat(mixedMatch[2]) / parseFloat(mixedMatch[3]);
    return { num: whole + frac, unit: normalizeUnit(mixedMatch[4]) };
  }
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
    return { num, unit: normalizeUnit(fracMatch[3]) };
  }
  const plainMatch = trimmed.match(/^([\d.]+)\s*(.*)$/);
  if (plainMatch) {
    const num = parseFloat(plainMatch[1]);
    if (isNaN(num)) return null;
    return { num, unit: normalizeUnit(plainMatch[2]) };
  }
  return null;
}

function formatNum(n: number): string {
  return n % 1 === 0 ? String(n) : String(Math.round(n * 10) / 10);
}

function mergeAmounts(amounts: string[], ingredientKey = ""): string {
  if (amounts.length === 0) return "";

  // 1. Any "al gusto" signal → always show "al gusto"
  if (amounts.some(isGustoAmount)) return "al gusto";
  // 1b. Single unchanged amount
  if (amounts.length === 1) return amounts[0];

  // 2. Parse all amounts
  const parsed: Array<{ num: number; unit: string }> = [];
  const unparseable: string[] = [];
  for (const raw of amounts) {
    const p = parseAmount(raw);
    if (p) parsed.push(p); else unparseable.push(raw);
  }

  // 3. If nothing parsed, fall back
  if (parsed.length === 0) return amounts[0];

  // 4. Detect dominant measurement family
  const totalVolumeMl = parsed
    .filter(p => isVolumeUnit(p.unit))
    .reduce((s, p) => s + p.num * (VOLUME_TO_ML[p.unit] ?? 1), 0);

  const totalWeightG = parsed
    .filter(p => isWeightUnit(p.unit))
    .reduce((s, p) => s + p.num * (WEIGHT_TO_G[p.unit] ?? 1), 0);

  const totalCount = parsed
    .filter(p => isCountUnit(p.unit) || p.unit === "")
    .reduce((s, p) => s + p.num, 0);

  const hasVolume = parsed.some(p => isVolumeUnit(p.unit));
  const hasWeight = parsed.some(p => isWeightUnit(p.unit));

  // 5. If all or mostly volume → unify to ml / l
  if (hasVolume && !hasWeight) {
    const total = Math.round(totalVolumeMl);
    if (total === 0) return amounts[0];
    if (total >= 1000) {
      const liters = Math.round(total / 100) / 10;
      return `~${liters} l`;
    }
    return `~${total} ml`;
  }

  // 6. If all or mostly weight → unify to g / kg
  if (hasWeight && !hasVolume) {
    const total = Math.round(totalWeightG);
    if (total === 0) return amounts[0];
    if (total >= 1000) {
      const kg = Math.round(total / 100) / 10;
      return `~${kg} kg`;
    }
    return `~${total} g`;
  }

  // 7. Countable items (pieces, slices, cans…) — round up fractions
  if (!hasVolume && !hasWeight && totalCount > 0) {
    const count = Math.ceil(totalCount);
    const unit = parsed.find(p => isCountUnit(p.unit))?.unit ?? parsed[0]?.unit ?? "";
    return unit ? `${count} ${unit}` : String(count);
  }

  // 8. Mixed families — group by canonical family and show cleanly
  const byUnit = new Map<string, number>();
  for (const p of parsed) {
    byUnit.set(p.unit, (byUnit.get(p.unit) ?? 0) + p.num);
  }
  const parts: string[] = [];
  for (const [unit, total] of byUnit) {
    parts.push(unit ? `${formatNum(total)} ${unit}` : formatNum(total));
  }
  for (const u of unparseable) parts.push(u);
  return parts.join(" + ");
}

// ─── Build shopping categories ────────────────────────────────────────────────

export function buildShoppingCategories(mealPlan: MealPlan): ShoppingCategory[] {
  const byKey = new Map<string, {
    name: string;
    amounts: string[];
    rawCount: number;   // total occurrences (duplicates counted)
    category: string;
    sources: MealSource[];
  }>();

  for (const day of mealPlan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = normalizeKey(ing.name);
        const cat = CATEGORY_META[ing.category] ? ing.category : "other";
        const source: MealSource = { day: day.day, mealType: meal.meal_type };
        const existing = byKey.get(key);
        if (existing) {
          existing.amounts.push(ing.amount);
          existing.rawCount++;
          // Prefer the shorter, cleaner name (e.g. "Aceite de oliva" over "Aceite de oliva virgen extra")
          if (ing.name.length < existing.name.length) existing.name = ing.name;
          const alreadyHas = existing.sources.some(
            s => s.day === source.day && s.mealType === source.mealType
          );
          if (!alreadyHas) existing.sources.push(source);
        } else {
          byKey.set(key, { name: ing.name, amounts: [ing.amount], rawCount: 1, category: cat, sources: [source] });
        }
      }
    }
  }

  const groups = new Map<string, ShoppingItem[]>();
  for (const [key, { name, amounts, rawCount, category, sources }] of byKey) {
    if (!groups.has(category)) groups.set(category, []);
    // Spices/condiments always show "al gusto" regardless of amounts
    const amount = isSpice(key) ? "al gusto" : mergeAmounts(amounts, key);
    groups.get(category)!.push({
      key,
      name,
      amount,
      category,
      mealCount: rawCount,
      sources,
    });
  }

  return Object.entries(CATEGORY_META)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([cat, meta]) => ({
      key: cat,
      label: meta.label,
      emoji: meta.emoji,
      colorClass: meta.colorClass,
      bgClass: meta.bgClass,
      borderClass: meta.borderClass,
      supermarketOrder: meta.supermarketOrder,
      items: (groups.get(cat) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(g => g.items.length > 0);
}

/** Re-sorts a built category list into supermarket aisle order. */
export function toSupermarketOrder(cats: ShoppingCategory[]): ShoppingCategory[] {
  return [...cats].sort((a, b) => a.supermarketOrder - b.supermarketOrder);
}

/** Sorts items within a category by how many meals they're used in (most-used first). */
export function optimizeItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => b.mealCount - a.mealCount || a.name.localeCompare(b.name));
}

// ─── Restriction matching ─────────────────────────────────────────────────────

/**
 * Returns true if the ingredient name matches any restriction term.
 * Uses bidirectional substring matching so "almond milk" matches "almonds"
 * and "cow's milk" matches "dairy" only if listed.
 */
function matchesRestriction(ingredientName: string, restrictions: string[]): boolean {
  const name = ingredientName.toLowerCase();
  return restrictions.some(r => {
    const term = r.toLowerCase().trim();
    if (!term) return false;
    return name.includes(term) || term.includes(name);
  });
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type ShoppingListResult = {
  categories: ShoppingCategory[];
  isLoading: boolean;
  weekStart: string | null;
  filteredItems: string[];
};

export function useShoppingList(): ShoppingListResult {
  const { data: mealPlan, isLoading: planLoading } = useMealPlan();
  const { data: foodPrefs, isLoading: prefsLoading } = useFoodPreferences();

  const restrictions = useMemo(() => {
    const allergies = (foodPrefs?.allergies ?? []).filter(Boolean);
    const intolerances = (foodPrefs?.intolerances ?? []).filter(Boolean);
    const dislikes = (foodPrefs?.disliked_foods ?? []).filter(Boolean);
    return [...allergies, ...intolerances, ...dislikes];
  }, [foodPrefs]);

  const { categories, filteredItems } = useMemo(() => {
    if (!mealPlan) return { categories: [] as ShoppingCategory[], filteredItems: [] as string[] };
    const allCategories = buildShoppingCategories(mealPlan);

    if (restrictions.length === 0) {
      return { categories: allCategories, filteredItems: [] as string[] };
    }

    const removed: string[] = [];
    const filtered = allCategories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item => {
          if (matchesRestriction(item.name, restrictions)) {
            removed.push(item.name);
            return false;
          }
          return true;
        }),
      }))
      .filter(cat => cat.items.length > 0);

    return { categories: filtered, filteredItems: removed };
  }, [mealPlan, restrictions]);

  return {
    categories,
    isLoading: planLoading || prefsLoading,
    weekStart: mealPlan?.weekStart ?? null,
    filteredItems,
  };
}

export function useCheckedItems(weekStart: string | null, userId: string | undefined) {
  const storageKey = weekStart && userId ? `shopping_${weekStart}_${userId}` : null;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!storageKey) { setChecked({}); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      setChecked(saved ? JSON.parse(saved) : {});
    } catch {
      setChecked({});
    }
  }, [storageKey]);

  function toggle(key: string) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function uncheckAll() {
    setChecked({});
    if (storageKey) localStorage.removeItem(storageKey);
  }

  return { checked, toggle, uncheckAll };
}

export function useCustomItems(weekStart: string | null, userId: string | undefined) {
  const storageKey = weekStart && userId ? `shopping_custom_${weekStart}_${userId}` : null;
  const [items, setItems] = useState<CustomItem[]>([]);

  useEffect(() => {
    if (!storageKey) { setItems([]); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
  }, [storageKey]);

  function save(next: CustomItem[]) {
    setItems(next);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function addItem(name: string, amount: string) {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    save([...items, { id, name: name.trim(), amount: amount.trim() }]);
  }

  function removeItem(id: string) {
    save(items.filter(i => i.id !== id));
  }

  function updateItem(id: string, name: string, amount: string) {
    save(items.map(i => i.id === id ? { ...i, name: name.trim(), amount: amount.trim() } : i));
  }

  return { items, addItem, removeItem, updateItem };
}
