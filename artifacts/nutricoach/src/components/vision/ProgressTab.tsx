import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ProgressData, ProgressStat } from "@/types";

function StatCard({ stat }: { stat: ProgressStat }) {
  const positive = stat.delta >= 0;
  const isGood = (stat.goodWhen === "up") === positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 py-2.5">
      <p className="text-[11px] text-[var(--color-brand-grey)]">{stat.label}</p>
      <p className="text-lg font-bold text-[var(--color-brand-text-lbl)]">{stat.value}</p>
      <span
        className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
        style={{ color: isGood ? "var(--color-brand-accent)" : "var(--color-brand-grey)" }}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(stat.delta)}
      </span>
    </div>
  );
}

/** PROGRESO (Phase 4) — top zone. Weight evolution chart + goal, and the 4 metric cards. */
export default function ProgressTab({ data }: { data: ProgressData }) {
  const w = 300, h = 96, pad = 10;
  const weights = data.weightSeries.map((p) => p.weight);
  const min = Math.min(...weights, data.goalWeight) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const span = max - min || 1;
  const points = data.weightSeries.map((p, i) => ({
    x: pad + (i * (w - pad * 2)) / (data.weightSeries.length - 1),
    y: pad + (1 - (p.weight - min) / span) * (h - pad * 2),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const goalY = pad + (1 - (data.goalWeight - min) / span) * (h - pad * 2);

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Progreso</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">Progreso</h2>
      </div>

      {/* Weight chart */}
      <div className="mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] text-[var(--color-brand-grey)]">Evolución del peso</span>
          <span className="text-[12px] font-semibold text-[var(--color-brand-accent)]">Meta {data.goalWeight} kg</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 96 }}>
          <line x1={pad} y1={goalY} x2={w - pad} y2={goalY} stroke="var(--color-brand-grey)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          <polyline points={line} fill="none" stroke="var(--color-brand-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--color-brand-accent)" />
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-brand-grey)]">
          {data.weightSeries.map((p) => (
            <span key={p.week}>{p.week}</span>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>
    </div>
  );
}
