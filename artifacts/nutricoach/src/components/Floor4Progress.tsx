import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ProgressData, ProgressStat } from "@/types";

function StatCard({ stat }: { stat: ProgressStat }) {
  const positive = stat.delta >= 0;
  const isGood = (stat.goodWhen === "up") === positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <p className="text-xs text-[var(--color-brand-grey)]">{stat.label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--color-brand-text-lbl)]">{stat.value}</p>
      <span
        className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold ${
          isGood ? "text-[var(--color-brand-accent)]" : "text-[var(--color-brand-grey)]"
        }`}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(stat.delta)}
      </span>
    </div>
  );
}

export default function Floor4Progress({ data }: { data: ProgressData }) {
  const w = 300;
  const h = 110;
  const pad = 8;
  const weights = data.weightSeries.map((p) => p.weight);
  const min = Math.min(...weights, data.goalWeight) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const span = max - min || 1;

  const points = data.weightSeries.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.weightSeries.length - 1);
    const y = pad + (1 - (p.weight - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const goalY = pad + (1 - (data.goalWeight - min) / span) * (h - pad * 2);

  return (
    <section className="flex h-full flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-grey)]">
          Piso 4 · Progreso
        </p>
        <h2 className="font-display text-4xl font-extrabold text-[var(--color-brand-text-lbl)]">
          Progreso
        </h2>
      </header>

      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-brand-grey)]">Evolución del peso</span>
          <span className="text-sm font-semibold text-[var(--color-brand-accent)]">
            Meta {data.goalWeight} kg
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
          <line
            x1={pad} y1={goalY} x2={w - pad} y2={goalY}
            stroke="var(--color-brand-grey)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
          />
          <motion.polyline
            points={line} fill="none" stroke="var(--color-brand-accent)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />
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

      <div className="grid grid-cols-2 gap-3">
        {data.stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>
    </section>
  );
}
