import type { MuscleGroup } from "@/types";

/** Interpolate between two #rrggbb colours. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * PROGRESO 4b v2 — "Tu paisaje muscular", con DATOS REALES (Fase D).
 * White card with overlapping bell mountains (one per group, always fully
 * visible at 390px), a chip selector, the balance insight (computed from
 * real weekly series — never invented), and two weight mini-cards.
 * No green anywhere — beige tokens only.
 */
export default function ProgressTab({
  weekLabel,
  weekSeriesTotal,
  muscleGroups,
  insight,
  weight,
  selectedGroup,
  onSelectGroup,
}: {
  weekLabel: string;
  weekSeriesTotal: number;
  muscleGroups: MuscleGroup[];
  insight: string;
  /** Peso real: actual, diferencia con el registro anterior y meta (null = sin datos). */
  weight: { current: number | null; delta: number | null; target: number | null };
  selectedGroup: string;
  onSelectGroup: (name: string) => void;
}) {
  const groups = muscleGroups;
  // max(1, …): con 0 series en todos los grupos el paisaje queda plano, sin NaN.
  const maxS = Math.max(1, ...groups.map((g) => g.series));
  const minS = Math.min(...groups.map((g) => g.series));

  const W = 360, H = 120, M = 26, base = 104, maxH = 84, hw = 44;
  const cellW = (W - 2 * M) / groups.length;
  const peaks = groups.map((g, i) => {
    const x = M + (i + 0.5) * cellW;
    const y = base - (g.series / maxS) * maxH;
    const t = maxS === minS ? 1 : (g.series - minS) / (maxS - minS);
    return { g, x, y, sand: lerpHex("#ECDFCB", "#BA9D79", t) };
  });
  const bell = (x: number, y: number) =>
    `M ${x - hw} ${base} C ${x - hw * 0.45} ${base} ${x - hw * 0.45} ${y} ${x} ${y} ` +
    `C ${x + hw * 0.45} ${y} ${x + hw * 0.45} ${base} ${x + hw} ${base} Z`;
  const drawOrder = [...peaks].sort((a, b) => a.y - b.y); // tallest first → behind

  const remaining =
    weight.current != null && weight.target != null
      ? Math.round(Math.abs(weight.current - weight.target) * 10) / 10
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Progreso</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">Tu paisaje muscular</h2>
        <p className="mt-1 text-[12px] text-[var(--color-brand-grey)]">
          <span className="font-semibold text-[var(--color-brand-text-lbl)]">{weekLabel}</span> · {weekSeriesTotal} series completadas
        </p>
      </div>

      {/* Landscape card */}
      <div className="mt-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {drawOrder.map(({ g, x, y, sand }) => {
            const active = g.name === selectedGroup;
            return (
              <path
                key={g.name}
                d={bell(x, y)}
                fill={active ? "var(--color-brand-accent)" : sand}
                opacity={active ? 1 : 0.35}
                onClick={() => onSelectGroup(g.name)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          <polyline
            points={peaks.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--color-brand-accent)"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.7"
          />
          {peaks.map(({ g, x, y }) => (
            <circle key={g.name} cx={x} cy={y} r="3" fill="var(--color-brand-accent)" />
          ))}
        </svg>
      </div>

      {/* Chip selector */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {groups.map((g) => {
          const active = g.name === selectedGroup;
          return (
            <button
              key={g.name}
              onClick={() => onSelectGroup(g.name)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
              style={
                active
                  ? { background: "var(--color-brand-text-lbl)", color: "#fff" }
                  : { background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-text-lbl)" }
              }
            >
              {g.name}
              <span style={{ color: active ? "var(--color-brand-accent-soft)" : "var(--color-brand-grey)" }}>{g.series}</span>
            </button>
          );
        })}
      </div>

      {/* Balance insight — calculado con las series reales de la semana */}
      <div className="mt-2 rounded-xl px-3 py-1.5 text-[11px] leading-snug" style={{ background: "var(--color-brand-accent-soft)", color: "#6B5B3E" }}>
        {insight}
      </div>

      {/* Weight mini-cards — datos reales (— cuando no hay registros) */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5">
          <p className="text-[11px] text-[var(--color-brand-grey)]">Peso actual</p>
          <p className="text-lg font-bold text-[var(--color-brand-text-lbl)]">
            {weight.current != null ? `${weight.current} kg` : "—"}
          </p>
          {weight.delta != null && weight.delta !== 0 && (
            <span className="text-[11px] font-semibold text-[var(--color-brand-accent)]">
              {weight.delta < 0 ? "↘" : "↗"} {Math.abs(weight.delta)}
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5">
          <p className="text-[11px] text-[var(--color-brand-grey)]">Meta</p>
          <p className="text-lg font-bold text-[var(--color-brand-text-lbl)]">
            {weight.target != null ? `${weight.target} kg` : "—"}
          </p>
          {remaining != null && (
            <span className="text-[11px] font-semibold text-[var(--color-brand-accent)]">faltan {remaining}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Contextual — detailed subgroup analysis for the selected group. Changes with selection. */
export function ProgressAnalysis({ group }: { group: MuscleGroup }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
          Análisis detallado · {group.name}
        </p>
        <span className="text-[11px] font-bold text-[var(--color-brand-text-lbl)]">{group.series} series</span>
      </div>

      {group.subgroups.length === 0 && (
        <p className="mt-2 text-[11px] text-[var(--color-brand-grey)]">
          Sin series de {group.name.toLowerCase()} registradas esta semana.
        </p>
      )}
      <div className="mt-2 space-y-1">
        {group.subgroups.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] text-[var(--color-brand-text-lbl)]">{s.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-brand-border)]">
              <span className="block h-full rounded-full bg-[var(--color-brand-accent)]" style={{ width: `${s.pct}%` }} />
            </span>
            <span className="w-24 shrink-0 text-right text-[10px] text-[var(--color-brand-grey)]">
              {s.series} series ({s.pct}%)
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">Consejo del entrenador</p>
        <p
          className="text-[11px] leading-snug text-[var(--color-brand-text-lbl)]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: group.subgroups.length >= 4 ? 3 : group.subgroups.length === 3 ? 4 : 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {group.advice}
        </p>
      </div>
    </div>
  );
}
