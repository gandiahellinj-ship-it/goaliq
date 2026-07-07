import { Check } from "lucide-react";
import type { WorkoutData, Exercise } from "@/types";

/**
 * ENTRENOS (Phase 3) — top zone. Routine header + 3 stat cards + exercise list.
 * Exercises are togglable (local/ephemeral); state is lifted to VisionApp so the
 * contextual indicators + "Entreno completado" button stay in sync. Data mock.
 */
export default function WorkoutTab({
  data,
  exercises,
  onToggle,
}: {
  data: WorkoutData;
  exercises: Exercise[];
  onToggle: (id: string) => void;
}) {
  const doneCount = exercises.filter((e) => e.done).length;
  const pct = Math.round((doneCount / exercises.length) * 100);

  const stats: [string, string][] = [
    [`${data.durationMin}m`, "Duración"],
    [`${data.totalKcal}`, "Kcal"],
    [`${pct}%`, "Hecho"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Entrenos</p>
        <h2 className="font-display text-3xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">{data.title}</h2>
        <p className="mt-1 text-[13px] text-[var(--color-brand-grey)]">{data.focus}</p>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([v, l]) => (
          <div key={l} className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2.5 text-center">
            <div className="text-[17px] font-bold text-[var(--color-brand-text-lbl)]">{v}</div>
            <div className="text-[11px] text-[var(--color-brand-grey)]">{l}</div>
          </div>
        ))}
      </div>

      {/* Exercise list */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between gap-2">
        {exercises.map((e, i) => (
          <button
            key={e.id}
            onClick={() => onToggle(e.id)}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5 text-left"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                e.done
                  ? "bg-[var(--color-brand-accent)] text-white"
                  : "border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
              }`}
            >
              {e.done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1" style={{ opacity: e.done ? 0.5 : 1 }}>
              <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-lbl)]">{e.name}</span>
              <span className="block text-[11.5px] text-[var(--color-brand-grey)]">{e.muscle}</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-[var(--color-brand-text-lbl)]">
              {e.sets}×{e.reps}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
