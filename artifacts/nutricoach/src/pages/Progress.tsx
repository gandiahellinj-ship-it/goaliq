import { useState } from "react";
import { useProgressStats, useLogWeight, useStrengthGroups, useStrengthGroupLogs } from "@/lib/supabase-queries";
import type { StrengthLog } from "@/lib/supabase-queries";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { parseISO } from "date-fns";
import { Loader2, Plus, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TrialGate } from "@/components/TrialGate";
import { ShareProgressButton } from "@/components/ShareProgressCard";
import { useT } from "@/lib/language";
import { useThemeAccent } from "@/lib/theme";

function ProgressContent() {
  const { data: stats, isLoading } = useProgressStats();
  const accentColor = useThemeAccent();
  const logWeightMutation = useLogWeight();
  const t = useT();
  const [weightInput, setWeightInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedWeight, setSavedWeight] = useState<number | null>(null);
  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!val || isNaN(val) || val < 20 || val > 400) return;
    logWeightMutation.mutate(val, {
      onSuccess: () => {
        setSavedWeight(val);
        setWeightInput("");
        setSaved(true);
        setTimeout(() => setSaved(false), 3500);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#AAFF45]" />
      </div>
    );
  }

  const chartData = (stats?.weightHistory ?? [])
    .map(d => ({ ...d, label: parseISO(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) }));

  const currentWeight = stats?.currentWeightKg ?? null;
  const startWeight = stats?.startWeightKg ?? null;
  const weightDelta =
    currentWeight != null && startWeight != null
      ? +(currentWeight - startWeight).toFixed(1)
      : null;
  const isLoss = (weightDelta ?? 0) < 0;
  const isGain = (weightDelta ?? 0) > 0;

  const toGoal =
    currentWeight != null && stats?.targetWeightKg != null
      ? +Math.abs(currentWeight - stats.targetWeightKg).toFixed(1)
      : null;

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28 overflow-x-hidden">

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display font-black uppercase text-white">📈 {t("nav_progress")}</h1>
        <ShareProgressButton variant="compact" />
      </div>

      {/* Post-save celebration toast */}
      <AnimatePresence>
        {saved && savedWeight != null && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mb-4 bg-[#AAFF45] rounded-lg px-5 py-4 flex items-center gap-4 shadow-md"
          >
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <p className="text-[#0A0A0A] font-bold text-sm">{t("kg_logged", { n: savedWeight })}</p>
              <p className="text-[#0A0A0A]/70 text-xs mt-0.5">
                {stats?.targetWeightKg && Math.abs(savedWeight - stats.targetWeightKg) < 0.5
                  ? t("goal_hit_congrats")
                  : stats?.targetWeightKg && savedWeight > stats.targetWeightKg
                  ? t("kg_to_goal_over", { n: (savedWeight - stats.targetWeightKg).toFixed(1) })
                  : stats?.targetWeightKg && savedWeight < stats.targetWeightKg
                  ? t("kg_to_goal_almost", { n: (stats.targetWeightKg - savedWeight).toFixed(1) })
                  : t("great_tracking")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Current Weight */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
          <p className="text-xs font-bold text-[#555555] uppercase tracking-wide mb-2">{t("current_weight")}</p>
          {currentWeight != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{currentWeight}</span>
                <span className="text-[#555555] font-medium">kg</span>
              </div>
              {weightDelta !== null && weightDelta !== 0 && (
                <p className={`text-sm font-semibold mt-1 ${isLoss ? "text-[#AAFF45]" : isGain ? "text-orange-400" : "text-[#555555]"}`}>
                  {isGain ? "+" : ""}{weightDelta} kg {t("from_start")}
                </p>
              )}
            </>
          ) : (
            <p className="text-[#555555] text-sm">{t("log_first_weigh_in")}</p>
          )}
        </div>

        {/* Target Weight */}
        {stats?.targetWeightKg ? (
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
            <p className="text-xs font-bold text-[#555555] uppercase tracking-wide mb-2">{t("your_goal")}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{stats.targetWeightKg}</span>
              <span className="text-[#555555] font-medium">kg</span>
            </div>
            {toGoal !== null && (
              <p className="text-sm font-semibold mt-1 text-[#A0A0A0]">
                {toGoal === 0 ? t("goal_reached") : t("kg_to_go", { n: toGoal })}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5 flex items-center justify-center">
            <p className="text-sm text-[#555555] text-center">{t("no_target_weight")}</p>
          </div>
        )}

        {/* Log weight */}
        <div className="bg-[#AAFF45] rounded-lg p-5">
          <p className="text-xs font-bold text-[#0A0A0A]/60 uppercase tracking-wide mb-3">
            {saved ? `✓ ${t("saved")}` : t("log_today_weight")}
          </p>
          <form onSubmit={handleLog} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="400"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder={t("eg_weight")}
              className="flex-1 bg-[#0A0A0A]/20 text-[#0A0A0A] placeholder:text-[#0A0A0A]/40 border-none rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 font-bold text-base min-w-0"
            />
            <button
              type="submit"
              disabled={logWeightMutation.isPending}
              className="p-2.5 bg-[#0A0A0A] text-[#AAFF45] rounded-lg hover:bg-[#1A1A1A] transition-colors disabled:opacity-50 shrink-0"
            >
              {logWeightMutation.isPending
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Plus className="w-5 h-5" />}
            </button>
          </form>
          <p className="text-xs text-[#0A0A0A]/50 mt-2">{t("press_plus")}</p>
        </div>
      </div>

      {/* Progress insight card */}
      {(stats?.weightHistory?.length ?? 0) >= 2 && (
        <div className={`rounded-lg border p-4 mb-6 flex items-start gap-3 ${
          isLoss ? "bg-[#AAFF45]/10 border-[#AAFF45]/20"
          : isGain ? "bg-orange-500/10 border-orange-500/20"
          : "bg-[#1A1A1A] border-[#2A2A2A]"
        }`}>
          <div className={`w-9 h-9 rounded-lg bg-[#0A0A0A]/30 flex items-center justify-center shrink-0 ${
            isLoss ? "text-[#AAFF45]" : isGain ? "text-orange-400" : "text-[#555555]"
          }`}>
            {isLoss
              ? <TrendingDown className="w-5 h-5" />
              : isGain
              ? <TrendingUp className="w-5 h-5" />
              : <Minus className="w-5 h-5" />}
          </div>
          <div>
            <p className={`font-bold text-sm mb-0.5 ${
              isLoss ? "text-[#AAFF45]" : isGain ? "text-orange-400" : "text-[#A0A0A0]"
            }`}>
              {isLoss
                ? t("down_kg_progress", { n: Math.abs(weightDelta!) })
                : isGain
                ? t("up_kg_from_start", { n: weightDelta })
                : t("weight_stable")}
            </p>
            <p className="text-xs text-[#555555] leading-relaxed">
              {isLoss
                ? toGoal != null && toGoal > 0
                  ? t("trending_right", { n: toGoal })
                  : t("keep_logging")
                : isGain
                ? t("normal_muscle_gain")
                : t("consistency_logging")}
            </p>
          </div>
        </div>
      )}

      {/* Weekly adherence */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
          <p className="text-xs font-bold text-[#555555] uppercase tracking-wide mb-2">{t("workouts_done_label")}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{stats?.completedWorkoutsThisWeek ?? 0}</span>
            <span className="text-[#555555] font-medium">/ {stats?.totalWorkoutsThisWeek ?? 0} {t("this_week_short")}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#AAFF45] rounded-full transition-all duration-500"
              style={{
                width: stats?.totalWorkoutsThisWeek
                  ? `${Math.min(((stats.completedWorkoutsThisWeek / stats.totalWorkoutsThisWeek) * 100), 100)}%`
                  : "0%",
              }}
            />
          </div>
        </div>
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
          <p className="text-xs font-bold text-[#555555] uppercase tracking-wide mb-2">{t("weekly_adherence_label")}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{stats?.weeklyAdherencePercent ?? 0}</span>
            <span className="text-[#555555] font-medium">%</span>
          </div>
          <p className="text-xs text-[#555555] mt-1">
            {(stats?.weeklyAdherencePercent ?? 0) >= 80
              ? t("adherence_excellent")
              : (stats?.weeklyAdherencePercent ?? 0) >= 50
              ? t("adherence_good_progress")
              : t("every_workout_counts")}
          </p>
        </div>
      </div>

      {/* Weight chart */}
      <>
      <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
        <h3 className="font-bold text-white mb-1">{t("weight_over_time")}</h3>
        <p className="text-xs text-[#555555] mb-5">{t("your_journey")}</p>

        {chartData.length >= 2 ? (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A2A" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#555555", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#555555", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #2A2A2A",
                    backgroundColor: "#1A1A1A",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    padding: "8px 12px",
                  }}
                  itemStyle={{ color: accentColor, fontWeight: 700 }}
                  labelStyle={{ color: "#A0A0A0", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  name="Weight (kg)"
                  stroke={accentColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0A0A0A", stroke: accentColor, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: accentColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[#A0A0A0] font-medium text-sm">{t("not_enough_data")}</p>
            <p className="text-[#555555] text-xs mt-1">{t("log_to_see_trend")}</p>
          </div>
        )}
      </div>

      {/* History */}
      {chartData.length > 0 && (
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5 mt-4">
          <h3 className="font-bold text-white mb-4">{t("recent_entries")}</h3>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 8).map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2A2A2A] last:border-0">
                <span className="text-sm text-[#555555]">{d.label}</span>
                <span className="text-sm font-bold text-white">{d.weightKg} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>

      {/* Strength progression */}
      <StrengthSection />
    </div>
  );
}

const MUSCLE_COLORS = ["#88ee22", "#7B8CDE", "#FFB347", "#FF6B6B", "#4ECDC4"];

const ALL_GROUPS: { key: string; tKey: string; emoji: string }[] = [
  { key: "legs",      tKey: "muscle_group_legs",      emoji: "🦵" },
  { key: "back",      tKey: "muscle_group_back",       emoji: "🔙" },
  { key: "shoulders", tKey: "muscle_group_shoulders",  emoji: "💪" },
  { key: "chest",     tKey: "muscle_group_chest",      emoji: "🫁" },
  { key: "arms",      tKey: "muscle_group_arms",       emoji: "💪" },
  { key: "core",      tKey: "muscle_group_core",       emoji: "🎯" },
];

function buildMultiLineData(
  byMuscle: Record<string, StrengthLog[]>,
  muscles: string[],
): { chartData: Record<string, any>[]; allWeeks: string[] } {
  // Collect all unique week_starts across all muscles
  const weekSet = new Set<string>();
  for (const logs of Object.values(byMuscle)) {
    for (const log of logs) weekSet.add(log.week_start);
  }
  const allWeeks = Array.from(weekSet).sort();

  // For each week, for each muscle: pick max weight_kg
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

function StrengthSection() {
  const t = useT();
  const { data: groupsWithData = [] } = useStrengthGroups();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Auto-select first group with data when list loads
  const selectedGroup = activeGroup ?? (groupsWithData[0] ?? ALL_GROUPS[0].key);

  const { data: groupData } = useStrengthGroupLogs(selectedGroup);
  const byMuscle = groupData?.byMuscle ?? {};
  const muscles = groupData?.muscles ?? [];

  const { chartData, allWeeks } = buildMultiLineData(byMuscle, muscles);

  // Per-muscle max for PR detection
  const muscleMaxMap: Record<string, number> = {};
  for (const muscle of muscles) {
    const allKg = (byMuscle[muscle] ?? []).map(l => l.weight_kg);
    muscleMaxMap[muscle] = allKg.length > 0 ? Math.max(...allKg) : 0;
  }

  const hasData = muscles.length > 0 && allWeeks.length > 0;
  const hasEnoughData = hasData && allWeeks.length >= 2;

  return (
    <div className="mt-4">
      <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
        <h3 className="font-bold text-white mb-1">💪 {t("strength_progress")}</h3>

        {/* Group selector — always show all 6 groups */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4 scrollbar-hide mt-3">
          {ALL_GROUPS.map(({ key, tKey }) => {
            const isActive = key === selectedGroup;
            const hasGroupData = groupsWithData.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveGroup(key)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={isActive ? {
                  background: "color-mix(in srgb, var(--giq-accent) 15%, transparent)",
                  border: "1.5px solid var(--giq-accent)",
                  color: "var(--giq-accent)",
                } : hasGroupData ? {
                  background: "var(--giq-bg-secondary)",
                  border: "1.5px solid var(--giq-border)",
                  color: "var(--giq-text-secondary)",
                } : {
                  background: "transparent",
                  border: "1.5px solid var(--giq-border)",
                  color: "var(--giq-text-muted)",
                  opacity: 0.45,
                }}
              >
                {t(tKey)}
              </button>
            );
          })}
        </div>

        {!hasData ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-3">🏋️</div>
            <p className="text-sm text-[#555555]">{t("no_strength_data")}</p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {muscles.map((muscle, i) => (
                <div key={muscle} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }}
                  />
                  <span className="text-xs" style={{ color: "var(--giq-text-muted)" }}>{muscle}</span>
                </div>
              ))}
            </div>

            {/* Multi-line chart */}
            {hasEnoughData ? (
              <div className="h-[220px] w-full mb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 18, right: 16, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A2A" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#555555", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#555555", fontSize: 11 }}
                      unit="kg"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #2A2A2A",
                        backgroundColor: "#1A1A1A",
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#A0A0A0", fontSize: 12 }}
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
                            const isLast = props.index === chartData.length - 1 || chartData.slice(props.index + 1).every(d => d[muscle] == null);
                            const isPR = props.payload[muscle] === muscleMax && muscleMax > 0;
                            return (
                              <g key={props.key}>
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={isLast ? 5 : 3.5}
                                  fill={isLast ? color : "#0A0A0A"}
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
                <p className="text-sm text-[#555555]">{t("log_to_see_trend")}</p>
              </div>
            )}

            {/* Records list — grouped by specific muscle */}
            <div className="space-y-4">
              {muscles.map((muscle, i) => {
                const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
                const muscleLogs = [...(byMuscle[muscle] ?? [])].reverse().slice(0, 3);
                const muscleMax = muscleMaxMap[muscle] ?? 0;
                return (
                  <div key={muscle}>
                    {/* Muscle header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-bold text-white">{muscle}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color }}>
                        {muscleMax > 0 ? `${muscleMax}kg max` : ""}
                      </span>
                    </div>
                    {/* Recent entries */}
                    <div className="space-y-1.5 pl-3">
                      {muscleLogs.map((log, j) => {
                        const pct = muscleMax > 0 ? Math.round((log.weight_kg / muscleMax) * 100) : 100;
                        const isPR = log.weight_kg === muscleMax;
                        const dateLabel = new Date(log.logged_at + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "numeric", month: "short",
                        });
                        return (
                          <div key={log.id ?? j} className="flex items-center gap-3">
                            <span className="text-[10px] w-12 shrink-0" style={{ color: "var(--giq-text-muted)" }}>{dateLabel}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-semibold text-white">{log.weight_kg}kg × {log.reps}</span>
                                {isPR && (
                                  <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(255,184,0,0.15)", color: "#FFB800" }}>
                                    PR
                                  </span>
                                )}
                              </div>
                              <div className="h-1 rounded-full bg-[#2A2A2A] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, backgroundColor: isPR ? "#FFB800" : color }}
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

export default function Progress() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_progress")} pageEmoji="📈">
      <ProgressContent />
    </TrialGate>
  );
}
