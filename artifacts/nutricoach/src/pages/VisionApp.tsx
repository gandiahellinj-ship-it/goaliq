import { useMemo, useState } from "react";
import { Home, UtensilsCrossed, Dumbbell, TrendingUp, Settings as Cog } from "lucide-react";
import { visionData } from "@/data";
import { SUPPLEMENTS } from "@/lib/supplements";
import { useUserSupplements } from "@/lib/supplements-service";
import SupplementsBadge from "@/components/vision/SupplementsBadge";
import SupplementsModal from "@/components/vision/SupplementsModal";
import HomeTab, { type DayTask } from "@/components/vision/HomeTab";

/**
 * GOALIQ Vision — 3-zone fixed viewport (no vertical scroll), migrated from the
 * old 5-floor scroll layout. Zones: content (~65%) · circular tab bar · contextual
 * panel (~26%). Data stays MOCK (src/data.ts) except supplements (real Supabase)
 * and settings; task check state is local/ephemeral (not persisted).
 *
 * Phase 1: shell + HOME. COMIDAS/ENTRENOS/PROGRESO/AJUSTES are placeholders.
 */

type TabId = "home" | "meals" | "workout" | "progress" | "settings";

const NAV: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "HOME", icon: Home },
  { id: "meals", label: "COMIDAS", icon: UtensilsCrossed },
  { id: "workout", label: "ENTRENOS", icon: Dumbbell },
  { id: "progress", label: "PROGRESO", icon: TrendingUp },
  { id: "settings", label: "AJUSTES", icon: Cog },
];

/** Assemble the day's itinerary from meals + workout (mock) + supplements (real). */
function useDayTasks(overrides: Record<string, boolean>): DayTask[] {
  const { data: sups = [] } = useUserSupplements();
  return useMemo(() => {
    const meals: DayTask[] = visionData.meal.meals.map((m) => ({
      id: `meal-${m.id}`,
      time: m.time,
      type: "COMIDA",
      name: m.tag,
      detail: m.name,
      done: m.done,
    }));
    const workout: DayTask[] = [
      {
        id: "workout",
        time: "18:00",
        type: "ENTRENO",
        name: visionData.workout.title,
        detail: `${visionData.workout.exercises.length} ejercicios`,
        done: false,
      },
    ];
    const supTasks: DayTask[] = sups.map((s) => ({
      id: `sup-${s.id}`,
      time: s.notificationTime,
      type: "SUPLEMENTO",
      name: SUPPLEMENTS.find((x) => x.id === s.id)?.name ?? s.id,
      detail: "",
      done: false,
    }));
    return [...meals, ...workout, ...supTasks]
      .map((t) => ({ ...t, done: overrides[t.id] ?? t.done }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [sups, overrides]);
}

export default function VisionApp() {
  const [tab, setTab] = useState<TabId>("home");
  const [suppOpen, setSuppOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const tasks = useDayTasks(overrides);
  const toggleTask = (id: string) =>
    setOverrides((o) => {
      const current = tasks.find((t) => t.id === id)?.done ?? false;
      return { ...o, [id]: !current };
    });

  const next = tasks.find((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  const topContent: Record<TabId, React.ReactNode> = {
    home: <HomeTab data={visionData.home} tasks={tasks} onToggle={toggleTask} />,
    meals: <Placeholder label="Comidas" phase={2} />,
    workout: <Placeholder label="Entrenos" phase={3} />,
    progress: <Placeholder label="Progreso" phase={4} />,
    settings: <Placeholder label="Ajustes" phase={5} />,
  };

  const contextual: Record<TabId, React.ReactNode> = {
    home: next ? (
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] text-[var(--color-brand-accent)]">SIGUIENTE</div>
          <div className="font-display text-4xl leading-none text-[var(--color-brand-text-lbl)]">{next.time}</div>
          <div className="mt-0.5 text-sm font-semibold text-[var(--color-brand-text-lbl)]">{next.name}</div>
          <div className="text-xs text-[var(--color-brand-grey)]">{next.detail}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl text-[var(--color-brand-text-lbl)]">
            {doneCount}
            <span className="text-lg text-[var(--color-brand-grey)]">/{tasks.length}</span>
          </div>
          <div className="text-[9px] tracking-[0.2em] text-[var(--color-brand-grey)]">TAREAS HOY</div>
        </div>
      </div>
    ) : (
      <div className="font-display text-2xl text-[var(--color-brand-accent)]">Día completo ✓</div>
    ),
    meals: <ContextStub phase={2} />,
    workout: <ContextStub phase={3} />,
    progress: <ContextStub phase={4} />,
    settings: <ContextStub phase={5} />,
  };

  return (
    <div className="goaliq-vision relative mx-auto flex h-screen w-full max-w-[430px] select-none flex-col overflow-hidden bg-[var(--color-brand-bg)] text-[var(--color-brand-text-lbl)]">
      {/* ── Zone 1 · content (~65%) ── */}
      <div className="relative flex flex-col overflow-hidden px-5 pt-5" style={{ flexBasis: "65%", minHeight: 0 }}>
        <SupplementsBadge onClick={() => setSuppOpen(true)} />
        {topContent[tab]}
      </div>

      {/* ── Zone 2 · circular tab bar ── */}
      <nav
        className="flex items-center justify-around px-3"
        style={{ flexBasis: "9%", background: "var(--color-brand-card)", borderTop: "1px solid var(--color-brand-border)" }}
        aria-label="Secciones"
      >
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = id === tab;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active}
              aria-label={label}
              className="flex flex-col items-center justify-center gap-0.5 rounded-full"
              style={{
                width: active ? 48 : 40,
                height: active ? 48 : 40,
                background: active ? "var(--color-brand-text-lbl)" : "transparent",
                color: active ? "var(--color-brand-accent-soft)" : "var(--color-brand-grey)",
                transform: active ? "translateY(-9px) scale(1.06)" : "none",
                boxShadow: active ? "0 6px 14px rgba(26,26,26,0.22)" : "none",
                transition: "all 250ms ease",
              }}
            >
              <Icon className={active ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]"} />
              <span className="text-[6px] font-bold tracking-[0.08em]">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Zone 3 · contextual panel (~26%) ── */}
      <div
        className="flex flex-col justify-center px-5 py-4"
        style={{ flexBasis: "26%", background: "var(--color-brand-card)", borderTop: "1px solid var(--color-brand-border)" }}
      >
        {contextual[tab]}
      </div>

      {suppOpen && <SupplementsModal onClose={() => setSuppOpen(false)} />}
    </div>
  );
}

function Placeholder({ label, phase }: { label: string; phase: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="font-display text-3xl text-[var(--color-brand-text-lbl)]">{label}</div>
      <div className="rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1 text-xs font-medium text-[var(--color-brand-grey)]">
        Se migra en la Fase {phase}
      </div>
    </div>
  );
}

function ContextStub({ phase }: { phase: number }) {
  return (
    <div className="text-xs text-[var(--color-brand-grey)]">Panel contextual · Fase {phase}</div>
  );
}
