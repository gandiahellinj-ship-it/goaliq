import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import type { MealData } from "@/types";

function Bar({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-brand-border)]">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: false, amount: 0.6 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="h-full rounded-full bg-[var(--color-brand-cyan)]"
      />
    </div>
  );
}

export default function Floor2Meals({ data }: { data: MealData }) {
  const kcalPct = Math.min(100, Math.round((data.caloriesCurrent / data.caloriesGoal) * 100));

  return (
    <section className="flex h-full flex-col justify-center gap-7 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-grey)]">
          Piso 2 · Comidas
        </p>
        <h2 className="font-display text-4xl font-extrabold text-[var(--color-brand-text-lbl)]">
          Nutrición
        </h2>
      </header>

      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-brand-grey)]">Calorías</span>
          <span className="text-sm font-semibold text-[var(--color-brand-text-lbl)]">
            {data.caloriesCurrent}
            <span className="text-[var(--color-brand-grey)]"> / {data.caloriesGoal} kcal</span>
          </span>
        </div>
        <Bar current={data.caloriesCurrent} goal={data.caloriesGoal} />
        <p className="mt-2 text-xs text-[var(--color-brand-grey)]">{kcalPct}% del objetivo diario</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {data.macros.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3"
          >
            <p className="text-xs text-[var(--color-brand-grey)]">{m.label}</p>
            <p className="mb-2 text-lg font-bold text-[var(--color-brand-text-lbl)]">
              {m.current}
              <span className="text-xs font-normal text-[var(--color-brand-grey)]">/{m.goal}{m.unit}</span>
            </p>
            <Bar current={m.current} goal={m.goal} />
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {data.meals.map((meal) => (
          <li
            key={meal.id}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                meal.done
                  ? "bg-[var(--color-brand-cyan)] text-white"
                  : "border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
              }`}
            >
              {meal.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-brand-text-lbl)]">
                {meal.name}
              </p>
              <p className="text-xs text-[var(--color-brand-grey)]">
                {meal.tag} · {meal.time}
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--color-brand-text-lbl)]">
              {meal.kcal}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
