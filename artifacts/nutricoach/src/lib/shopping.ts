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

const UNIT_ALIASES: Record<string, string> = {
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
  cup: "cup", cups: "cup",
  ounce: "oz", ounces: "oz", oz: "oz",
  pound: "lb", pounds: "lb", lb: "lb",
  piece: "piece", pieces: "piece",
  slice: "slice", slices: "slice",
  strip: "strip", strips: "strip",
  clove: "clove", cloves: "clove",
  handful: "handful", handfuls: "handful",
  sprig: "sprig", sprigs: "sprig",
  stalk: "stalk", stalks: "stalk",
  leaf: "leaf", leaves: "leaf",
  can: "can", cans: "can",
  scoop: "scoop", scoops: "scoop",
};

function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] ?? lower;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
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

function mergeAmounts(amounts: string[]): string {
  if (amounts.length === 1) return amounts[0];
  const byUnit = new Map<string, number>();
  const unparseable: string[] = [];
  for (const raw of amounts) {
    const parsed = parseAmount(raw);
    if (!parsed) { unparseable.push(raw); continue; }
    byUnit.set(parsed.unit, (byUnit.get(parsed.unit) ?? 0) + parsed.num);
  }
  const parts: string[] = [];
  for (const [unit, total] of byUnit) {
    const numStr = formatNum(total);
    parts.push(unit ? `${numStr} ${unit}` : numStr);
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
    groups.get(category)!.push({
      key,
      name,
      amount: mergeAmounts(amounts),
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
