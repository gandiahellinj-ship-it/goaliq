import { useState, useMemo, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useProfile,
  useProgressStats,
  useWorkoutHistory,
  useProgressLogs,
  getWeekStart,
} from "@/lib/supabase-queries";
import type { WorkoutHistoryRecord } from "@/lib/supabase-queries";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/lib/subscription";
import { useT } from "@/lib/language";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Dumbbell, Flame, Clock, Calendar, TrendingUp, Loader2, ChevronRight } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#88ee22";
const ACCENT_DIM = "rgba(136,238,34,0.12)";
const BAR_ACTIVE = "#88ee22";
const BAR_REST = "#1e1e1e";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(toLocalDateStr(d));
  }
  return days;
}

// ─── Custom data hook ─────────────────────────────────────────────────────────

type YearLog = { log_date: string; workout_completed: boolean };

function useProfilePageData() {
  return useQuery({
    queryKey: ["profile_page_data"],
    queryFn: async () => {
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const yearAgoStr = toLocalDateStr(oneYearAgo);
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [{ data: allCompleted }, { data: yearLogs }] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("log_date")
          .eq("workout_completed", true),
        supabase
          .from("progress_logs")
          .select("log_date, workout_completed")
          .gte("log_date", yearAgoStr)
          .order("log_date", { ascending: true }),
      ]);

      const totalWorkouts = allCompleted?.length ?? 0;
      const thisMonth = (allCompleted ?? []).filter((r) => r.log_date >= monthStart).length;

      return {
        totalWorkouts,
        thisMonth,
        yearLogs: (yearLogs ?? []) as YearLog[],
      };
    },
    staleTime: 60_000,
  });
}

// ─── Chart data builder ───────────────────────────────────────────────────────

type BarDatum = { label: string; height: number; active: boolean };

function buildChartData(
  yearLogs: YearLog[],
  range: "4w" | "3m" | "1y",
): BarDatum[] {
  const completedSet = new Set(yearLogs.filter((l) => l.workout_completed).map((l) => l.log_date));

  if (range === "4w") {
    const days = getLastNDays(28);
    return days.map((date) => {
      const active = completedSet.has(date);
      const d = new Date(date + "T00:00:00");
      const label = d.toLocaleDateString("en-US", { weekday: "narrow" });
      return { label, height: active ? 100 : 12, active };
    });
  }

  // 3m = 13 weeks, 1y = 52 weeks
  const nWeeks = range === "3m" ? 13 : 52;
  const bars: BarDatum[] = [];
  const now = new Date();

  for (let w = nWeeks - 1; w >= 0; w--) {
    const weekEndDate = new Date(now);
    weekEndDate.setDate(weekEndDate.getDate() - w * 7);
    const weekStartDate = new Date(weekEndDate);
    weekStartDate.setDate(weekStartDate.getDate() - 6);

    const startStr = toLocalDateStr(weekStartDate);
    const endStr = toLocalDateStr(weekEndDate);

    const count = yearLogs.filter(
      (l) => l.workout_completed && l.log_date >= startStr && l.log_date <= endStr,
    ).length;

    const label = weekEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    bars.push({ label, height: Math.max((count / 7) * 100, count > 0 ? 8 : 6), active: count > 0 });
  }
  return bars;
}

// ─── Muscle group analysis ────────────────────────────────────────────────────

const MUSCLE_KEYWORDS: Record<string, string[]> = {
  chest: ["chest", "pecho", "pectoral", "bench"],
  back: ["back", "espalda", "lat", "dorsal", "row", "pull", "remo"],
  legs: ["quad", "hamstring", "leg", "glute", "calf", "pierna", "cuadricep", "squat", "sentadilla", "lunge", "zancada", "gluteo", "gemelo"],
  shoulders: ["shoulder", "delt", "hombro", "press", "lateral", "overhead"],
  core: ["core", "abs", "abdomen", "plank", "oblique", "oblicuo"],
};

const MUSCLE_LABEL: Record<string, string> = {
  chest: "Pecho",
  back: "Espalda",
  legs: "Piernas",
  shoulders: "Hombros",
  core: "Core",
};

function getMuscleDistribution(history: WorkoutHistoryRecord[]): Record<string, number> {
  const counts: Record<string, number> = { chest: 0, back: 0, legs: 0, shoulders: 0, core: 0 };
  let total = 0;

  for (const session of history) {
    for (const ex of session.exercises) {
      const text = ((ex.muscles ?? "") + " " + ex.name).toLowerCase();
      let matched = false;
      for (const [group, kws] of Object.entries(MUSCLE_KEYWORDS)) {
        if (kws.some((kw) => text.includes(kw))) {
          counts[group]++;
          total++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // distribute evenly to avoid empty chart
        total++;
      }
    }
  }

  if (total === 0) return { chest: 20, back: 20, legs: 20, shoulders: 20, core: 20 };

  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    result[k] = Math.round((v / total) * 100);
  }
  return result;
}

// ─── Weekly volume ─────────────────────────────────────────────────────────────

function getWeeklyMinutes(history: WorkoutHistoryRecord[], weekStartStr: string): number {
  const weekEndDate = new Date(weekStartStr + "T00:00:00");
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEndStr = toLocalDateStr(weekEndDate);
  return history
    .filter((r) => r.workout_date >= weekStartStr && r.workout_date <= weekEndStr)
    .reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0);
}

function getPrevWeekStart(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return toLocalDateStr(d);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  value,
  unit,
  label,
}: {
  icon: ElementType;
  value: string | number;
  unit?: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-4 rounded-2xl"
      style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
        style={{ backgroundColor: ACCENT_DIM }}
      >
        <Icon className="w-4 h-4" style={{ color: ACCENT }} />
      </div>
      <div className="flex items-baseline gap-0.5 leading-none">
        <span className="text-xl font-black" style={{ color: "var(--giq-text-primary)" }}>{value}</span>
        {unit && (
          <span className="text-xs font-semibold" style={{ color: "var(--giq-text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
      <p className="text-[10px] font-medium text-center leading-tight" style={{ color: "var(--giq-text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

type ChartRange = "4w" | "3m" | "1y";

function ActivityChart({ yearLogs }: { yearLogs: YearLog[] }) {
  const [range, setRange] = useState<ChartRange>("4w");
  const t = useT();

  const bars = useMemo(() => buildChartData(yearLogs, range), [yearLogs, range]);

  const rangeOptions: { key: ChartRange; label: string }[] = [
    { key: "4w", label: t("chart_range_4w") },
    { key: "3m", label: t("chart_range_3m") },
    { key: "1y", label: t("chart_range_1y") },
  ];

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
    >
      {/* Range selector */}
      <div className="flex items-center justify-between mb-4">
        <TrendingUp className="w-4 h-4" style={{ color: ACCENT }} />
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ backgroundColor: "var(--giq-bg-secondary)", border: "1px solid var(--giq-border)" }}
        >
          {rangeOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className="px-3 py-1.5 text-xs font-bold transition-all"
              style={
                range === key
                  ? { backgroundColor: ACCENT, color: "#0d0d0d" }
                  : { color: "var(--giq-text-muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-px h-16 w-full overflow-hidden">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${bar.height}%`,
              backgroundColor: bar.active ? BAR_ACTIVE : BAR_REST,
              minWidth: 2,
            }}
            title={bar.label}
          />
        ))}
      </div>

      {/* Range labels — only show for 4w (too many for longer ranges) */}
      {range === "4w" && (
        <div className="flex justify-between mt-1">
          {[0, 6, 13, 20, 27].map((i) => {
            const bar = bars[i];
            if (!bar) return null;
            return (
              <span key={i} className="text-[9px]" style={{ color: "var(--giq-text-muted)" }}>
                {bar.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Profile() {
  const t = useT();
  const { session } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: stats } = useProgressStats();
  const { data: subData } = useSubscription();
  const { data: pageData, isLoading: pageLoading } = useProfilePageData();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: thisMonthHistory } = useWorkoutHistory(year, month);
  const { data: prevMonthHistory } = useWorkoutHistory(prevYear, prevMonth);
  const { data: monthLogs } = useProgressLogs(year, month);

  const email = session?.user?.email ?? "";
  const isPro = subData?.status === "active" || subData?.status === "trialing";

  // ── Derived: avg duration ──────────────────────────────────────────────────
  const allHistory = useMemo<WorkoutHistoryRecord[]>(() => {
    return [...(prevMonthHistory ?? []), ...(thisMonthHistory ?? [])];
  }, [thisMonthHistory, prevMonthHistory]);

  const avgDuration = useMemo(() => {
    const withDuration = allHistory.filter((r) => r.duration_minutes > 0);
    if (withDuration.length === 0) return 0;
    return Math.round(withDuration.reduce((s, r) => s + r.duration_minutes, 0) / withDuration.length);
  }, [allHistory]);

  // ── Derived: last session ──────────────────────────────────────────────────
  const lastSession = useMemo<WorkoutHistoryRecord | null>(() => {
    const sorted = [...allHistory].sort((a, b) => (b.workout_date > a.workout_date ? 1 : -1));
    return sorted[0] ?? null;
  }, [allHistory]);

  // ── Derived: weekly volume ─────────────────────────────────────────────────
  const weekStart = getWeekStart();
  const prevWeekStart = getPrevWeekStart(weekStart);
  const thisWeekMin = useMemo(
    () => getWeeklyMinutes(allHistory, weekStart),
    [allHistory, weekStart],
  );
  const prevWeekMin = useMemo(
    () => getWeeklyMinutes(allHistory, prevWeekStart),
    [allHistory, prevWeekStart],
  );
  const volumeDelta =
    prevWeekMin > 0 ? Math.round(((thisWeekMin - prevWeekMin) / prevWeekMin) * 100) : null;

  // ── Derived: muscle groups ─────────────────────────────────────────────────
  const muscleDist = useMemo(() => getMuscleDistribution(allHistory), [allHistory]);
  const maxMuscle = Math.max(...Object.values(muscleDist), 1);

  // ── Derived: monthly calendar ─────────────────────────────────────────────
  const completedDatesThisMonth = useMemo(() => {
    return new Set((monthLogs ?? []).filter((l) => l.workout_completed).map((l) => l.log_date));
  }, [monthLogs]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    // Convert Sunday=0 to Monday-first: Mon=0 … Sun=6
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const todayStr = toLocalDateStr(now);
    const days: { date: string | null; isPast: boolean; isDone: boolean }[] = [];
    for (let i = 0; i < offset; i++) days.push({ date: null, isPast: false, isDone: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isPast = dateStr <= todayStr;
      const isDone = completedDatesThisMonth.has(dateStr);
      days.push({ date: dateStr, isPast, isDone });
    }
    return days;
  }, [year, month, completedDatesThisMonth]);

  const isLoading = profileLoading || pageLoading;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  const totalWorkouts = pageData?.totalWorkouts ?? 0;
  const thisMonthCount = pageData?.thisMonth ?? 0;
  const streak = stats?.streak ?? 0;
  const completedThisWeek = stats?.completedWorkoutsThisWeek ?? 0;
  const totalThisWeek = stats?.totalWorkoutsThisWeek ?? 0;
  const weekPct = totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0;

  // Format last session date
  const lastSessionLabel = lastSession
    ? new Date(lastSession.workout_date + "T00:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  // Workout type display
  const lastSessionType = lastSession?.workout_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

  return (
    <div
      className="p-5 sm:p-7 lg:p-10 max-w-2xl mx-auto pb-28 space-y-4"
      style={{ color: "var(--giq-text-primary)" }}
    >
      {/* ── Section 1: Header card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5"
        style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
      >
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-2xl font-black"
          style={{
            border: `3px solid ${ACCENT}`,
            backgroundColor: ACCENT_DIM,
            color: ACCENT,
          }}
        >
          {getInitials(profile?.full_name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black truncate" style={{ color: "var(--giq-text-primary)" }}>
            {profile?.full_name ?? "—"}
          </h1>
          <p className="text-sm truncate mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
            {email}
          </p>
          <span
            className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-black tracking-widest uppercase"
            style={
              isPro
                ? { backgroundColor: ACCENT_DIM, color: ACCENT, border: `1px solid ${ACCENT}` }
                : { backgroundColor: "var(--giq-border)", color: "var(--giq-text-muted)", border: "1px solid var(--giq-border)" }
            }
          >
            {isPro ? "PRO" : "FREE"}
          </span>
        </div>
      </div>

      {/* ── Section 2: 4 metric cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard icon={Dumbbell} value={totalWorkouts} label={t("total_workouts")} />
        <MetricCard icon={Calendar} value={thisMonthCount} label={t("this_month_label")} />
        <MetricCard icon={Flame} value={streak} unit="d" label={t("streak_days")} />
        <MetricCard
          icon={Clock}
          value={avgDuration > 0 ? avgDuration : "—"}
          unit={avgDuration > 0 ? t("mins_short") : undefined}
          label={t("avg_duration_label")}
        />
      </div>

      {/* ── Section 3: Activity bar chart ─────────────────────────────────── */}
      <ActivityChart yearLogs={pageData?.yearLogs ?? []} />

      {/* ── Section 4: This week + Weekly volume ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current week */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--giq-text-muted)" }}>
            {t("this_week")}
          </p>
          <p className="text-2xl font-black leading-none" style={{ color: "var(--giq-text-primary)" }}>
            {t("days_done_fmt", { done: completedThisWeek, total: totalThisWeek || "—" })}
          </p>
          {/* Progress bar */}
          <div
            className="mt-3 rounded-full overflow-hidden"
            style={{ height: 4, backgroundColor: "var(--giq-border)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${weekPct}%`, backgroundColor: ACCENT }}
            />
          </div>
          <p className="text-xs mt-1.5 font-semibold" style={{ color: ACCENT }}>
            {weekPct}% completado
          </p>
        </div>

        {/* Weekly volume */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--giq-text-muted)" }}>
            {t("weekly_volume_label")}
          </p>
          <p className="text-2xl font-black leading-none" style={{ color: "var(--giq-text-primary)" }}>
            {thisWeekMin > 0 ? (thisWeekMin / 60).toFixed(1) : "0"}
            <span className="text-sm font-semibold ml-1" style={{ color: "var(--giq-text-muted)" }}>
              {t("hrs_this_week")}
            </span>
          </p>
          {volumeDelta !== null && (
            <p
              className="text-xs mt-2 font-semibold"
              style={{ color: volumeDelta >= 0 ? ACCENT : "var(--giq-error, #ff4444)" }}
            >
              {volumeDelta >= 0 ? "+" : ""}{volumeDelta}% {t("vs_prev_week")}
            </p>
          )}
          {volumeDelta === null && (
            <p className="text-xs mt-2" style={{ color: "var(--giq-text-muted)" }}>
              {t("no_data")}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 5: Last session card ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--giq-text-muted)" }}>
          {t("last_session_label")}
        </p>

        {lastSession ? (
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: ACCENT_DIM }}
            >
              <Dumbbell className="w-6 h-6" style={{ color: ACCENT }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: "var(--giq-text-primary)" }}>
                {lastSessionType || t("last_session_label")}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                {lastSessionLabel} · {lastSession.duration_minutes} {t("mins_short")} · {t("exercises_n", { n: lastSession.exercises.length })}
              </p>
            </div>

            <Link
              href="/workouts"
              className="shrink-0 flex items-center gap-1 text-xs font-semibold"
              style={{ color: ACCENT }}
            >
              {t("view_detail_btn")}
            </Link>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--giq-text-muted)" }}>
            {t("no_sessions_yet")}
          </p>
        )}
      </div>

      {/* ── Section 6: Muscle groups + Monthly calendar ───────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Muscle groups */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--giq-text-muted)" }}>
            {t("muscle_groups_label")}
          </p>
          <div className="space-y-2.5">
            {Object.entries(MUSCLE_LABEL).map(([key, label]) => {
              const pct = muscleDist[key] ?? 0;
              const barWidth = maxMuscle > 0 ? (pct / maxMuscle) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>
                      {label}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: pct > 0 ? ACCENT : "var(--giq-text-muted)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 3, backgroundColor: "var(--giq-border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barWidth}%`, backgroundColor: ACCENT }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly calendar dots */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--giq-text-muted)" }}>
            {now.toLocaleDateString(undefined, { month: "long" })}
          </p>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <div key={d} className="text-center text-[9px] font-bold" style={{ color: "var(--giq-text-muted)" }}>
                {d}
              </div>
            ))}
          </div>
          {/* Day dots */}
          <div className="grid grid-cols-7 gap-y-1.5">
            {calendarDays.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day.date === null ? (
                  <div className="w-4 h-4" />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: day.isDone
                        ? ACCENT
                        : day.isPast
                        ? "var(--giq-border)"
                        : "transparent",
                      border: day.isPast && !day.isDone ? "1px solid var(--giq-border)" : "none",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer: edit preferences link ─────────────────────────────────── */}
      <Link
        href="/profile/edit"
        className="flex items-center justify-between w-full p-4 rounded-2xl transition-opacity hover:opacity-80"
        style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--giq-text-primary)" }}>
          {t("update_preferences")}
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: "var(--giq-text-muted)" }} />
      </Link>
    </div>
  );
}
