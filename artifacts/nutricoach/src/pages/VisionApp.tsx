import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Home, UtensilsCrossed, Dumbbell, TrendingUp, Settings as Cog, Loader2 } from "lucide-react";
import { useVisionMeals, useVisionWorkout, useVisionHome, useVisionProgress } from "@/lib/vision-data";
import { useAuth } from "@/hooks/useAuth";
import type { MealItem, Exercise } from "@/types";
import { SUPPLEMENTS } from "@/lib/supplements";
import { useUserSupplements } from "@/lib/supplements-service";
import SupplementsBadge from "@/components/vision/SupplementsBadge";
import SupplementsModal from "@/components/vision/SupplementsModal";
import HomeTab, { type DayTask } from "@/components/vision/HomeTab";
import MealsTab, { MealsCarousel } from "@/components/vision/MealsTab";
import WorkoutTab, { WorkoutCarousel } from "@/components/vision/WorkoutTab";
import ProgressTab, { ProgressAnalysis } from "@/components/vision/ProgressTab";
import SettingsTab, { SettingsContext } from "@/components/vision/SettingsTab";

/**
 * GOALIQ Vision — 3-zone fixed viewport (no vertical scroll), migrated from the
 * old 5-floor scroll layout. Zones: content (~65%) · circular tab bar · contextual
 * panel (~26%). Todas las pestañas con DATOS REALES (fases A-E); el estado de
 * check de tareas es local/efímero hasta el bucle diario (FLUJO_DIARIO).
 *
 * VisionApp = puerta de sesión; VisionAppInner = app con los datos (solo se
 * monta con sesión, así los ganchos de datos nunca se ejecutan sin token).
 */

type TabId = "home" | "meals" | "workout" | "progress" | "settings";

/** Marco beige de /vision — compartido por la puerta de sesión y la app. */
function VisionFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="goaliq-vision flex min-h-screen w-full justify-center sm:items-center" style={{ background: "#E4DFD6" }}>
      <div className="relative flex h-screen w-full max-w-[430px] select-none flex-col overflow-hidden bg-[var(--color-brand-bg)] text-[var(--color-brand-text-lbl)] sm:h-[900px] sm:max-h-[94vh] sm:rounded-[32px] sm:shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/** Puerta de sesión: sin login no se muestran las tripas, solo una invitación. */
export default function VisionApp() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <VisionFrame>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-accent)]" />
        </div>
      </VisionFrame>
    );
  }

  if (!isAuthenticated) {
    return (
      <VisionFrame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="font-display text-3xl font-black italic">
            <span className="text-[var(--color-brand-text-lbl)]">Goal</span>
            <span className="text-[var(--color-brand-accent)]">IQ</span>
          </span>
          <p className="text-sm text-[var(--color-brand-grey)]">
            Inicia sesión para ver tu día: comidas, entrenos y progreso.
          </p>
          <button
            onClick={login}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand-accent)" }}
          >
            Iniciar sesión
          </button>
        </div>
      </VisionFrame>
    );
  }

  return <VisionAppInner />;
}

/** Estado de ERROR de una pestaña — fallo de red/servidor, con reintento. */
function VisionErrorState({ kicker, title }: { kicker: string; title: string }) {
  const queryClient = useQueryClient();
  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">{kicker}</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-sm font-semibold text-[var(--color-brand-text-lbl)]">No hemos podido cargar tus datos.</div>
        <div className="max-w-[260px] text-xs text-[var(--color-brand-grey)]">Comprueba tu conexión e inténtalo de nuevo.</div>
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand-accent)" }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

/** Estado de carga/vacío/descanso de una pestaña — mantiene su cabecera. */
function VisionEmptyState({
  kicker,
  title,
  text,
  hint,
}: {
  kicker: string;
  title: string;
  text: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">{kicker}</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="text-sm font-semibold text-[var(--color-brand-text-lbl)]">{text}</div>
        {hint && <div className="max-w-[260px] text-xs text-[var(--color-brand-grey)]">{hint}</div>}
      </div>
    </div>
  );
}

const NAV: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "HOME", icon: Home },
  { id: "meals", label: "COMIDAS", icon: UtensilsCrossed },
  { id: "workout", label: "ENTRENOS", icon: Dumbbell },
  { id: "progress", label: "PROGRESO", icon: TrendingUp },
  { id: "settings", label: "AJUSTES", icon: Cog },
];

function VisionAppInner() {
  const [tab, setTab] = useState<TabId>("home");
  const [suppOpen, setSuppOpen] = useState(false);

  // COMIDAS — DATOS REALES (Fase A): plan semanal del usuario vía adaptador.
  // El check sigue siendo local/efímero (el registro real llega con FLUJO_DIARIO).
  const visionMeals = useVisionMeals();
  const [mealOverrides, setMealOverrides] = useState<Record<string, boolean>>({});
  const meals: MealItem[] = useMemo(
    () => visionMeals.meals.map((m) => ({ ...m, done: mealOverrides[m.id] ?? m.done })),
    [visionMeals.meals, mealOverrides],
  );
  const toggleMeal = (id: string) =>
    setMealOverrides((o) => ({ ...o, [id]: !(meals.find((m) => m.id === id)?.done ?? false) }));
  // Selected dish for the COMIDAS hero; defaults to the first meal not yet done.
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const selectedMeal: MealItem | undefined =
    meals.find((m) => m.id === selectedMealId) ?? meals.find((m) => !m.done) ?? meals[0];

  // ENTRENOS — DATOS REALES (Fase B): rutina de hoy del plan del usuario.
  // El check sigue siendo local/efímero, como en COMIDAS.
  const visionWorkout = useVisionWorkout();
  const [exOverrides, setExOverrides] = useState<Record<string, boolean>>({});
  const exercises: Exercise[] = useMemo(
    () => visionWorkout.exercises.map((e) => ({ ...e, done: exOverrides[e.id] ?? e.done })),
    [visionWorkout.exercises, exOverrides],
  );
  const toggleEx = (id: string) =>
    setExOverrides((o) => ({ ...o, [id]: !(exercises.find((e) => e.id === id)?.done ?? false) }));
  const completeWorkout = () =>
    setExOverrides(Object.fromEntries(visionWorkout.exercises.map((e) => [e.id, true])));
  const allExDone = exercises.length > 0 && exercises.every((e) => e.done);
  // Selected exercise for the ENTRENOS hero; defaults to the first one not done.
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const selectedExercise: Exercise | undefined =
    exercises.find((e) => e.id === selectedExerciseId) ?? exercises.find((e) => !e.done) ?? exercises[0];

  // HOME — DATOS REALES (Fase C): itinerario ensamblado de comidas reales
  // (Fase A) + entreno real (Fase B) + suplementos reales. El check de una
  // comida en HOME y en COMIDAS es EL MISMO estado (misma fuente, como pide
  // FLUJO_DIARIO); el del entreno equivale a "todos los ejercicios hechos".
  const visionHome = useVisionHome();
  const { data: sups = [] } = useUserSupplements();
  const [supOverrides, setSupOverrides] = useState<Record<string, boolean>>({});

  const tasks: DayTask[] = useMemo(() => {
    const mealTasks: DayTask[] = meals.map((m) => ({
      id: `meal-${m.id}`,
      time: m.time,
      type: "COMIDA",
      name: m.tag,
      detail: m.name,
      done: m.done,
    }));
    const workoutTasks: DayTask[] =
      visionWorkout.hasPlan && !visionWorkout.isRestDay && exercises.length > 0
        ? [
            {
              // Hora fija 18:00 hasta que exista la hora configurable de
              // entreno (bucle diario, FLUJO_DIARIO §1).
              id: "workout",
              time: "18:00",
              type: "ENTRENO",
              name: visionWorkout.title,
              detail: `${exercises.length} ejercicios`,
              done: allExDone,
            },
          ]
        : [];
    const supTasks: DayTask[] = sups.map((s) => ({
      id: `sup-${s.id}`,
      time: s.notificationTime,
      type: "SUPLEMENTO",
      name: SUPPLEMENTS.find((x) => x.id === s.id)?.name ?? s.id,
      detail: "",
      done: supOverrides[`sup-${s.id}`] ?? false,
    }));
    return [...mealTasks, ...workoutTasks, ...supTasks].sort((a, b) => a.time.localeCompare(b.time));
  }, [meals, visionWorkout, exercises, allExDone, sups, supOverrides]);

  const toggleTask = (id: string) => {
    if (id.startsWith("meal-")) {
      toggleMeal(id.slice(5));
    } else if (id === "workout") {
      if (allExDone) setExOverrides({});
      else completeWorkout();
    } else {
      setSupOverrides((o) => ({ ...o, [id]: !(o[id] ?? false) }));
    }
  };

  const next = tasks.find((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  // PROGRESO — DATOS REALES (Fase D): paisaje muscular de las series
  // registradas esta semana + peso real. Siempre 6 grupos (con 0 si no hay).
  const visionProgress = useVisionProgress();
  const [selectedGroup, setSelectedGroup] = useState<string>("Pecho");
  const selectedGroupObj =
    visionProgress.muscleGroups.find((g) => g.name === selectedGroup) ?? visionProgress.muscleGroups[0];

  const topContent: Record<TabId, React.ReactNode> = {
    home: visionHome.loading ? (
      <VisionEmptyState kicker="Inicio" title="Hoy" text="Cargando tu día…" />
    ) : visionHome.error ? (
      <VisionErrorState kicker="Inicio" title="Hoy" />
    ) : (
      <HomeTab
        data={{
          greeting: visionHome.greeting,
          userName: visionHome.userName,
          dateLabel: visionHome.dateLabel,
          // Racha omitida a propósito: oculta hasta que exista el bucle
          // diario (decisión 24/07/2026). Chips = datos reales.
          rings: visionHome.chips,
        }}
        tasks={tasks}
        onToggle={toggleTask}
      />
    ),
    meals: visionMeals.loading ? (
      <VisionEmptyState kicker="Comidas" title="Nutrición" text="Cargando tu plan de comidas…" />
    ) : visionMeals.error ? (
      <VisionErrorState kicker="Comidas" title="Nutrición" />
    ) : !visionMeals.hasPlan || !selectedMeal ? (
      <VisionEmptyState
        kicker="Comidas"
        title="Nutrición"
        text="Aún no tienes plan de comidas esta semana."
        hint="Genera tu plan en la pestaña Comidas de la app actual y aparecerá aquí."
      />
    ) : (
      <MealsTab
        meals={meals}
        macrosToday={visionMeals.macrosToday}
        caloriesGoal={visionMeals.caloriesGoal}
        selected={selectedMeal}
        onToggle={toggleMeal}
      />
    ),
    workout: visionWorkout.loading ? (
      <VisionEmptyState kicker="Entrenos" title="Entrenamiento" text="Cargando tu rutina…" />
    ) : visionWorkout.error ? (
      <VisionErrorState kicker="Entrenos" title="Entrenamiento" />
    ) : !visionWorkout.hasPlan ? (
      <VisionEmptyState
        kicker="Entrenos"
        title="Entrenamiento"
        text="Aún no tienes plan de entrenos."
        hint="Genera tu rutina en la pestaña Entrenos de la app actual y aparecerá aquí."
      />
    ) : visionWorkout.isRestDay || !selectedExercise ? (
      <VisionEmptyState
        kicker="Entrenos"
        title="Descanso"
        text="Hoy toca descansar."
        hint="La recuperación también forma parte del plan. Mañana, más."
      />
    ) : (
      <WorkoutTab
        data={{
          title: visionWorkout.title,
          focus: visionWorkout.focus,
          durationMin: visionWorkout.durationMin,
          exercises,
        }}
        exercises={exercises}
        selected={selectedExercise}
        onToggle={toggleEx}
      />
    ),
    progress: visionProgress.loading ? (
      <VisionEmptyState kicker="Progreso" title="Tu paisaje muscular" text="Cargando tus registros…" />
    ) : visionProgress.error ? (
      <VisionErrorState kicker="Progreso" title="Tu paisaje muscular" />
    ) : (
      <ProgressTab
        weekLabel={visionProgress.weekLabel}
        weekSeriesTotal={visionProgress.weekSeriesTotal}
        muscleGroups={visionProgress.muscleGroups}
        insight={visionProgress.insight}
        weight={{
          current: visionProgress.currentWeightKg,
          delta: visionProgress.weightDelta,
          target: visionProgress.targetWeightKg,
        }}
        selectedGroup={selectedGroup}
        onSelectGroup={setSelectedGroup}
      />
    ),
    settings: <SettingsTab />,
  };

  const contextual: Record<TabId, React.ReactNode> = {
    home: visionHome.loading || visionHome.error ? (
      <div className="text-xs text-[var(--color-brand-grey)]">&nbsp;</div>
    ) : tasks.length === 0 ? (
      <div className="text-xs text-[var(--color-brand-grey)]">
        Genera tus planes de comidas y entrenos para ver aquí tu día.
      </div>
    ) : next ? (
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
    meals:
      visionMeals.hasPlan && selectedMeal ? (
        <div>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-brand-accent)]">TUS COMIDAS DE HOY</div>
          <MealsCarousel meals={meals} selectedId={selectedMeal.id} onSelect={setSelectedMealId} />
        </div>
      ) : (
        <div className="text-xs text-[var(--color-brand-grey)]">Tus comidas del día aparecerán aquí.</div>
      ),
    workout:
      visionWorkout.hasPlan && !visionWorkout.isRestDay && selectedExercise ? (
        <div>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-brand-accent)]">EJERCICIOS</div>
          <WorkoutCarousel
            exercises={exercises}
            selectedId={selectedExercise.id}
            onSelect={setSelectedExerciseId}
            onCompleteAll={completeWorkout}
            allDone={allExDone}
          />
        </div>
      ) : (
        <div className="text-xs text-[var(--color-brand-grey)]">
          {visionWorkout.isRestDay ? "Día de descanso — sin ejercicios." : "Tu rutina del día aparecerá aquí."}
        </div>
      ),
    progress: <ProgressAnalysis group={selectedGroupObj} />,
    settings: <SettingsContext />,
  };

  return (
    <VisionFrame>
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
    </VisionFrame>
  );
}
