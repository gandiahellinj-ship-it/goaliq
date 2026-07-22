import { Flame } from "lucide-react";
import type { HomeData, ActivityRing } from "@/types";

/** One item in the day's itinerary (assembled from meals + workout + supplements). */
export interface DayTask {
  id: string;
  time: string; // "HH:MM"
  type: string; // COMIDA · ENTRENO · SUPLEMENTO
  name: string;
  detail: string;
  done: boolean;
}

/** Compact numeric chip for a secondary ring (movimiento / pasos / agua). */
function ringChipLabel(ring: ActivityRing): string {
  const v =
    ring.value >= 1000 ? `${(ring.value / 1000).toFixed(1)}k` : `${ring.value}`;
  return ring.unit ? `${v} ${ring.unit}` : v;
}

export default function HomeTab({
  data,
  tasks,
  onToggle,
}: {
  data: HomeData;
  tasks: DayTask[];
  onToggle: (id: string) => void;
}) {
  const lastDone = tasks.reduce((acc, t, i) => (t.done ? i : acc), -1);
  const fillFrac = tasks.length > 1 ? Math.max(0, lastDone) / (tasks.length - 1) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header: date + greeting + streak (pr-14 clears the absolute supplements badge) */}
      <div className="flex items-start justify-between pr-14">
        <div>
          <p className="text-xs text-[var(--color-brand-grey)]">{data.dateLabel}</p>
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] text-[var(--color-brand-text-lbl)]">
            {data.greeting},<br />
            {data.userName}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1">
          <Flame className="h-4 w-4 text-[var(--color-brand-accent)]" />
          <span className="text-sm font-bold text-[var(--color-brand-text-lbl)]">{data.streak}</span>
        </div>
      </div>

      {/* Ring chips (movimiento / pasos / agua) */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.rings.map((ring) => (
          <span
            key={ring.label}
            className="rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-text-lbl)]"
          >
            {ringChipLabel(ring)}
            <span className="ml-1 font-normal text-[var(--color-brand-grey)]">{ring.label}</span>
          </span>
        ))}
      </div>

      {/* Day itinerary — checklist with a progress line */}
      <div className="relative mt-4 min-h-0 flex-1">
        {/* Track */}
        <div className="absolute w-0.5 bg-[var(--color-brand-border)]" style={{ left: 67, top: 13, bottom: 13 }} />
        {/* Fill */}
        <div
          className="absolute w-0.5 bg-[var(--color-brand-accent)]"
          style={{ left: 67, top: 13, height: `calc(${fillFrac} * (100% - 26px))`, transition: "height 400ms ease" }}
        />
        <ul className="flex h-full flex-col justify-between">
          {tasks.map((t) => {
            // SUPLEMENTO rows are compact: half height, single line (time + name),
            // smaller dot + smaller type. Comidas/entreno keep their full size.
            const compact = t.type === "SUPLEMENTO";
            return (
              <li key={t.id}>
                <button
                  onClick={() => onToggle(t.id)}
                  className="relative flex w-full items-center gap-3 text-left"
                >
                  <span
                    className={`w-11 shrink-0 font-semibold ${compact ? "text-[10px]" : "text-xs"}`}
                    style={{ color: t.done ? "var(--color-brand-text-lbl)" : "var(--color-brand-grey)" }}
                  >
                    {t.time}
                  </span>
                  {/* Fixed 26px-wide slot keeps every dot centered on the progress line */}
                  <span
                    className="z-10 flex w-[26px] shrink-0 items-center justify-center"
                    style={{ height: compact ? 22 : 26 }}
                  >
                    <span
                      className="flex items-center justify-center rounded-full font-semibold"
                      style={{
                        width: compact ? 16 : 26,
                        height: compact ? 16 : 26,
                        fontSize: compact ? 9 : 12,
                        background: t.done ? "var(--color-brand-accent)" : "var(--color-brand-card)",
                        border: `1.5px solid ${t.done ? "var(--color-brand-accent)" : "var(--color-brand-border)"}`,
                        color: t.done ? "#fff" : "var(--color-brand-grey)",
                        transition: "all 250ms ease",
                      }}
                    >
                      {t.done ? "✓" : ""}
                    </span>
                  </span>
                  {compact ? (
                    <span
                      className="truncate text-[11px] font-medium text-[var(--color-brand-text-lbl)]"
                      style={{ opacity: t.done ? 0.45 : 1, transition: "opacity 250ms" }}
                    >
                      {t.name}
                    </span>
                  ) : (
                    <span style={{ opacity: t.done ? 0.45 : 1, transition: "opacity 250ms" }}>
                      <span className="block text-[9px] font-semibold tracking-[0.16em] text-[var(--color-brand-accent)]">
                        {t.type}
                      </span>
                      <span className="block text-sm font-semibold text-[var(--color-brand-text-lbl)]">{t.name}</span>
                      <span className="block text-xs text-[var(--color-brand-grey)]">{t.detail}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
