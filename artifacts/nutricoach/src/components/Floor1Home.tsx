import { motion } from "framer-motion";
import { Flame, UtensilsCrossed, Dumbbell, TrendingUp } from "lucide-react";
import type { ActivityRing, HomeData, FloorId } from "@/types";

function SmallRing({ ring, delay }: { ring: ActivityRing; delay: number }) {
  const pct = Math.min(1, ring.value / ring.goal);
  const r = 26;
  const c = 2 * Math.PI * r;
  const display =
    ring.value >= 1000 ? `${(ring.value / 1000).toFixed(1)}k` : ring.value.toLocaleString();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-brand-border)" strokeWidth="6" />
          <motion.circle
            cx="32" cy="32" r={r} fill="none" stroke="var(--color-brand-cyan)" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - pct) }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 0.9, ease: "easeOut", delay }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--color-brand-text-lbl)]">{display}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-[var(--color-brand-grey)]">{ring.label}</span>
    </div>
  );
}

export default function Floor1Home({
  data,
  onGoTo,
}: {
  data: HomeData;
  onGoTo: (id: FloorId) => void;
}) {
  const pct = Math.min(1, data.dailyGoal.value / data.dailyGoal.goal);
  const R = 80;
  const C = 2 * Math.PI * R;

  return (
    <section className="flex h-full flex-col justify-center gap-7 px-6 py-12">
      {/* Greeting + streak */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-brand-grey)]">{data.dateLabel}</p>
          <h2 className="font-display text-4xl font-extrabold leading-tight text-[var(--color-brand-text-lbl)]">
            {data.greeting},<br />{data.userName}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand-cyan)]/15 px-3 py-1.5">
          <Flame className="h-4 w-4 text-[var(--color-brand-cyan)]" />
          <span className="text-sm font-bold text-[var(--color-brand-text-lbl)]">{data.streak}</span>
        </div>
      </div>

      {/* Big central ring */}
      <div className="flex justify-center">
        <div className="relative h-52 w-52">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-brand-border)" strokeWidth="14" />
            <motion.circle
              cx="100" cy="100" r={R} fill="none" stroke="var(--color-brand-cyan)" strokeWidth="14"
              strokeLinecap="round" strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              whileInView={{ strokeDashoffset: C * (1 - pct) }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-6xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">
              {data.dailyGoal.value}
              <span className="text-2xl">%</span>
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--color-brand-grey)]">
              {data.dailyGoal.label}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary rings */}
      <div className="flex items-start justify-center gap-8">
        {data.rings.map((ring, i) => (
          <SmallRing key={ring.label} ring={ring} delay={i * 0.12} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickButton icon={<UtensilsCrossed className="h-5 w-5" />} label="Comidas" onClick={() => onGoTo("meals")} />
        <QuickButton icon={<Dumbbell className="h-5 w-5" />} label="Entrenar" onClick={() => onGoTo("workout")} primary />
        <QuickButton icon={<TrendingUp className="h-5 w-5" />} label="Progreso" onClick={() => onGoTo("progress")} />
      </div>
    </section>
  );
}

function QuickButton({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-4 text-xs font-semibold transition-colors ${
        primary
          ? "border-transparent bg-[var(--color-brand-cyan)] text-white"
          : "border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-lbl)]"
      }`}
    >
      {icon}
      {label}
    </motion.button>
  );
}
