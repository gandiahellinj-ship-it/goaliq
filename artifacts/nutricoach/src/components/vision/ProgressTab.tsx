import type { ProgressData } from "@/types";

/** Interpolate between two #rrggbb colours. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * PROGRESO 4b — "Tu paisaje muscular". Overlapping bell-shaped mountains, one per
 * muscle group; height = series this week, colour from light sand (least worked)
 * to --color-brand-accent (most worked). Peaks joined by a thin dotted line.
 * Flat style, cream background. Below: educational block + two weight mini-cards.
 */
export default function ProgressTab({ data }: { data: ProgressData }) {
  const groups = data.muscleGroups;
  const maxS = Math.max(...groups.map((g) => g.series));
  const minS = Math.min(...groups.map((g) => g.series));

  const W = 360, H = 150, M = 24, base = 112, maxH = 88, hw = 46;
  const cellW = (W - 2 * M) / groups.length;
  const peaks = groups.map((g, i) => {
    const x = M + (i + 0.5) * cellW;
    const y = base - (g.series / maxS) * maxH;
    const t = maxS === minS ? 1 : (g.series - minS) / (maxS - minS);
    return { ...g, x, y, color: lerpHex("#ECDFCB", "#BA9D79", t) };
  });
  const bell = (x: number, y: number) =>
    `M ${x - hw} ${base} C ${x - hw * 0.45} ${base} ${x - hw * 0.45} ${y} ${x} ${y} ` +
    `C ${x + hw * 0.45} ${y} ${x + hw * 0.45} ${base} ${x + hw} ${base} Z`;
  const drawOrder = [...peaks].sort((a, b) => a.y - b.y); // tallest (smallest y) first → behind

  // Weight mini-cards (derived from existing data).
  const peso = data.stats.find((s) => s.label === "Peso");
  const last = data.weightSeries[data.weightSeries.length - 1]?.weight ?? data.goalWeight;
  const remaining = (last - data.goalWeight).toFixed(1);

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Progreso</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">Tu paisaje muscular</h2>
      </div>

      <p className="mt-1.5 text-[12px] text-[var(--color-brand-grey)]">
        <span className="font-semibold text-[var(--color-brand-text-lbl)]">{data.weekLabel}</span> · {data.weekSeriesTotal} series completadas
      </p>

      {/* Muscle landscape */}
      <div className="mt-2 min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: "100%" }}>
          {drawOrder.map((p) => (
            <path key={p.name} d={bell(p.x, p.y)} fill={p.color} opacity={0.96} />
          ))}
          <polyline
            points={peaks.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--color-brand-accent)"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.75"
          />
          {peaks.map((p) => (
            <circle key={p.name} cx={p.x} cy={p.y} r="3" fill="var(--color-brand-accent)" />
          ))}
          {peaks.map((p) => (
            <g key={p.name}>
              <text x={p.x} y={130} textAnchor="middle" fontSize="9" fill="var(--color-brand-grey)">{p.name}</text>
              <text x={p.x} y={145} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-brand-text-lbl)">{p.series}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Educational block */}
      <div className="mt-2 rounded-xl px-3 py-1.5 text-[11px] leading-snug" style={{ background: "var(--color-brand-accent-soft)", color: "#6B5B3E" }}>
        Tu espalda va 8 series por detrás del pecho. Equilibrar el tirón protege tus hombros y mejora la postura.
      </div>

      {/* Weight mini-cards */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5">
          <p className="text-[11px] text-[var(--color-brand-grey)]">Peso tendencia</p>
          <p className="text-lg font-bold text-[var(--color-brand-text-lbl)]">{peso?.value ?? "—"}</p>
          {peso && (
            <span className="text-[11px] font-semibold text-[var(--color-brand-accent)]">↘ {Math.abs(peso.delta)}</span>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5">
          <p className="text-[11px] text-[var(--color-brand-grey)]">Meta</p>
          <p className="text-lg font-bold text-[var(--color-brand-text-lbl)]">{data.goalWeight} kg</p>
          <span className="text-[11px] font-semibold text-[var(--color-brand-accent)]">−{Math.abs(Number(remaining))}</span>
        </div>
      </div>
    </div>
  );
}
