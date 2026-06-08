import { useState, useMemo } from "react";
import {
  useProgressStats,
  useLogWeight,
  useStrengthGroupLogs,
} from "@/lib/supabase-queries";
import type { StrengthLog } from "@/lib/supabase-queries";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { parseISO, subMonths } from "date-fns";
import { Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TrialGate } from "@/components/TrialGate";
import { ShareProgressButton } from "@/components/ShareProgressCard";
import { useT } from "@/lib/language";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "1A", months: 12 },
  { key: "Todo", months: 0 },
] as const;

const GROUP_KEYS = ["shoulders", "legs", "back", "chest", "core", "arms"] as const;
type GroupKey = (typeof GROUP_KEYS)[number];

const GROUP_META: Record<GroupKey, { label: string; color: string }> = {
  shoulders: { label: "Hombros",  color: "#D4537E" },
  legs:      { label: "Piernas",  color: "#378ADD" },
  back:      { label: "Espalda",  color: "#7F77DD" },
  chest:     { label: "Pectoral", color: "#1D9E75" },
  core:      { label: "Abdomen",  color: "#639922" },
  arms:      { label: "Brazos", color: "#BA7517" },
};

// v0.9.14 — BUG I: polychrome palette per group for maximum line distinguishability.
// First color in each array is the canonical group color (matches GROUP_META above
// and muscleToGroupColor in Workouts.tsx for Feature F2 cross-feature consistency).
// Remaining colors are maximally distinct hues chosen to avoid monochromatic confusion
// when multiple muscle lines overlap in the subgroup chart.
const SUBGROUP_COLORS: Record<GroupKey, string[]> = {
  shoulders: ["#D4537E", "#88B4F0", "#FCD56C"],            // pink + sky + gold
  legs:      ["#378ADD", "#F1A93B", "#9B59B6", "#3DC494"], // blue + amber + purple + teal
  back:      ["#7F77DD", "#FFB347", "#27AE60"],            // purple + amber + emerald
  chest:     ["#1D9E75", "#E84A5F", "#FFD449"],            // green + coral + yellow
  core:      ["#639922", "#9B59B6", "#F4A261"],            // olive + purple + sandy
  arms:      ["#BA7517", "#3498DB", "#27AE60"],            // orange + sky blue + emerald
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekLabel(weekStart: string): string {
  try {
    return parseISO(weekStart).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return weekStart;
  }
}

function aggregateGroupLoad(
  byMuscle: Record<string, StrengthLog[]>,
  filterMonths: number,
): Record<string, number> {
  const cutoff = filterMonths ? subMonths(new Date(), filterMonths) : null;
  const weekLoads: Record<string, number> = {};
  for (const logs of Object.values(byMuscle)) {
    for (const log of logs) {
      if (cutoff && new Date(log.week_start) < cutoff) continue;
      weekLoads[log.week_start] =
        (weekLoads[log.week_start] ?? 0) + log.weight_kg * log.reps;
    }
  }
  return weekLoads;
}

// v0.9.15 — BUG M redesign helpers ────────────────────────────────────────────
// computeWeekStats: aggregates stats over a set of logs (typically those within
// the time filter window). Returns null when there are no logs.
function computeWeekStats(logs: StrengthLog[]) {
  if (!logs.length) return null;
  return {
    maxWeight: Math.max(...logs.map(l => l.weight_kg)),
    totalVolume: Math.round(logs.reduce((sum, l) => sum + l.weight_kg * l.reps, 0)),
    totalSets: logs.length,
    totalReps: logs.reduce((sum, l) => sum + l.reps, 0),
  };
}

// getRecentWeeklyVolume: returns last N weeks of volume (peso × reps) for a
// group's logs. Ignores filterMonths — trend is always last N weeks per spec.
function getRecentWeeklyVolume(
  byMuscle: Record<string, StrengthLog[]>,
  n: number = 6,
): { weekStart: string; volume: number }[] {
  const byWeek: Record<string, number> = {};
  for (const logs of Object.values(byMuscle)) {
    for (const log of logs) {
      byWeek[log.week_start] =
        (byWeek[log.week_start] ?? 0) + log.weight_kg * log.reps;
    }
  }
  const sortedWeeks = Object.keys(byWeek).sort();
  const lastN = sortedWeeks.slice(-n);
  return lastN.map(weekStart => ({ weekStart, volume: Math.round(byWeek[weekStart]) }));
}

// detectPR: compares latest week's max weight vs previous week's max weight
// across all logs of the group. Returns isPR=true and rounded delta when latest
// strictly exceeds previous. Defensive against single-week histories.
function detectPR(
  byMuscle: Record<string, StrengthLog[]>,
): { isPR: boolean; delta: number | null } {
  const maxByWeek: Record<string, number> = {};
  for (const logs of Object.values(byMuscle)) {
    for (const log of logs) {
      if (!maxByWeek[log.week_start] || log.weight_kg > maxByWeek[log.week_start]) {
        maxByWeek[log.week_start] = log.weight_kg;
      }
    }
  }
  const sortedWeeks = Object.keys(maxByWeek).sort();
  if (sortedWeeks.length < 2) return { isPR: false, delta: null };
  const latest = maxByWeek[sortedWeeks[sortedWeeks.length - 1]];
  const previous = maxByWeek[sortedWeeks[sortedWeeks.length - 2]];
  const delta = latest - previous;
  return { isPR: delta > 0, delta: Math.round(delta * 10) / 10 };
}

// v0.9.16 — inferSpecificMuscle: refine a primary muscle name from a generic
// category (e.g., "Pectorals", "Delts") to its specific anatomical sub-muscle
// (e.g., "Pectoral superior", "Deltoides lateral") using keywords in the
// exercise name. Mirror of the backend helper in aiGenerators.ts — keep both
// in sync when modifying regex. Frontend variant exists so legacy logs (pre-
// v0.9.16, with generic muscle_group like "Pectorales") get reclassified on
// read-time without requiring data migration.
function inferSpecificMuscle(exerciseName: string, fallback: string): string {
  const name = exerciseName.toLowerCase();
  const fb = fallback.toLowerCase();

  if (/pector|chest|pecho|pectorales|pectorals/.test(fb)) {
    if (/\bincline\b|incline.bench|inclinad|inclinada/.test(name)) return "Pectoral superior";
    if (/\bdecline\b|decline.bench|declinad/.test(name)) return "Pectoral inferior";
    return "Pectoral medio";
  }

  if (/delt|hombro|shoulder/.test(fb)) {
    if (/\brear\b|reverse|bent.over|posterior/.test(name)) return "Deltoides posterior";
    if (/\blateral\b|\bside\b|lateral raise/.test(name)) return "Deltoides lateral";
    if (/\bfront\b|front raise|overhead press|military|shoulder press/.test(name)) return "Deltoides anterior";
    return fallback;
  }

  return fallback;
}

// ─── Time Filter Pills ────────────────────────────────────────────────────────

function TimeFilterPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 shrink-0">
      {TIME_FILTERS.map(f => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
          style={
            value === f.key
              ? {
                  background: "rgba(136,238,34,0.08)",
                  border: "1px solid #88ee22",
                  color: "#88ee22",
                }
              : {
                  background: "#0a0a0a",
                  border: "1px solid #1f1f1f",
                  color: "#555",
                }
          }
        >
          {f.key}
        </button>
      ))}
    </div>
  );
}

// ─── Log Weight Bottom Sheet ──────────────────────────────────────────────────

function LogWeightSheet({ onClose }: { onClose: () => void }) {
  const logWeightMutation = useLogWeight();
  const [hideTip, setHideTip] = useState<boolean>(
    () => localStorage.getItem("hideWeightTip") === "true",
  );
  const [weightInput, setWeightInput] = useState("");
  const [dateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const toggleTip = () => {
    const next = !hideTip;
    setHideTip(next);
    localStorage.setItem("hideWeightTip", String(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!val || isNaN(val) || val < 20 || val > 400) return;
    // v0.9.17 — BUG L closure: forward the `note` field to the mutation so
    // it lands in progress_logs.notes. `condition` is currently dropped
    // (no schema column); decide whether to store it in a future iteration.
    logWeightMutation.mutate(
      { weightKg: val, notes: note.trim() || null },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => {
            setSaved(false);
            onClose();
          }, 1500);
        },
      },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="w-full bg-[#0a0a0a] border-t border-[#1f1f1f] p-6 pb-10 max-w-lg mx-auto overflow-y-auto"
        style={{ borderRadius: "20px 20px 0 0", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#2a2a2a] rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#e8e8e8]">Registrar peso</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saved ? (
          <div className="py-10 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-[#e8e8e8] font-bold text-lg">¡Guardado!</p>
          </div>
        ) : (
          <>
            {/* Tip box */}
            <div
              className="mb-5 rounded-xl p-4"
              style={{
                background: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.18)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold" style={{ color: "#60a5fa" }}>
                  ℹ️ ¿Cómo pesarte correctamente?
                </span>
                <button
                  type="button"
                  onClick={toggleTip}
                  className="text-xs font-semibold shrink-0"
                  style={{ color: "#60a5fa" }}
                >
                  {hideTip ? "Mostrar consejo ▾" : "Ocultar consejo ▴"}
                </button>
              </div>

              <AnimatePresence>
                {!hideTip && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-[#888] mt-3 mb-2">
                      Para que tus registros sean comparables, pésate siempre en
                      las mismas condiciones:
                    </p>
                    <ul className="space-y-1.5 text-xs text-[#888]">
                      <li>🌅 En ayunas nada más levantarte</li>
                      <li>🚽 Después de ir al baño</li>
                      <li>👙 Sin ropa o con ropa interior ligera</li>
                      <li>⚖️ Misma báscula, misma superficie firme</li>
                      <li>💧 Antes de beber agua o entrenar</li>
                    </ul>
                    <p className="text-[10px] text-[#555] italic mt-3 leading-relaxed">
                      El peso fluctúa 1–2 kg al día por hidratación, comida y
                      sales. Pesarte siempre igual elimina ese ruido y mide el
                      cambio real.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1.5 block">
                    Peso (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="400"
                    required
                    autoFocus
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    placeholder="75.5"
                    className="w-full bg-[#111] text-[#e8e8e8] placeholder:text-[#444] border border-[#1f1f1f] rounded-xl px-3 py-3 focus:outline-none focus:border-[#88ee22] text-base font-bold transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1.5 block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    defaultValue={dateInput}
                    className="w-full bg-[#111] text-[#e8e8e8] border border-[#1f1f1f] rounded-xl px-3 py-3 focus:outline-none focus:border-[#88ee22] text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1.5 block">
                  Condiciones (opcional)
                </label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="w-full bg-[#111] text-[#e8e8e8] border border-[#1f1f1f] rounded-xl px-4 py-3 focus:outline-none focus:border-[#88ee22] text-sm transition-colors"
                >
                  <option value="">Seleccionar...</option>
                  <option value="fasting">En ayunas recién levantado</option>
                  <option value="after_breakfast">Después de desayunar</option>
                  <option value="after_workout">Después de entrenar</option>
                  <option value="evening">Por la noche</option>
                  <option value="other">Otro momento</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1.5 block">
                  Nota (opcional)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ej. después de un día de mucho calor..."
                  rows={2}
                  className="w-full bg-[#111] text-[#e8e8e8] placeholder:text-[#444] border border-[#1f1f1f] rounded-xl px-4 py-3 focus:outline-none focus:border-[#88ee22] text-sm resize-none transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-colors"
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#888",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={logWeightMutation.isPending || !weightInput}
                  className="flex-1 py-3.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                  style={{ background: "#88ee22", color: "#0a0a0a" }}
                >
                  {logWeightMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Guardar registro"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Tab 0: Grupos Musculares — v0.9.15 professional cards redesign ──────────
// Calls all 6 group hooks unconditionally so React's rules of hooks are respected.
// Replaces the previous single-line tonnage chart (BUG M: "432 kg" confusion)
// with one card per group showing explicit KPIs + a 6-week trend mini-bar-chart.

function GroupsCardsView({ filterMonths }: { filterMonths: number }) {
  const { data: d0 } = useStrengthGroupLogs("shoulders");
  const { data: d1 } = useStrengthGroupLogs("legs");
  const { data: d2 } = useStrengthGroupLogs("back");
  const { data: d3 } = useStrengthGroupLogs("chest");
  const { data: d4 } = useStrengthGroupLogs("core");
  const { data: d5 } = useStrengthGroupLogs("arms");

  const groupsRaw: Record<GroupKey, Record<string, StrengthLog[]>> = {
    shoulders: d0?.byMuscle ?? {},
    legs:      d1?.byMuscle ?? {},
    back:      d2?.byMuscle ?? {},
    chest:     d3?.byMuscle ?? {},
    core:      d4?.byMuscle ?? {},
    arms:      d5?.byMuscle ?? {},
  };

  const { perGroup, anyDataExists, weekCount } = useMemo(() => {
    const cutoff = filterMonths ? subMonths(new Date(), filterMonths) : null;
    const perGroup = {} as Record<
      GroupKey,
      {
        stats: ReturnType<typeof computeWeekStats>;
        trend: { weekStart: string; volume: number }[];
        pr: { isPR: boolean; delta: number | null };
      }
    >;
    const weekSet = new Set<string>();
    let anyDataExists = false;

    for (const key of GROUP_KEYS) {
      const byMuscle = groupsRaw[key];

      // KPIs use filter window. Trend ALWAYS last 6 weeks (per spec decision 3/6).
      const filteredLogs: StrengthLog[] = [];
      for (const logs of Object.values(byMuscle)) {
        for (const log of logs) {
          if (cutoff && new Date(log.week_start) < cutoff) continue;
          filteredLogs.push(log);
          weekSet.add(log.week_start);
        }
      }

      const stats = computeWeekStats(filteredLogs);
      const trend = getRecentWeeklyVolume(byMuscle, 6);
      const pr = detectPR(byMuscle);

      perGroup[key] = { stats, trend, pr };
      if (stats) anyDataExists = true;
    }

    return { perGroup, anyDataExists, weekCount: weekSet.size };
  }, [d0, d1, d2, d3, d4, d5, filterMonths]);

  if (!anyDataExists) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[#555] text-sm">Aún no tienes sesiones registradas</p>
      </div>
    );
  }

  return (
    <>
      {/* v0.9.14 — BUG K indicator preserved. */}
      {filterMonths > 0 && weekCount > 0 && (
        <p className="text-[10px] text-[#555] -mt-3 mb-3">
          Mostrando {weekCount} semana{weekCount === 1 ? "" : "s"} con datos
        </p>
      )}

      {GROUP_KEYS.map(key => {
        const { stats, trend, pr } = perGroup[key];
        const color = GROUP_META[key].color;
        const label = GROUP_META[key].label;

        // Empty-state card: shown for groups with no logs in the filter window,
        // educative (lets user see all canonical groups they could be training).
        if (!stats) {
          return (
            <div
              key={key}
              style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
              className="p-4 mb-3 opacity-60"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: color, opacity: 0.3 }}
                />
                <h4 className="font-bold text-[#888] text-sm">{label}</h4>
              </div>
              <p className="text-xs text-[#666] mt-2">
                Sin sesiones registradas en este grupo
              </p>
            </div>
          );
        }

        return (
          <div
            key={key}
            style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
            className="p-4 mb-3"
          >
            {/* Header: colored dot + label + optional PR badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <h4 className="font-bold text-[#e8e8e8] text-sm">{label}</h4>
              {pr.isPR && pr.delta !== null && pr.delta > 0 && (
                <span
                  className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-md"
                  style={{
                    background: "rgba(255, 215, 0, 0.15)",
                    color: "#FFD700",
                    border: "1px solid rgba(255, 215, 0, 0.3)",
                  }}
                >
                  🏆 PR! +{pr.delta} kg
                </span>
              )}
            </div>

            {/* KPI grid: 2 cols mobile / 4 cols desktop (md breakpoint = 768px). */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Peso máx</p>
                <p className="text-base font-bold text-[#e8e8e8]">
                  {stats.maxWeight} <span className="text-[10px] text-[#888]">kg</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Volumen sem.</p>
                <p className="text-base font-bold text-[#e8e8e8]">
                  {stats.totalVolume.toLocaleString()}{" "}
                  <span className="text-[10px] text-[#888]">kg·r</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Sets</p>
                <p className="text-base font-bold text-[#e8e8e8]">{stats.totalSets}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Reps</p>
                <p className="text-base font-bold text-[#e8e8e8]">{stats.totalReps}</p>
              </div>
            </div>

            {/* Mini bar chart: ALWAYS last 6 weeks, ignores filterMonths. */}
            {trend.length > 0 && (
              <div className="h-[40px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <Bar dataKey="volume" fill={color} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function GroupsTab() {
  const [timeFilter, setTimeFilter] = useState("3M");
  const filterMonths = TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  return (
    <div className="space-y-4">
      <div
        className="p-4"
        style={{
          background: "#111",
          border: "1px solid #1f1f1f",
          borderRadius: 16,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-[#e8e8e8] text-sm">
              Carga por grupo muscular
            </h3>
            <p className="text-xs text-[#555] mt-0.5">
              Estadísticas semanales por grupo
            </p>
          </div>
          <TimeFilterPills value={timeFilter} onChange={setTimeFilter} />
        </div>
        <GroupsCardsView filterMonths={filterMonths} />
      </div>
    </div>
  );
}

// ─── Tab 1: Por Subgrupo — v0.9.16 professional cards + anatomical sub-muscles

// v0.9.16 — SubgroupCardsView: renders one card per (re-aggregated) muscle in
// the selected group. Mirrors the v0.9.15 GroupsCardsView structure but at the
// per-muscle granularity. Colors come from SUBGROUP_COLORS (polychrome palette
// from v0.9.14) so each muscle gets a distinct visual identity within the group.
function SubgroupCardsView({
  selectedGroup,
  filterMonths,
  reaggregated,
}: {
  selectedGroup: GroupKey;
  filterMonths: number;
  reaggregated: Record<string, StrengthLog[]>;
}) {
  const colors = SUBGROUP_COLORS[selectedGroup];

  const { perMuscle, anyDataExists, weekCount } = useMemo(() => {
    const cutoff = filterMonths ? subMonths(new Date(), filterMonths) : null;
    const perMuscle = {} as Record<
      string,
      {
        stats: ReturnType<typeof computeWeekStats>;
        trend: { weekStart: string; volume: number }[];
        pr: { isPR: boolean; delta: number | null };
      }
    >;
    const weekSet = new Set<string>();
    let anyDataExists = false;

    for (const [muscle, logs] of Object.entries(reaggregated)) {
      const filteredLogs: StrengthLog[] = [];
      for (const log of logs) {
        if (cutoff && new Date(log.week_start) < cutoff) continue;
        filteredLogs.push(log);
        weekSet.add(log.week_start);
      }

      const stats = computeWeekStats(filteredLogs);
      // Trend and PR use ALL logs (not filtered) per spec decision 3/6:
      // trend mini-chart always last 6 weeks regardless of filter.
      const trend = getRecentWeeklyVolume({ _: logs }, 6);
      const pr = detectPR({ _: logs });

      perMuscle[muscle] = { stats, trend, pr };
      if (stats) anyDataExists = true;
    }

    return { perMuscle, anyDataExists, weekCount: weekSet.size };
  }, [reaggregated, filterMonths]);

  if (!anyDataExists) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">🏋️</div>
        <p className="text-[#555] text-sm">Aún no tienes sesiones registradas</p>
      </div>
    );
  }

  return (
    <>
      {filterMonths > 0 && weekCount > 0 && (
        <p className="text-[10px] text-[#555] -mt-3 mb-3">
          Mostrando {weekCount} semana{weekCount === 1 ? "" : "s"} con datos
        </p>
      )}

      {Object.entries(perMuscle).map(([muscle, data], idx) => {
        const { stats, trend, pr } = data;
        const color = colors[idx % colors.length];

        if (!stats) {
          return (
            <div
              key={muscle}
              style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
              className="p-4 mb-3 opacity-60"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: color, opacity: 0.3 }}
                />
                <h4 className="font-bold text-[#888] text-sm">{muscle}</h4>
              </div>
              <p className="text-xs text-[#666] mt-2">
                Sin sesiones registradas en este músculo
              </p>
            </div>
          );
        }

        return (
          <div
            key={muscle}
            style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
            className="p-4 mb-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <h4 className="font-bold text-[#e8e8e8] text-sm">{muscle}</h4>
              {pr.isPR && pr.delta !== null && pr.delta > 0 && (
                <span
                  className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-md"
                  style={{
                    background: "rgba(255, 215, 0, 0.15)",
                    color: "#FFD700",
                    border: "1px solid rgba(255, 215, 0, 0.3)",
                  }}
                >
                  🏆 PR! +{pr.delta} kg
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Peso máx</p>
                <p className="text-base font-bold text-[#e8e8e8]">
                  {stats.maxWeight} <span className="text-[10px] text-[#888]">kg</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Volumen sem.</p>
                <p className="text-base font-bold text-[#e8e8e8]">
                  {stats.totalVolume.toLocaleString()}{" "}
                  <span className="text-[10px] text-[#888]">kg·r</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Sets</p>
                <p className="text-base font-bold text-[#e8e8e8]">{stats.totalSets}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Reps</p>
                <p className="text-base font-bold text-[#e8e8e8]">{stats.totalReps}</p>
              </div>
            </div>

            {trend.length > 0 && (
              <div className="h-[40px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <Bar dataKey="volume" fill={color} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function SubgroupTab() {
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>("shoulders");
  const [timeFilter, setTimeFilter] = useState("3M");

  const { data: groupData } = useStrengthGroupLogs(selectedGroup);
  const byMuscle = groupData?.byMuscle ?? {};
  const filterMonths = TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  // v0.9.16: re-aggregate by anatomical sub-muscle. Logs with the same generic
  // muscle_group (e.g., "Pectorals") get split into specific sub-muscles based
  // on exercise name keywords (e.g., "Incline Bench Press" → "Pectoral superior").
  // Backward compatible — old logs (pre-v0.9.16, with generic muscle_group)
  // are reclassified on-the-fly. Logs generated post-v0.9.16 by the backend
  // pipeline already have the specific muscle_group and pass through unchanged.
  const reaggregated = useMemo(() => {
    const result: Record<string, StrengthLog[]> = {};
    for (const logs of Object.values(byMuscle)) {
      for (const log of logs) {
        const specific = inferSpecificMuscle(log.exercise_name, log.muscle_group);
        if (!result[specific]) result[specific] = [];
        result[specific].push(log);
      }
    }
    return result;
  }, [byMuscle]);

  return (
    <div className="space-y-4">
      {/* Group selector */}
      <select
        value={selectedGroup}
        onChange={e => setSelectedGroup(e.target.value as GroupKey)}
        className="w-full text-[#e8e8e8] border rounded-xl px-4 py-3 focus:outline-none text-sm font-semibold"
        style={{
          background: "#111",
          borderColor: "#1f1f1f",
        }}
      >
        {GROUP_KEYS.map(key => (
          <option key={key} value={key} style={{ background: "#111" }}>
            {GROUP_META[key].label}
          </option>
        ))}
      </select>

      {/* Cards container */}
      <div
        className="p-4"
        style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-[#e8e8e8] text-sm">
              {GROUP_META[selectedGroup].label} — subgrupos
            </h3>
            <p className="text-xs text-[#555] mt-0.5">
              Estadísticas semanales por músculo
            </p>
          </div>
          <TimeFilterPills value={timeFilter} onChange={setTimeFilter} />
        </div>

        <SubgroupCardsView
          selectedGroup={selectedGroup}
          filterMonths={filterMonths}
          reaggregated={reaggregated}
        />
      </div>
    </div>
  );
}

// ─── Tab 2: Peso Corporal ─────────────────────────────────────────────────────

function WeightTab({ stats, onLogClick }: { stats: any; onLogClick: () => void }) {
  const [timeFilter, setTimeFilter] = useState("3M");

  const currentWeight: number | null = stats?.currentWeightKg ?? null;
  const startWeight: number | null = stats?.startWeightKg ?? null;
  const targetWeight: number | null = stats?.targetWeightKg ?? null;

  const weightDelta =
    currentWeight != null && startWeight != null
      ? +(currentWeight - startWeight).toFixed(1)
      : null;
  const deltaPercent =
    weightDelta != null && startWeight != null && startWeight !== 0
      ? +((weightDelta / startWeight) * 100).toFixed(1)
      : null;

  const goalIsLoss =
    targetWeight != null && startWeight != null && targetWeight < startWeight;
  const goalIsGain =
    targetWeight != null && startWeight != null && targetWeight > startWeight;
  const movingTowardGoal =
    (goalIsLoss && (weightDelta ?? 0) < 0) ||
    (goalIsGain && (weightDelta ?? 0) > 0);

  const varColor =
    weightDelta == null || weightDelta === 0
      ? "#555"
      : targetWeight == null
      ? "#888"
      : movingTowardGoal
      ? "#1D9E75"
      : "#ff4444";

  const toGoal =
    currentWeight != null && targetWeight != null
      ? +Math.abs(currentWeight - targetWeight).toFixed(1)
      : null;

  const progressPct = useMemo(() => {
    if (startWeight == null || targetWeight == null || currentWeight == null)
      return null;
    const num = startWeight - currentWeight;
    const den = startWeight - targetWeight;
    if (den === 0) return 100;
    return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
  }, [startWeight, targetWeight, currentWeight]);

  const filterMonths = TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  const allChartData = (stats?.weightHistory ?? []).map((d: any) => ({
    ...d,
    label: parseISO(d.date).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    }),
  }));

  const chartData: any[] = filterMonths
    ? allChartData.filter(
        (d: any) => parseISO(d.date) >= subMonths(new Date(), filterMonths),
      )
    : allChartData;

  const firstDate =
    (stats?.weightHistory?.length ?? 0) > 0
      ? parseISO(stats.weightHistory[0].date).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  // Compute Y-axis domain
  const weightValues: number[] = chartData
    .map((d: any) => d.weightKg)
    .filter((v: any) => v != null);
  const dataMin =
    weightValues.length > 0 ? Math.min(...weightValues) : (currentWeight ?? 60);
  const dataMax =
    weightValues.length > 0 ? Math.max(...weightValues) : (currentWeight ?? 80);
  const yMin = Math.floor(
    Math.min(
      targetWeight != null ? targetWeight - 2 : dataMin - 5,
      dataMin - 2,
    ),
  );
  const yMax = Math.ceil(
    Math.max(
      startWeight != null ? startWeight + 2 : dataMax + 2,
      dataMax + 2,
    ),
  );

  const hasTarget = targetWeight != null;

  return (
    <div className="space-y-4">
      {/* Stats grid: 4 cols with target, 3 without */}
      <div
        className={`grid gap-2 ${hasTarget ? "grid-cols-4" : "grid-cols-3"}`}
      >
        {/* Peso inicial */}
        <div
          className="p-3"
          style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
        >
          <p className="text-[9px] font-bold text-[#555] uppercase tracking-wide mb-1.5">
            Peso inicial
          </p>
          <p className="text-lg font-black text-[#e8e8e8] leading-none">
            {startWeight ?? "—"}
            <span className="text-[10px] font-normal text-[#555] ml-0.5">kg</span>
          </p>
          <p className="text-[9px] text-[#555] mt-1 leading-tight">{firstDate}</p>
        </div>

        {/* Peso actual */}
        <div
          className="p-3"
          style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
        >
          <p className="text-[9px] font-bold text-[#555] uppercase tracking-wide mb-1.5">
            Peso actual
          </p>
          <p className="text-lg font-black text-[#e8e8e8] leading-none">
            {currentWeight ?? "—"}
            <span className="text-[10px] font-normal text-[#555] ml-0.5">kg</span>
          </p>
          <p className="text-[9px] text-[#555] mt-1">Hoy</p>
        </div>

        {/* Variación */}
        <div
          className="p-3"
          style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
        >
          <p className="text-[9px] font-bold text-[#555] uppercase tracking-wide mb-1.5">
            Variación
          </p>
          <p className="text-lg font-black leading-none" style={{ color: varColor }}>
            {weightDelta != null ? `${weightDelta > 0 ? "+" : ""}${weightDelta}` : "—"}
            <span className="text-[10px] font-normal ml-0.5">kg</span>
          </p>
          {deltaPercent != null && (
            <p className="text-[9px] mt-1" style={{ color: varColor }}>
              {deltaPercent > 0 ? "+" : ""}
              {deltaPercent}%{" "}
              {movingTowardGoal
                ? goalIsLoss
                  ? "En camino ↓"
                  : "En camino ↑"
                : weightDelta !== 0 && targetWeight != null
                ? "↑"
                : ""}
            </p>
          )}
        </div>

        {/* Objetivo */}
        {hasTarget && (
          <div
            className="p-3"
            style={{
              background: "rgba(29,158,117,0.08)",
              border: "1px solid rgba(29,158,117,0.3)",
              borderRadius: 16,
            }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-wide mb-1.5"
              style={{ color: "#1D9E75" }}
            >
              Objetivo
            </p>
            <p className="text-lg font-black leading-none" style={{ color: "#1D9E75" }}>
              {targetWeight}
              <span className="text-[10px] font-normal ml-0.5">kg</span>
            </p>
            {toGoal !== null && (
              <p className="text-[9px] mt-1" style={{ color: "#1D9E75" }}>
                {toGoal === 0 ? "¡Meta! 🎉" : `Faltan ${toGoal} kg`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progressPct != null && (
        <div
          className="p-4"
          style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#555] uppercase tracking-wide">
              Progreso hacia el objetivo
            </p>
            <span className="text-sm font-black" style={{ color: "#1D9E75" }}>
              {progressPct}%
            </span>
          </div>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 8, background: "rgba(128,128,128,0.15)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #1D9E75, #88ee22)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[#555]">{startWeight} kg</span>
            <span className="text-[10px] text-[#555]">🎯 {targetWeight} kg</span>
          </div>
        </div>
      )}

      {/* Time filter */}
      <TimeFilterPills value={timeFilter} onChange={setTimeFilter} />

      {/* Weight chart */}
      <div
        className="p-4"
        style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <h3 className="font-bold text-[#e8e8e8] text-sm">Evolución del peso</h3>
          {currentWeight != null && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}
            >
              <span>{currentWeight} kg</span>
              <span className="text-[9px] opacity-70 ml-0.5">hoy</span>
            </div>
          )}
        </div>

        {chartData.length >= 2 ? (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, bottom: 5, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#1f1f1f"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#555", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#555", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #1f1f1f",
                      backgroundColor: "#111",
                      padding: "8px 12px",
                    }}
                    itemStyle={{ color: "#378ADD", fontWeight: 700 }}
                    labelStyle={{ color: "#888", fontSize: 12 }}
                  />
                  {targetWeight && (
                    <ReferenceLine
                      y={targetWeight}
                      stroke="rgba(29,158,117,0.6)"
                      strokeDasharray="6 4"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="weightKg"
                    name="Peso registrado"
                    stroke="#378ADD"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#0a0a0a", stroke: "#378ADD", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#378ADD" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart legend */}
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="rounded-full"
                  style={{ width: 16, height: 2, background: "#378ADD" }}
                />
                <span className="text-[10px] text-[#555]">Peso registrado</span>
              </div>
              {targetWeight && (
                <div className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: 16,
                      height: 2,
                      background:
                        "repeating-linear-gradient(90deg,rgba(29,158,117,0.6) 0,rgba(29,158,117,0.6) 4px,transparent 4px,transparent 8px)",
                    }}
                  />
                  <span className="text-[10px] text-[#555]">
                    Objetivo ({targetWeight} kg)
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-[180px] flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[#888] text-sm font-medium">No hay suficientes datos</p>
            <p className="text-[#555] text-xs mt-1">
              Registra tu peso para ver la evolución
            </p>
          </div>
        )}
      </div>

      {/* v0.9.17 — BUG L closure: weight entries history list with notes.
          Last 8 entries reversed (newest first). Delta shown vs previous
          chronological entry. Notes rendered italic + quoted only when present. */}
      {stats?.weightHistory && stats.weightHistory.length > 0 && (
        <div
          className="p-4"
          style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16 }}
        >
          <h3 className="font-bold text-[#e8e8e8] text-sm mb-4">Historial reciente</h3>
          <div className="space-y-3">
            {(stats.weightHistory as { date: string; weightKg: number; notes: string | null }[])
              .slice(-8)
              .reverse()
              .map((entry, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev
                ? +(entry.weightKg - prev.weightKg).toFixed(1)
                : null;
              const dateFormat = parseISO(entry.date).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  key={entry.date}
                  className="border-b border-[#1f1f1f] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-[#888]">{dateFormat}</span>
                    <span className="text-sm font-bold text-[#e8e8e8]">
                      {entry.weightKg}
                      <span className="text-[10px] text-[#555] ml-1">kg</span>
                    </span>
                    {delta !== null && delta !== 0 && (
                      <span
                        className={`text-xs ${
                          delta > 0 ? "text-[#FF8B6B]" : "text-[#1D9E75]"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}{delta} kg
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-[#888] mt-1 italic">
                      "{entry.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log CTA */}
      <button
        type="button"
        onClick={onLogClick}
        className="w-full py-4 rounded-xl font-black text-[#0a0a0a] text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        style={{ background: "#88ee22" }}
      >
        ⚖️ Registrar peso de hoy
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TAB_LABELS = ["Grupos musculares", "Por subgrupo", "Peso corporal"];

function ProgressContent() {
  const { data: stats, isLoading } = useProgressStats();
  const [activeTab, setActiveTab] = useState(0);
  const [showLogSheet, setShowLogSheet] = useState(false);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#88ee22]" />
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1
          className="text-[#e8e8e8] uppercase"
          style={{ fontSize: 22, fontWeight: 800 }}
        >
          📈 Progreso
        </h1>
        <ShareProgressButton variant="compact" />
      </div>

      {/* Tab bar */}
      <div
        className="flex -mx-3 px-3 overflow-x-auto scrollbar-hide mb-5"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveTab(i)}
            className="relative shrink-0 mr-5 pb-3 text-sm font-bold transition-colors whitespace-nowrap"
            style={{ color: activeTab === i ? "#e8e8e8" : "#555" }}
          >
            {label}
            {activeTab === i && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 rounded-full"
                style={{ height: 2, background: "#88ee22" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 0 && <GroupsTab />}
          {activeTab === 1 && <SubgroupTab />}
          {activeTab === 2 && (
            <WeightTab stats={stats} onLogClick={() => setShowLogSheet(true)} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Log weight bottom sheet */}
      <AnimatePresence>
        {showLogSheet && (
          <LogWeightSheet onClose={() => setShowLogSheet(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Progress() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_progress")} pageEmoji="📈">
      <ProgressContent />
    </TrialGate>
  );
}
