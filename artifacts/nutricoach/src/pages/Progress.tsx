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
  arms:      { label: "Trapecio", color: "#BA7517" },
};

const SUBGROUP_COLORS: Record<GroupKey, string[]> = {
  shoulders: ["#D4537E", "#e87da0", "#f2a8be"],
  legs:      ["#378ADD", "#5fa3e8", "#87c0f0", "#b0d9f8"],
  back:      ["#7F77DD", "#a09ae8", "#bfbbf2"],
  chest:     ["#1D9E75", "#3dc494", "#6dd9b3"],
  core:      ["#639922", "#87cc2e", "#aae062"],
  arms:      ["#BA7517", "#d99033", "#edb860"],
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
    logWeightMutation.mutate(val, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          onClose();
        }, 1500);
      },
    });
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

// ─── Tab 0: Grupos Musculares ─────────────────────────────────────────────────
// Calls all 6 group hooks unconditionally so React's rules of hooks are respected.

function GroupsChartInner({ filterMonths }: { filterMonths: number }) {
  const { data: d0 } = useStrengthGroupLogs("shoulders");
  const { data: d1 } = useStrengthGroupLogs("legs");
  const { data: d2 } = useStrengthGroupLogs("back");
  const { data: d3 } = useStrengthGroupLogs("chest");
  const { data: d4 } = useStrengthGroupLogs("core");
  const { data: d5 } = useStrengthGroupLogs("arms");

  const { chartData, hasAnyData } = useMemo(() => {
    const groupLoads: Record<GroupKey, Record<string, number>> = {
      shoulders: aggregateGroupLoad(d0?.byMuscle ?? {}, filterMonths),
      legs:      aggregateGroupLoad(d1?.byMuscle ?? {}, filterMonths),
      back:      aggregateGroupLoad(d2?.byMuscle ?? {}, filterMonths),
      chest:     aggregateGroupLoad(d3?.byMuscle ?? {}, filterMonths),
      core:      aggregateGroupLoad(d4?.byMuscle ?? {}, filterMonths),
      arms:      aggregateGroupLoad(d5?.byMuscle ?? {}, filterMonths),
    };

    const weekSet = new Set<string>();
    for (const loads of Object.values(groupLoads)) {
      for (const week of Object.keys(loads)) weekSet.add(week);
    }
    const allWeeks = Array.from(weekSet).sort();

    const chartData = allWeeks.map(week => {
      const point: Record<string, any> = { week, label: formatWeekLabel(week) };
      for (const key of GROUP_KEYS) {
        point[key] = groupLoads[key][week] ?? null;
      }
      return point;
    });

    return { chartData, hasAnyData: allWeeks.length > 0 };
  }, [d0, d1, d2, d3, d4, d5, filterMonths]);

  if (!hasAnyData) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[#555] text-sm">Aún no tienes sesiones registradas</p>
      </div>
    );
  }

  const activeKeys = GROUP_KEYS.filter(key => chartData.some(d => d[key] != null));

  return (
    <>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
        {activeKeys.map(key => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-5 rounded-full"
              style={{ height: 2, backgroundColor: GROUP_META[key].color }}
            />
            <span className="text-xs text-[#888]">{GROUP_META[key].label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 18, right: 12, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#555", fontSize: 11 }}
              dy={8}
            />
            <YAxis
              domain={["auto", "auto"]}
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
              labelStyle={{ color: "#888", fontSize: 12 }}
              formatter={(val: number, name: string) => [
                `${Math.round(val)} kg`,
                GROUP_META[name as GroupKey]?.label ?? name,
              ]}
            />
            {GROUP_KEYS.map(key => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={GROUP_META[key].color}
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 4, fill: "#0a0a0a", stroke: GROUP_META[key].color, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: GROUP_META[key].color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
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
              Carga total levantada por sesión (kg)
            </p>
          </div>
          <TimeFilterPills value={timeFilter} onChange={setTimeFilter} />
        </div>
        <GroupsChartInner filterMonths={filterMonths} />
      </div>
    </div>
  );
}

// ─── Tab 1: Por Subgrupo ──────────────────────────────────────────────────────

function SubgroupTab() {
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>("shoulders");
  const [timeFilter, setTimeFilter] = useState("3M");

  const { data: groupData } = useStrengthGroupLogs(selectedGroup);
  const byMuscle = groupData?.byMuscle ?? {};
  const muscles = groupData?.muscles ?? [];
  const colors = SUBGROUP_COLORS[selectedGroup];
  const filterMonths = TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  const { chartData, allWeeks } = useMemo(() => {
    const cutoff = filterMonths ? subMonths(new Date(), filterMonths) : null;
    const weekSet = new Set<string>();
    for (const logs of Object.values(byMuscle)) {
      for (const log of logs) {
        if (cutoff && new Date(log.week_start) < cutoff) continue;
        weekSet.add(log.week_start);
      }
    }
    const allWeeks = Array.from(weekSet).sort();
    const chartData = allWeeks.map(week => {
      const point: Record<string, any> = { week, label: formatWeekLabel(week) };
      for (const muscle of muscles) {
        const logsForWeek = (byMuscle[muscle] ?? []).filter(
          l => l.week_start === week,
        );
        point[muscle] =
          logsForWeek.length > 0
            ? Math.max(...logsForWeek.map(l => l.weight_kg))
            : null;
      }
      return point;
    });
    return { chartData, allWeeks };
  }, [groupData, filterMonths]);

  const hasData = muscles.length > 0 && allWeeks.length > 0;

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

      {/* Chart card */}
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
              Carga por músculo específico (kg)
            </p>
          </div>
          <TimeFilterPills value={timeFilter} onChange={setTimeFilter} />
        </div>

        {!hasData ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">🏋️</div>
            <p className="text-[#555] text-sm">Aún no tienes sesiones registradas</p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
              {muscles.map((muscle, i) => (
                <div key={muscle} className="flex items-center gap-1.5">
                  <div
                    className="w-5 rounded-full"
                    style={{ height: 2, backgroundColor: colors[i % colors.length] }}
                  />
                  <span className="text-xs text-[#888]">{muscle}</span>
                </div>
              ))}
            </div>

            {allWeeks.length >= 2 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 18, right: 12, bottom: 5, left: -20 }}
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
                      domain={["auto", "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#555", fontSize: 11 }}
                      unit="kg"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "1px solid #1f1f1f",
                        backgroundColor: "#111",
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#888", fontSize: 12 }}
                      formatter={(val: number, name: string) => [`${val} kg`, name]}
                    />
                    {muscles.map((muscle, i) => (
                      <Line
                        key={muscle}
                        type="monotone"
                        dataKey={muscle}
                        name={muscle}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2.5}
                        connectNulls={false}
                        dot={{
                          r: 4,
                          fill: "#0a0a0a",
                          stroke: colors[i % colors.length],
                          strokeWidth: 2,
                        }}
                        activeDot={{ r: 6, fill: colors[i % colors.length] }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center">
                <p className="text-sm text-[#555]">
                  Registra más sesiones para ver la gráfica
                </p>
              </div>
            )}
          </>
        )}
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
