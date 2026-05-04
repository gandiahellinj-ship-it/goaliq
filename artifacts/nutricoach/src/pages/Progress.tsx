import { useState, useMemo } from "react";
import { useProgressStats, useLogWeight, useStrengthGroups, useStrengthGroupLogs } from "@/lib/supabase-queries";
import type { StrengthLog } from "@/lib/supabase-queries";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { parseISO, subMonths } from "date-fns";
import { Loader2, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TrialGate } from "@/components/TrialGate";
import { ShareProgressButton } from "@/components/ShareProgressCard";
import { useT } from "@/lib/language";
import { useThemeAccent } from "@/lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "1A", months: 12 },
  { key: "Todo", months: 0 },
] as const;

const ALL_GROUPS: { key: string; tKey: string; emoji: string; color: string }[] = [
  { key: "legs",      tKey: "muscle_group_legs",      emoji: "🦵", color: "#378ADD" },
  { key: "back",      tKey: "muscle_group_back",       emoji: "🔙", color: "#7F77DD" },
  { key: "shoulders", tKey: "muscle_group_shoulders",  emoji: "💪", color: "#D4537E" },
  { key: "chest",     tKey: "muscle_group_chest",      emoji: "🫁", color: "#1D9E75" },
  { key: "arms",      tKey: "muscle_group_arms",       emoji: "💪", color: "#FFB347" },
  { key: "core",      tKey: "muscle_group_core",       emoji: "🎯", color: "#639922" },
];

const MUSCLE_COLORS = ["#D4537E", "#378ADD", "#BA7517", "#639922", "#7F77DD", "#1D9E75", "#FFB347"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMultiLineData(
  byMuscle: Record<string, StrengthLog[]>,
  muscles: string[],
  filterMonths?: number,
): { chartData: Record<string, any>[]; allWeeks: string[] } {
  const cutoff = filterMonths ? subMonths(new Date(), filterMonths) : null;

  const weekSet = new Set<string>();
  for (const logs of Object.values(byMuscle)) {
    for (const log of logs) {
      if (cutoff && new Date(log.week_start) < cutoff) continue;
      weekSet.add(log.week_start);
    }
  }
  const allWeeks = Array.from(weekSet).sort();

  const chartData = allWeeks.map((week, i) => {
    const point: Record<string, any> = { week, label: `S${i + 1}` };
    for (const muscle of muscles) {
      const logsForWeek = (byMuscle[muscle] ?? []).filter(l => l.week_start === week);
      if (logsForWeek.length > 0) {
        const maxKg = Math.max(...logsForWeek.map(l => l.weight_kg));
        const maxLog = logsForWeek.find(l => l.weight_kg === maxKg)!;
        point[muscle] = maxKg;
        point[`${muscle}_reps`] = maxLog.reps;
      } else {
        point[muscle] = null;
      }
    }
    return point;
  });

  return { chartData, allWeeks };
}

// ─── Quick Stats Strip ────────────────────────────────────────────────────────

function QuickStatsStrip({ stats }: { stats: any }) {
  const t = useT();

  const currentWeight = stats?.currentWeightKg ?? null;
  const startWeight = stats?.startWeightKg ?? null;
  const weightDelta =
    currentWeight != null && startWeight != null
      ? +(currentWeight - startWeight).toFixed(1)
      : null;
  const isLoss = (weightDelta ?? 0) < 0;

  const chips = [
    {
      emoji: "🔥",
      label: t("streak_label") || "Racha",
      value: stats?.streak ? `${stats.streak}d` : "—",
      color: stats?.streak ? "#FFB347" : "#555",
    },
    {
      emoji: "📅",
      label: t("last_workout_label") || "Último",
      value: stats?.todayWorkoutDone
        ? t("today") || "Hoy"
        : stats?.completedWorkoutsThisWeek > 0
        ? t("this_week_short") || "Esta semana"
        : "—",
      color: stats?.todayWorkoutDone ? "#88ee22" : "#888",
    },
    {
      emoji: "⚖️",
      label: t("weight_delta_label") || "Peso",
      value:
        weightDelta != null
          ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg`
          : "—",
      color: weightDelta != null ? (isLoss ? "#88ee22" : "#FF6B6B") : "#555",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {chips.map(chip => (
        <div
          key={chip.label}
          className="bg-[#111] border border-[#1f1f1f] rounded-xl p-3 flex flex-col gap-0.5"
        >
          <span className="text-[10px] text-[#555] uppercase font-bold tracking-wider">
            {chip.emoji} {chip.label}
          </span>
          <span className="text-sm font-bold" style={{ color: chip.color }}>
            {chip.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 0: General ───────────────────────────────────────────────────────────

function GeneralTab({ stats }: { stats: any }) {
  const t = useT();
  const { data: groupsWithData = [] } = useStrengthGroups();

  const completed = stats?.completedWorkoutsThisWeek ?? 0;
  const total = stats?.totalWorkoutsThisWeek ?? 0;
  const adherence = stats?.weeklyAdherencePercent ?? 0;

  return (
    <div className="space-y-4">
      {/* Weekly adherence */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
        <p className="text-xs font-bold text-[#555] uppercase tracking-wide mb-3">
          {t("workouts_done_label")}
        </p>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">{completed}</span>
            <span className="text-[#555] font-medium text-sm">
              / {total} {t("this_week_short")}
            </span>
          </div>
          <span
            className="text-2xl font-black"
            style={{
              color:
                adherence >= 80 ? "#88ee22" : adherence >= 50 ? "#FFB347" : "#555",
            }}
          >
            {adherence}%
          </span>
        </div>
        <div className="h-2 bg-[#1f1f1f] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:
                total > 0 ? `${Math.min((completed / total) * 100, 100)}%` : "0%",
              background:
                adherence >= 80 ? "#88ee22" : adherence >= 50 ? "#FFB347" : "#555",
            }}
          />
        </div>
        <p className="text-xs text-[#555] mt-2">
          {adherence >= 80
            ? t("adherence_excellent")
            : adherence >= 50
            ? t("adherence_good_progress")
            : t("every_workout_counts")}
        </p>
      </div>

      {/* Muscle groups overview */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
        <p className="text-xs font-bold text-[#555] uppercase tracking-wide mb-4">
          💪 {t("strength_progress")}
        </p>
        <div className="space-y-3">
          {ALL_GROUPS.map(group => {
            const hasData = groupsWithData.includes(group.key);
            return (
              <div key={group.key} className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: hasData ? group.color : "#2a2a2a" }}
                />
                <span
                  className="text-sm font-semibold flex-1"
                  style={{ color: hasData ? "#fff" : "#444" }}
                >
                  {group.emoji} {t(group.tKey)}
                </span>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ width: 64, background: "#1f1f1f" }}
                >
                  {hasData && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: "100%", backgroundColor: group.color, opacity: 0.5 }}
                    />
                  )}
                </div>
                <span
                  className="text-xs font-bold w-4 text-right"
                  style={{ color: hasData ? group.color : "#333" }}
                >
                  {hasData ? "✓" : "—"}
                </span>
              </div>
            );
          })}
        </div>
        {groupsWithData.length === 0 && (
          <p className="text-xs text-[#555] mt-4 text-center">
            {t("no_strength_data")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Por músculo ───────────────────────────────────────────────────────

function MuscleTab() {
  const t = useT();
  const { data: groupsWithData = [] } = useStrengthGroups();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>("3M");

  const selectedGroup = activeGroup ?? (groupsWithData[0] ?? ALL_GROUPS[0].key);
  const { data: groupData } = useStrengthGroupLogs(selectedGroup);
  const byMuscle = groupData?.byMuscle ?? {};
  const muscles = groupData?.muscles ?? [];

  const filterMonths =
    TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  const { chartData, allWeeks } = useMemo(
    () => buildMultiLineData(byMuscle, muscles, filterMonths || undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupData, filterMonths],
  );

  const muscleMaxMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const muscle of muscles) {
      const allKg = (byMuscle[muscle] ?? []).map(l => l.weight_kg);
      map[muscle] = allKg.length > 0 ? Math.max(...allKg) : 0;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupData]);

  const hasData = muscles.length > 0 && allWeeks.length > 0;
  const hasEnoughData = hasData && allWeeks.length >= 2;

  return (
    <div className="space-y-4">
      {/* Group selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {ALL_GROUPS.map(({ key, tKey, color }) => {
          const isActive = key === selectedGroup;
          const hasGroupData = groupsWithData.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveGroup(key)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={
                isActive
                  ? { backgroundColor: `${color}22`, border: `1.5px solid ${color}`, color }
                  : hasGroupData
                  ? { backgroundColor: "#111", border: "1.5px solid #1f1f1f", color: "#888" }
                  : { backgroundColor: "transparent", border: "1.5px solid #222", color: "#444", opacity: 0.5 }
              }
            >
              {t(tKey)}
            </button>
          );
        })}
      </div>

      {/* Time filter */}
      <div className="flex gap-1.5">
        {TIME_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTimeFilter(f.key)}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
            style={
              timeFilter === f.key
                ? { background: "#88ee22", color: "#0a0a0a" }
                : { background: "#111", border: "1px solid #1f1f1f", color: "#555" }
            }
          >
            {f.key}
          </button>
        ))}
      </div>

      {/* Chart card */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
        {!hasData ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-3">🏋️</div>
            <p className="text-sm text-[#555]">{t("no_strength_data")}</p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {muscles.map((muscle, i) => (
                <div key={muscle} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }}
                  />
                  <span className="text-xs text-[#888]">{muscle}</span>
                </div>
              ))}
            </div>

            {hasEnoughData ? (
              <div className="h-[220px] w-full mb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 18, right: 16, bottom: 5, left: -20 }}>
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
                      unit="kg"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #1f1f1f",
                        backgroundColor: "#111",
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#888", fontSize: 12 }}
                      formatter={(val: number, name: string, props: any) => {
                        const reps = props.payload[`${name}_reps`];
                        return [`${val}kg${reps ? ` × ${reps}` : ""}`, name];
                      }}
                    />
                    {muscles.map((muscle, i) => {
                      const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
                      const muscleMax = muscleMaxMap[muscle] ?? 0;
                      return (
                        <Line
                          key={muscle}
                          type="monotone"
                          dataKey={muscle}
                          name={muscle}
                          stroke={color}
                          strokeWidth={2}
                          connectNulls={false}
                          dot={(props: any) => {
                            if (props.payload[muscle] == null) return <g key={props.key} />;
                            const isPR =
                              props.payload[muscle] === muscleMax && muscleMax > 0;
                            return (
                              <g key={props.key}>
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={isPR ? 5 : 3.5}
                                  fill={isPR ? color : "#0a0a0a"}
                                  stroke={color}
                                  strokeWidth={2}
                                />
                                {isPR && (
                                  <text
                                    x={props.cx}
                                    y={props.cy - 9}
                                    textAnchor="middle"
                                    fill="#FFB800"
                                    fontSize={8}
                                    fontWeight="bold"
                                  >
                                    PR
                                  </text>
                                )}
                              </g>
                            );
                          }}
                          activeDot={{ r: 6, fill: color }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center mb-4">
                <p className="text-sm text-[#555]">{t("log_to_see_trend")}</p>
              </div>
            )}

            {/* PR records per muscle */}
            <div className="space-y-4">
              {muscles.map((muscle, i) => {
                const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
                const muscleLogs = [...(byMuscle[muscle] ?? [])].reverse().slice(0, 3);
                const muscleMax = muscleMaxMap[muscle] ?? 0;
                return (
                  <div key={muscle}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-bold text-white">{muscle}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color }}>
                        {muscleMax > 0 ? `${muscleMax}kg max` : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 pl-3">
                      {muscleLogs.map((log, j) => {
                        const pct =
                          muscleMax > 0
                            ? Math.round((log.weight_kg / muscleMax) * 100)
                            : 100;
                        const isPR = log.weight_kg === muscleMax;
                        const dateLabel = new Date(
                          log.logged_at + "T00:00:00",
                        ).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        });
                        return (
                          <div key={log.id ?? j} className="flex items-center gap-3">
                            <span className="text-[10px] w-12 shrink-0 text-[#555]">
                              {dateLabel}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-semibold text-white">
                                  {log.weight_kg}kg × {log.reps}
                                </span>
                                {isPR && (
                                  <span
                                    className="text-[8px] font-bold px-1 py-0.5 rounded"
                                    style={{
                                      background: "rgba(255,184,0,0.15)",
                                      color: "#FFB800",
                                    }}
                                  >
                                    PR
                                  </span>
                                )}
                              </div>
                              <div className="h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: isPR ? "#FFB800" : color,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Log Weight Bottom Sheet ──────────────────────────────────────────────────

function LogWeightSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const logWeightMutation = useLogWeight();
  const [weightInput, setWeightInput] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const handleLog = (e: React.FormEvent) => {
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
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full bg-[#0a0a0a] border-t border-[#1f1f1f] rounded-t-2xl p-6 pb-10 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-[#333] rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">{t("log_today_weight")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1f1f1f] text-[#888] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saved ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-white font-bold">{t("saved")}</p>
          </div>
        ) : (
          <form onSubmit={handleLog} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#555] uppercase tracking-wide mb-2 block">
                {t("current_weight")} (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="400"
                autoFocus
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder={t("eg_weight")}
                className="w-full bg-[#111] text-white placeholder:text-[#444] border border-[#1f1f1f] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#88ee22] text-lg font-bold transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#555] uppercase tracking-wide mb-2 block">
                Nota (opcional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ej. después de entrenar, en ayunas..."
                rows={2}
                className="w-full bg-[#111] text-white placeholder:text-[#444] border border-[#1f1f1f] rounded-xl px-4 py-3 focus:outline-none focus:border-[#88ee22] text-sm resize-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={logWeightMutation.isPending || !weightInput}
              className="w-full py-4 bg-[#88ee22] text-[#0a0a0a] font-black rounded-xl hover:bg-[#99ff33] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {logWeightMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Registrar peso
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Tab 2: Peso ──────────────────────────────────────────────────────────────

function WeightTab({ stats, onLogClick }: { stats: any; onLogClick: () => void }) {
  const t = useT();
  const accentColor = useThemeAccent();
  const [timeFilter, setTimeFilter] = useState("3M");

  const currentWeight: number | null = stats?.currentWeightKg ?? null;
  const startWeight: number | null = stats?.startWeightKg ?? null;
  const targetWeight: number | null = stats?.targetWeightKg ?? null;

  const weightDelta =
    currentWeight != null && startWeight != null
      ? +(currentWeight - startWeight).toFixed(1)
      : null;
  const isLoss = (weightDelta ?? 0) < 0;
  const isGain = (weightDelta ?? 0) > 0;

  const toGoal =
    currentWeight != null && targetWeight != null
      ? +Math.abs(currentWeight - targetWeight).toFixed(1)
      : null;

  const progressPct = useMemo(() => {
    if (startWeight == null || targetWeight == null || currentWeight == null) return null;
    const range = Math.abs(targetWeight - startWeight);
    if (range === 0) return 100;
    const done = Math.abs(currentWeight - startWeight);
    return Math.min(Math.round((done / range) * 100), 100);
  }, [startWeight, targetWeight, currentWeight]);

  const filterMonths = TIME_FILTERS.find(f => f.key === timeFilter)?.months ?? 0;

  const allChartData = (stats?.weightHistory ?? []).map((d: any) => ({
    ...d,
    label: parseISO(d.date).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    }),
  }));

  const chartData = filterMonths
    ? allChartData.filter((d: any) => parseISO(d.date) >= subMonths(new Date(), filterMonths))
    : allChartData;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1">
            {t("current_weight")}
          </p>
          {currentWeight != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{currentWeight}</span>
                <span className="text-[#555] text-sm">kg</span>
              </div>
              {weightDelta != null && weightDelta !== 0 && (
                <p
                  className="text-xs font-semibold mt-1"
                  style={{ color: isLoss ? "#88ee22" : isGain ? "#FF6B6B" : "#888" }}
                >
                  {isGain ? "+" : ""}
                  {weightDelta} kg {t("from_start")}
                </p>
              )}
            </>
          ) : (
            <p className="text-[#555] text-sm mt-1">{t("log_first_weigh_in")}</p>
          )}
        </div>

        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-wide mb-1">
            {t("your_goal")}
          </p>
          {targetWeight ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{targetWeight}</span>
                <span className="text-[#555] text-sm">kg</span>
              </div>
              {toGoal !== null && (
                <p className="text-xs text-[#888] mt-1">
                  {toGoal === 0 ? t("goal_reached") : t("kg_to_go", { n: toGoal })}
                </p>
              )}
            </>
          ) : (
            <p className="text-[#555] text-sm mt-1">{t("no_target_weight")}</p>
          )}
        </div>
      </div>

      {/* Progress bar toward goal */}
      {progressPct != null && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#555] uppercase tracking-wide">
              Progreso hacia objetivo
            </p>
            <span className="text-sm font-black" style={{ color: accentColor }}>
              {progressPct}%
            </span>
          </div>
          <div className="h-2.5 bg-[#1f1f1f] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[#555]">{startWeight}kg</span>
            <span className="text-[10px] text-[#555]">{targetWeight}kg</span>
          </div>
        </div>
      )}

      {/* Time filter */}
      <div className="flex gap-1.5">
        {TIME_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTimeFilter(f.key)}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
            style={
              timeFilter === f.key
                ? { background: "#88ee22", color: "#0a0a0a" }
                : { background: "#111", border: "1px solid #1f1f1f", color: "#555" }
            }
          >
            {f.key}
          </button>
        ))}
      </div>

      {/* Weight chart */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
        <h3 className="font-bold text-white mb-1">{t("weight_over_time")}</h3>
        <p className="text-xs text-[#555] mb-5">{t("your_journey")}</p>

        {chartData.length >= 2 ? (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
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
                    borderRadius: "8px",
                    border: "1px solid #1f1f1f",
                    backgroundColor: "#111",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    padding: "8px 12px",
                  }}
                  itemStyle={{ color: accentColor, fontWeight: 700 }}
                  labelStyle={{ color: "#888", fontSize: 12 }}
                />
                {targetWeight && (
                  <ReferenceLine
                    y={targetWeight}
                    stroke={accentColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.45}
                    label={{
                      value: `Meta ${targetWeight}kg`,
                      fill: accentColor,
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  name="Peso (kg)"
                  stroke={accentColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0a0a0a", stroke: accentColor, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: accentColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[180px] flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[#888] font-medium text-sm">{t("not_enough_data")}</p>
            <p className="text-[#555] text-xs mt-1">{t("log_to_see_trend")}</p>
          </div>
        )}
      </div>

      {/* Log weight CTA */}
      <button
        type="button"
        onClick={onLogClick}
        className="w-full py-4 rounded-xl font-black text-[#0a0a0a] text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        style={{ background: accentColor }}
      >
        <Plus className="w-5 h-5" />
        {t("log_today_weight")}
      </button>

      {/* History list */}
      {chartData.length > 0 && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
          <h3 className="font-bold text-white mb-4">{t("recent_entries")}</h3>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 8).map((d: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-[#1f1f1f] last:border-0"
              >
                <span className="text-sm text-[#555]">{d.label}</span>
                <span className="text-sm font-bold text-white">{d.weightKg} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TAB_LABELS = ["General", "Por músculo", "Peso"];

function ProgressContent() {
  const { data: stats, isLoading } = useProgressStats();
  const t = useT();
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
      <div className="flex items-center justify-between gap-4 mb-5">
        <h1 className="text-2xl font-display font-black uppercase text-white">
          📈 {t("nav_progress")}
        </h1>
        <ShareProgressButton variant="compact" />
      </div>

      {/* Quick stats strip */}
      <QuickStatsStrip stats={stats} />

      {/* Tab bar */}
      <div className="flex border-b border-[#1f1f1f] mb-5 -mx-3 px-3">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveTab(i)}
            className="relative mr-5 pb-3 text-sm font-bold transition-colors"
            style={{ color: activeTab === i ? "#fff" : "#555" }}
          >
            {label}
            {activeTab === i && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#88ee22]"
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
          {activeTab === 0 && <GeneralTab stats={stats} />}
          {activeTab === 1 && <MuscleTab />}
          {activeTab === 2 && (
            <WeightTab stats={stats} onLogClick={() => setShowLogSheet(true)} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Log weight bottom sheet */}
      <AnimatePresence>
        {showLogSheet && <LogWeightSheet onClose={() => setShowLogSheet(false)} />}
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
