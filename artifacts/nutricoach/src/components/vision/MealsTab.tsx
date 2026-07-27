import { useState } from "react";
import { Check } from "lucide-react";
import type { MealItem } from "@/types";
import { useDishImage } from "@/lib/supabase-queries";

/** Resuelve el src: URL completa (Storage) tal cual; ruta relativa con BASE_URL. */
function resolveSrc(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}${src}`;
}

function Bar({ frac }: { frac: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-brand-border)]">
      <div
        className="h-full rounded-full bg-[var(--color-brand-accent)]"
        style={{ width: `${Math.min(100, Math.max(0, frac) * 100)}%`, transition: "width 400ms ease" }}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * Foto del plato: imagen estática (maqueta) o la generada bajo demanda
 * (useDishImage, caché compartida). Mientras no hay foto → iniciales (la forma
 * la da el className: círculo en el carrusel, bloque en el hero). Cuando la foto
 * llega, aparece con FUNDIDO suave (sin spinner ni salto).
 */
function DishImage({ meal, className, style }: { meal: MealItem; className?: string; style?: React.CSSProperties }) {
  const { data: generatedUrl } = useDishImage(
    meal.image ? null : { name: meal.name, imageIngredients: meal.imageIngredients, isDrink: meal.isDrink },
  );
  const [loaded, setLoaded] = useState(false);
  const src = meal.image ? resolveSrc(meal.image) : generatedUrl ? resolveSrc(generatedUrl) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={meal.name}
        onLoad={() => setLoaded(true)}
        className={className}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 400ms ease", ...style }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center font-display text-white ${className ?? ""}`}
      style={{ background: "var(--color-brand-accent)", ...style }}
    >
      {initials(meal.name)}
    </div>
  );
}

/* Textos educativos GENÉRICOS por tipo de comida (los datos reales traen
   cualquier plato; nada específico de un plato concreto). */
const EDU: Record<string, string> = {
  Desayuno: "Empieza el día con proteína: energía estable y menos antojos a media mañana.",
  "Media mañana": "Un tentempié ligero con proteína mantiene el apetito a raya hasta la comida.",
  Comida: "Proteína magra con carbohidrato complejo: combustible para rendir y recuperar.",
  Merienda: "La merienda es el puente perfecto: proteína o fruta, sin picoteo vacío.",
  Cena: "Cena con proteína y verdura: favorece la recuperación mientras duermes.",
  Snack: "Un snack con proteína cubre el aporte entre comidas casi sin grasa.",
};
const EDU_FALLBACK = "Come despacio, prioriza la proteína y acompaña siempre con agua.";

/**
 * COMIDAS 2b — top zone. Thin kcal/macros strip + the SELECTED dish as the hero
 * (floating image, ingredients, steps, educational block, mark button). The
 * dish image lives in a flex-1 slot so it shrinks before any content is cut.
 */
export default function MealsTab({
  meals,
  macrosToday,
  caloriesGoal,
  selected,
  onToggle,
}: {
  meals: MealItem[];
  /** Macros consumidos hoy de verdad (meal_logs); null → aún sin registros. */
  macrosToday: { protein: number; carbs: number; fats: number } | null;
  caloriesGoal: number;
  selected: MealItem;
  onToggle: (id: string) => void;
}) {
  const kcal = meals.filter((m) => m.done).reduce((s, m) => s + m.kcal, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Comidas</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">Nutrición</h2>
      </div>

      {/* Thin kcal + macros strip */}
      <div className="mt-2">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-[var(--color-brand-grey)]">
          <span className="font-bold text-[var(--color-brand-text-lbl)]">{kcal}/{caloriesGoal}</span> kcal
          {macrosToday && (
            <>
              <span>· P {macrosToday.protein}g</span>
              <span>· C {macrosToday.carbs}g</span>
              <span>· G {macrosToday.fats}g</span>
              <span className="text-[9px] tracking-wide">(registrado hoy)</span>
            </>
          )}
        </div>
        <div className="mt-1"><Bar frac={caloriesGoal > 0 ? kcal / caloriesGoal : 0} /></div>
      </div>

      {/* Foto del plato (opción A): a sangre, esquinas redondeadas ARRIBA, foto
          rellenando el ancho (object-cover). Ocupa el hueco vertical disponible. */}
      <div
        className="mt-2 min-h-0 flex-1 overflow-hidden rounded-t-2xl"
        style={{ boxShadow: "0 6px 14px rgba(26,26,26,0.10)" }}
      >
        <DishImage meal={selected} className="h-full w-full object-cover" />
      </div>

      {/* Nombre debajo, sobre el beige */}
      <div className="mt-2 text-center">
        <div className="font-display text-xl font-bold leading-tight text-[var(--color-brand-text-lbl)]">{selected.name}</div>
        <div className="text-[11px] text-[var(--color-brand-grey)]">{selected.tag} · {selected.time}</div>
      </div>

      {/* Ingredients (two columns) */}
      {selected.ingredients && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-[3px]">
          {selected.ingredients.map((ing) => (
            <div key={ing} className="flex items-start gap-1 text-[10.5px] leading-tight text-[var(--color-brand-grey)]">
              <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-brand-accent)]" />
              {ing}
            </div>
          ))}
        </div>
      )}

      {/* Preparation steps */}
      {selected.preparation && (
        <ol className="mt-2 space-y-[3px]">
          {selected.preparation.map((step, i) => (
            <li key={i} className="flex gap-1.5 text-[10.5px] leading-tight text-[var(--color-brand-text-lbl)]">
              <span className="font-bold text-[var(--color-brand-accent)]">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      )}

      {/* Educational block */}
      <div
        className="mt-2 rounded-xl px-3 py-1.5 text-[11px] leading-snug"
        style={{ background: "var(--color-brand-accent-soft)", color: "#6B5B3E" }}
      >
        {EDU[selected.tag] ?? EDU_FALLBACK}
      </div>

      {/* Mark button */}
      <button
        onClick={() => onToggle(selected.id)}
        className="mt-2 w-full rounded-xl py-2.5 text-[13px] font-bold transition-colors"
        style={
          selected.done
            ? { background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-grey)" }
            : { background: "var(--color-brand-accent)", color: "#fff" }
        }
      >
        {selected.done ? "Comida hecha ✓" : "Marcar como comida ✓"}
      </button>
    </div>
  );
}

/** Contextual horizontal carousel — one card per meal, selected larger, scroll-snap. */
export function MealsCarousel({
  meals,
  selectedId,
  onSelect,
}: {
  meals: MealItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
      {meals.map((m) => {
        const active = m.id === selectedId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="flex shrink-0 flex-col items-center gap-1"
            style={{ scrollSnapAlign: "center", opacity: active ? 1 : 0.55, transition: "opacity 200ms" }}
          >
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-2xl border bg-[var(--color-brand-card)]"
              style={{
                width: active ? 72 : 54,
                height: active ? 72 : 54,
                borderColor: active ? "var(--color-brand-accent)" : "var(--color-brand-border)",
                transition: "all 200ms",
              }}
            >
              <DishImage meal={m} className="h-full w-full object-cover" />
              {m.done && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--color-brand-accent)" }}
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: active ? "var(--color-brand-text-lbl)" : "var(--color-brand-grey)" }}
            >
              {m.time}
            </span>
          </button>
        );
      })}
    </div>
  );
}
