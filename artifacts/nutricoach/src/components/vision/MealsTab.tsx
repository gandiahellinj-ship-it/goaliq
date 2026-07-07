import { Check, Clock } from "lucide-react";
import type { MealItem, Macro } from "@/types";

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

/**
 * COMIDAS (Phase 2) — top zone. Calorie bar + 3 macro cards + educational
 * beige block + compact meal list. Calories are computed from checked meals
 * (togglable, local/ephemeral); macros are static mock. Layout mirrors the
 * approved mockup, no vertical scroll.
 */
export default function MealsTab({
  meals,
  macros,
  caloriesGoal,
  onToggle,
}: {
  meals: MealItem[];
  macros: Macro[];
  caloriesGoal: number;
  onToggle: (id: string) => void;
}) {
  const kcal = meals.filter((m) => m.done).reduce((s, m) => s + m.kcal, 0);
  const protein = macros.find((m) => m.label.toLowerCase().startsWith("prote"));
  const proteinLeft = protein ? Math.max(0, protein.goal - protein.current) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Comidas</p>
        <h2 className="font-display text-3xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">Nutrición</h2>
      </div>

      {/* Calories */}
      <div className="mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-[var(--color-brand-grey)]">Calorías</span>
          <span className="font-bold text-[var(--color-brand-text-lbl)]">
            {kcal} <span className="font-normal text-[var(--color-brand-grey)]">/ {caloriesGoal} kcal</span>
          </span>
        </div>
        <div className="mt-2">
          <Bar frac={kcal / caloriesGoal} />
        </div>
      </div>

      {/* Macros */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {macros.map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2.5">
            <div className="text-[11px] text-[var(--color-brand-grey)]">{m.label}</div>
            <div className="text-[17px] font-bold text-[var(--color-brand-text-lbl)]">
              {m.current}
              <span className="text-[11px] font-normal text-[var(--color-brand-grey)]">/{m.goal}{m.unit}</span>
            </div>
            <div className="mt-1">
              <Bar frac={m.current / m.goal} />
            </div>
          </div>
        ))}
      </div>

      {/* Educational block */}
      <div
        className="mt-2 rounded-xl px-3 py-2 text-[11.5px] leading-snug"
        style={{ background: "var(--color-brand-accent-soft)", color: "#6B5B3E" }}
      >
        {proteinLeft > 0
          ? `Te faltan ${proteinLeft} g de proteína — es el material con el que se construye el músculo que buscas. Prioriza tu próxima comida rica en proteína.`
          : `Has cubierto tu objetivo de proteína de hoy. Mantén el ritmo para conservar y ganar músculo.`}
      </div>

      {/* Meal list */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-between gap-2">
        {meals.map((m) => (
          <button
            key={m.id}
            onClick={() => onToggle(m.id)}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5 text-left"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.done
                  ? "bg-[var(--color-brand-accent)] text-white"
                  : "border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
              }`}
            >
              {m.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1" style={{ opacity: m.done ? 0.5 : 1 }}>
              <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-lbl)]">{m.name}</span>
              <span className="block text-[11.5px] text-[var(--color-brand-grey)]">{m.tag} · {m.time}</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-[var(--color-brand-text-lbl)]">{m.kcal}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
