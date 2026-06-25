import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { useMealPlan, type Ingredient, type MealRow } from "@/lib/supabase-queries";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import MealValidation from "@/components/comidas/MealValidation";

gsap.registerPlugin(useGSAP);

// ── BALANZ ───────────────────────────────────────────────────────────────────
const CYAN = "#50F0E4";

// El plan guarda meal_type en inglés; lo mostramos en español (BALANZ).
const MEAL_ORDER = [
  "breakfast",
  "snack_morning",
  "lunch",
  "snack_afternoon",
  "dinner",
] as const;

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Desayuno",
  snack_morning: "Media mañana",
  lunch: "Comida",
  snack_afternoon: "Merienda",
  dinner: "Cena",
};

// Hora orientativa de cada comida — usada para el orden, la selección por
// defecto (la más cercana a "ahora") y la etiqueta de hora en las pills.
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

/** Resultado que devuelve MealValidation (estructural, sin importar el tipo). */
type RegisteredResult = {
  match_percentage: number;
  status: "match" | "partial" | "mismatch";
  detected_ingredients: string[];
  feedback: string;
};

/** Vista normalizada de una comida para este tab. */
interface MealView {
  id: string;
  meal_type: string;
  name: string;
  ingredients: Ingredient[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  image_url?: string;
  preparation?: string | null;
  hour: number;
}

export interface ComidasTabProps {
  /**
   * Se llama tras registrar una comida validada. El padre persiste el registro
   * (Supabase), actualiza el contador diario y suma macros al aro mensual.
   */
  onMealRegistered?: (payload: {
    mealPlanId: string | null;
    mealType: string;
    date: string;
    calories: number | null;
    result: RegisteredResult;
  }) => void;
}

// MealRow no trae macros por comida ni image_url todavía; los leemos de forma
// opcional para cuando la API los incluya, y caemos a null / placeholder.
function toMealView(row: MealRow): MealView {
  const extra = row as MealRow & {
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    image_url?: string;
    preparation?: string;
  };
  return {
    id: row.id,
    meal_type: row.meal_type,
    name: row.meal_name,
    ingredients: row.ingredients ?? [],
    calories: row.calories_approx ?? CALORIES_FALLBACK[row.meal_type] ?? null,
    protein_g: extra.protein_g ?? null,
    carbs_g: extra.carbs_g ?? null,
    fat_g: extra.fat_g ?? null,
    image_url: extra.image_url,
    preparation: extra.preparation ?? row.notes ?? null,
    hour: MEAL_HOUR[row.meal_type] ?? 23,
  };
}

const todayName = new Date()
  .toLocaleDateString("en-US", { weekday: "long" })
  .toLowerCase();

const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;
const fmtMacro = (v: number | null, suffix: string) =>
  v == null ? "—" : `${v}${suffix}`;

export default function ComidasTab({ onMealRegistered }: ComidasTabProps) {
  const { data: plan, isLoading } = useMealPlan();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Comidas de hoy, ordenadas según MEAL_ORDER.
  const meals = useMemo<MealView[]>(() => {
    if (!plan?.days?.length) return [];
    const day = plan.days.find((d) => d.day === todayName) ?? plan.days[0];
    return [...(day?.meals ?? [])]
      .map(toMealView)
      .sort(
        (a, b) =>
          MEAL_ORDER.indexOf(a.meal_type as (typeof MEAL_ORDER)[number]) -
          MEAL_ORDER.indexOf(b.meal_type as (typeof MEAL_ORDER)[number]),
      );
  }, [plan]);

  // Selección por defecto: la comida más cercana (última cuya hora ya pasó).
  const defaultIndex = useMemo(() => {
    if (!meals.length) return 0;
    const now = new Date().getHours();
    let idx = 0;
    meals.forEach((m, i) => {
      if (now >= m.hour) idx = i;
    });
    return idx;
  }, [meals]);

  const activeIndex = selectedIndex ?? defaultIndex;
  const meal = meals[activeIndex];

  // Animación sutil al cambiar de comida (GSAP, limpieza automática).
  useGSAP(
    () => {
      if (!topRef.current) return;
      gsap.from(topRef.current, {
        opacity: 0,
        y: 10,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { dependencies: [activeIndex], scope: containerRef },
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-black/60">
        Cargando...
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-black/60">
        No hay comidas para hoy.
      </div>
    );
  }

  const handleRegistered = (result: RegisteredResult) => {
    setValidationOpen(false);
    const today = new Date().toISOString().split("T")[0];
    onMealRegistered?.({
      mealPlanId: plan?.id != null ? String(plan.id) : null,
      mealType: meal.meal_type,
      date: today,
      calories: meal.calories,
      result,
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col overflow-hidden bg-white text-black"
    >
      {/* ── TOP (~65vh): plato seleccionado ──────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col items-center px-5 pt-4">
        <div ref={topRef} className="flex w-full flex-col items-center">
          {/* Imagen del plato o placeholder */}
          <div className="relative aspect-[9/16] max-h-[40vh] overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {meal.image_url ? (
              <img
                src={meal.image_url}
                alt={meal.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/[0.03] text-5xl">
                🍽️
              </div>
            )}
          </div>

          {/* Nombre */}
          <h2 className="mt-3 text-center text-xl font-bold tracking-tight">
            {meal.name}
          </h2>

          {/* 4 macros esenciales en grid 2x2 */}
          <div className="mt-3 grid w-full max-w-xs grid-cols-2 gap-2">
            <MacroCell label="kcal" value={fmtMacro(meal.calories, " kcal")} />
            <MacroCell label="Proteína" value={fmtMacro(meal.protein_g, "g P")} />
            <MacroCell label="Carbohidratos" value={fmtMacro(meal.carbs_g, "g C")} />
            <MacroCell label="Grasas" value={fmtMacro(meal.fat_g, "g G")} />
          </div>
        </div>

        {/* Ingredientes + preparación (área que hace scroll si no cabe, el
            resto del tab nunca scrollea) */}
        <div className="mt-3 w-full max-w-xs min-h-0 flex-1 overflow-y-auto">
          {meal.ingredients.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-black/80">
              {meal.ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`}>
                  {ing.amount ? `${ing.amount} ` : ""}
                  {ing.name}
                </li>
              ))}
            </ul>
          )}
          {meal.preparation && (
            <p className="mt-2 text-sm leading-snug text-black/60">
              {meal.preparation}
            </p>
          )}
        </div>

        {/* CTA validación */}
        <button
          onClick={() => setValidationOpen(true)}
          className="my-3 flex shrink-0 items-center gap-2 rounded-full px-7 py-3 text-base font-semibold text-black transition active:scale-95"
          style={{ backgroundColor: CYAN }}
        >
          <span className="text-xl">📷</span>
          Mi comida real
        </button>
      </div>

      {/* ── BOTTOM (~30vh): roadmap de comidas ───────────────────────────── */}
      <div className="flex h-[30vh] shrink-0 items-center border-t border-black/5 bg-white px-3">
        <div className="flex w-full items-stretch gap-2 overflow-x-auto pb-1">
          {meals.map((m, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "flex min-w-[88px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center transition",
                  active
                    ? "scale-[1.03] text-black shadow-[0_4px_14px_rgba(80,240,228,0.45)]"
                    : "bg-black/[0.04] text-black/60 active:scale-95",
                )}
                style={active ? { backgroundColor: CYAN } : undefined}
              >
                <span className="text-[11px] font-medium opacity-70">
                  {fmtHour(m.hour)}
                </span>
                <span className="text-xs font-semibold leading-tight">
                  {MEAL_LABEL[m.meal_type] ?? m.meal_type}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Modal: validación con foto real ──────────────────────────────── */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="h-[85vh] max-w-md overflow-hidden p-0">
          <DialogTitle className="sr-only">Validar {meal.name}</DialogTitle>
          <MealValidation
            meal_name={meal.name}
            expected_ingredients={meal.ingredients.map((i) => i.name)}
            image_url={meal.image_url ?? ""}
            onMealRegistered={handleRegistered}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MacroCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-black/[0.04] py-2">
      <span className="text-base font-bold leading-none">{value}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-black/45">
        {label}
      </span>
    </div>
  );
}
