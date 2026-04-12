import { useState } from "react";
import { useProgressStats, useLogWeight } from "@/lib/supabase-queries";
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
    <div className="p-5 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28">

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
