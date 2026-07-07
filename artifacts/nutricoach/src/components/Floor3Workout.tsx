import { motion } from "framer-motion";
import { Check, Dumbbell, Clock, Flame } from "lucide-react";
import type { WorkoutData } from "@/types";

export default function Floor3Workout({ data }: { data: WorkoutData }) {
  const doneCount = data.exercises.filter((e) => e.done).length;
  const pct = Math.round((doneCount / data.exercises.length) * 100);

  return (
    <section className="flex h-full flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-grey)]">
          Piso 3 · Entrenos
        </p>
        <h2 className="font-display text-4xl font-extrabold text-[var(--color-brand-text-lbl)]">
          {data.title}
        </h2>
        <p className="text-sm text-[var(--color-brand-grey)]">{data.focus}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Clock className="h-4 w-4" />} value={`${data.durationMin}m`} label="Duración" />
        <Stat icon={<Flame className="h-4 w-4" />} value={`${data.totalKcal}`} label="Kcal" />
        <Stat icon={<Dumbbell className="h-4 w-4" />} value={`${pct}%`} label="Hecho" />
      </div>

      <ul className="space-y-2">
        {data.exercises.map((ex, i) => (
          <motion.li
            key={ex.id}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                ex.done
                  ? "bg-[var(--color-brand-accent)] text-white"
                  : "border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
              }`}
            >
              {ex.done ? <Check className="h-4 w-4" /> : <span className="text-sm font-bold">{i + 1}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-brand-text-lbl)]">
                {ex.name}
              </p>
              <p className="text-xs text-[var(--color-brand-grey)]">{ex.muscle}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--color-brand-text-lbl)]">
              {ex.sets}×{ex.reps}
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-3">
      <span className="text-[var(--color-brand-accent)]">{icon}</span>
      <span className="text-lg font-bold text-[var(--color-brand-text-lbl)]">{value}</span>
      <span className="text-[11px] text-[var(--color-brand-grey)]">{label}</span>
    </div>
  );
}
