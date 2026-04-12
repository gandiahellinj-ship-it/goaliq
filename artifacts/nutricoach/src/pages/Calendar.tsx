import { useState } from "react";
import {
  useProgressLogs,
  useWorkoutPlan,
  useToggleWorkoutComplete,
  useFlexDays,
  useToggleFlexDay,
  useWorkoutHistory,
  useSaveWorkoutHistory,
  type WorkoutHistoryRecord,
  type Exercise,
} from "@/lib/supabase-queries";
import { TrialGate } from "@/components/TrialGate";
import { useT } from "@/lib/language";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, addMonths, subMonths, getDay, isBefore, startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Dumbbell, Zap, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { ShareWorkoutButton, getWorkoutTypeLabel, type WorkoutData } from "@/components/ShareWorkoutCard";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_NAME_MAP: Record<number, string> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
  4: "thursday", 5: "friday", 6: "saturday",
};

function getISOWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return format(d, "yyyy-MM-dd");
}

function estimateDurationLocal(exercises: Exercise[]): number {
  if (!exercises?.length) return 30;
  let s = 0;
  for (const ex of exercises) {
    const sets = ex.sets ?? 3;
    const rest = (ex as any).rest_sec ?? 60;
    s += sets * 45 + sets * rest;
  }
  return Math.max(Math.round((s / 60 + 10) / 5) * 5, 20);
}

function WorkoutHistoryModal({
  record,
  onClose,
}: {
  record: WorkoutHistoryRecord;
  onClose: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = record.workout_date === today;

  const dateLabel = new Date(record.workout_date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  const workout: WorkoutData = {
    workout_type: record.workout_type,
    exercises: record.exercises,
    duration_minutes: record.duration_minutes,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-[#2A2A2A] p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: "var(--giq-bg-card)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <p className="text-[#555555] text-sm capitalize">{dateLabel}</p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors ml-2 shrink-0"
          >
            <X className="w-3.5 h-3.5 text-[#A0A0A0]" />
          </button>
        </div>

        <h2 className="text-xl font-display font-bold uppercase mb-4" style={{ color: "var(--giq-accent)" }}>
          {getWorkoutTypeLabel(record.workout_type)}
        </h2>

        <div className="space-y-3 mb-5">
          {record.exercises.map((ex, i) => (
            <div key={i} className="border-b border-[#222222] pb-3 last:border-0 last:pb-0">
              <p className="text-white font-semibold text-sm">{ex.name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {ex.sets && ex.reps && (
                  <span className="text-xs font-bold" style={{ color: "var(--giq-accent)" }}>
                    {ex.sets} × {ex.reps}
                  </span>
                )}
                {ex.rest_sec && (
                  <span className="text-xs" style={{ color: "var(--giq-text-muted)" }}>
                    · {ex.rest_sec}s descanso
                  </span>
                )}
                {ex.muscles && (
                  <span className="text-xs" style={{ color: "var(--giq-text-muted)" }}>· {ex.muscles}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {record.duration_minutes > 0 && (
          <p className="text-sm mb-5" style={{ color: "var(--giq-text-muted)" }}>
            ⏱ Duración: {record.duration_minutes} min
          </p>
        )}

        {isToday && (
          <div className="mb-2">
            <ShareWorkoutButton workout={workout} />
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full text-sm font-medium py-2.5 rounded-lg transition-colors hover:text-white"
          style={{ color: "var(--giq-text-secondary)" }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_workout_calendar")} pageEmoji="📅">
      <CalendarContent />
    </TrialGate>
  );
}

function CalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [pendingFlex, setPendingFlex] = useState<string | null>(null);
  const [historyModalRecord, setHistoryModalRecord] = useState<WorkoutHistoryRecord | null>(null);
  const t = useT();

  const { data: workoutPlan } = useWorkoutPlan();
  const { data: logs, refetch: refetchLogs } = useProgressLogs(
    currentDate.getFullYear(), currentDate.getMonth() + 1
  );
  const { data: flexDays = [], refetch: refetchFlex } = useFlexDays(
    currentDate.getFullYear(), currentDate.getMonth() + 1
  );
  const { data: workoutHistory = [], refetch: refetchHistory } = useWorkoutHistory(
    currentDate.getFullYear(), currentDate.getMonth() + 1
  );
  const toggleMutation = useToggleWorkoutComplete();
  const flexMutation = useToggleFlexDay();
  const saveHistoryMutation = useSaveWorkoutHistory();

  const historyMap: Record<string, WorkoutHistoryRecord> = {};
  workoutHistory.forEach(r => { historyMap[r.workout_date] = r; });

  const trainingDays: Set<string> = workoutPlan?.trainingDays ?? new Set();

  const logMap: Record<string, boolean> = {};
  (logs || []).forEach(l => { logMap[l.log_date] = l.workout_completed; });

  const flexSet = new Set<string>(flexDays);
  const weekFlexMap: Record<string, string> = {};
  flexDays.forEach(dateStr => {
    const weekStart = getISOWeekStart(new Date(dateStr + "T00:00:00"));
    weekFlexMap[weekStart] = dateStr;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startOffset = (getDay(monthStart) + 6) % 7;
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const calendarDays: (Date | null)[] = Array(startOffset).fill(null).concat(daysInMonth);

  const totalWorkoutDaysInMonth = daysInMonth.filter(d => {
    const dayName = DAY_NAME_MAP[getDay(d)];
    return trainingDays.has(dayName);
  }).length;
  const completedDaysInMonth = daysInMonth.filter(d => {
    const dayName = DAY_NAME_MAP[getDay(d)];
    const dateStr = format(d, "yyyy-MM-dd");
    return trainingDays.has(dayName) && logMap[dateStr] === true;
  }).length;
  const adherence = totalWorkoutDaysInMonth > 0
    ? Math.min(100, Math.round((completedDaysInMonth / totalWorkoutDaysInMonth) * 100))
    : 0;

  const flexDaysThisMonth = daysInMonth.filter(d => flexSet.has(format(d, "yyyy-MM-dd"))).length;
  const isoWeeksInMonth = new Set(daysInMonth.map(d => getISOWeekStart(d))).size;
  const flexWeeksUsed = new Set(
    daysInMonth
      .filter(d => flexSet.has(format(d, "yyyy-MM-dd")))
      .map(d => getISOWeekStart(d))
  ).size;

  function getWorkoutForDate(dateStr: string) {
    if (!workoutPlan) return null;
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAME_MAP[getDay(d)];
    return workoutPlan.days.find(w => w.day === dayName)?.workout ?? null;
  }

  const handleToggleWorkout = (dateStr: string, currentStatus: boolean) => {
    const willBeCompleted = !currentStatus;
    toggleMutation.mutate(
      { date: dateStr, completed: willBeCompleted },
      {
        onSuccess: () => {
          refetchLogs();
          if (willBeCompleted) {
            toast("¡Entrenamiento completado! 🎉", {
              description: "Compártelo en Entrenamientos →",
              duration: 5000,
            });
            const w = getWorkoutForDate(dateStr);
            if (w) {
              saveHistoryMutation.mutate({
                date: dateStr,
                workout_type: w.workout_type,
                exercises: w.exercises,
                duration_minutes: w.duration_minutes ?? estimateDurationLocal(w.exercises),
              }, { onSuccess: () => refetchHistory() });
            }
          } else {
            saveHistoryMutation.mutate(
              { date: dateStr, remove: true },
              { onSuccess: () => refetchHistory() },
            );
          }
        },
      },
    );
  };

  const handleToggleFlex = (e: React.MouseEvent, dateStr: string, day: Date) => {
    e.preventDefault();
    e.stopPropagation();

    const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
    if (isPast) return;

    const isFlexDay = flexSet.has(dateStr);
    const weekStart = getISOWeekStart(day);
    const existingFlexInWeek = weekFlexMap[weekStart];

    if (!isFlexDay && existingFlexInWeek && existingFlexInWeek !== dateStr) {
      toast("Flex Day ya usado esta semana ⚡", {
        description: "Solo puedes marcar un Flex Day por semana.",
        duration: 3000,
      });
      return;
    }

    setPendingFlex(dateStr);
    flexMutation.mutate(
      { date: dateStr, isFlexDay },
      {
        onSuccess: () => {
          refetchFlex();
          setPendingFlex(null);
        },
        onError: () => {
          setPendingFlex(null);
          toast("No se pudo guardar el Flex Day. Inténtalo de nuevo.", { duration: 3000 });
        },
      },
    );
  };

  const adherenceFeedback = (() => {
    if (totalWorkoutDaysInMonth === 0) return null;
    if (adherence === 100) return { emoji: "🏆", msg: t("adherence_perfect_month"), color: "text-yellow-400" };
    if (adherence >= 80) return { emoji: "🔥", msg: t("adherence_crushing"), color: "text-[#AAFF45]" };
    if (adherence >= 60) return { emoji: "💪", msg: t("adherence_strong_month"), color: "text-[#AAFF45]" };
    if (adherence >= 40) return { emoji: "🎯", msg: t("adherence_good_effort"), color: "text-orange-400" };
    if (completedDaysInMonth > 0) return { emoji: "🌱", msg: t("adherence_started"), color: "text-orange-400" };
    return { emoji: "🌅", msg: t("adherence_fresh_month"), color: "text-[#555555]" };
  })();

  const flexFeedback = (() => {
    if (flexDaysThisMonth === 0 && isoWeeksInMonth > 0) {
      return {
        emoji: "🧠",
        msg: t("clean_weeks", { n: isoWeeksInMonth, s: isoWeeksInMonth !== 1 ? "s" : "" }),
        highlight: true,
      };
    }
    if (flexDaysThisMonth > 0) {
      return {
        emoji: "⚡",
        msg: t("flex_days_across", {
          n: flexDaysThisMonth,
          s: flexDaysThisMonth !== 1 ? "s" : "",
          weeks: isoWeeksInMonth,
          ws: isoWeeksInMonth !== 1 ? "s" : "",
        }),
        highlight: false,
      };
    }
    return null;
  })();

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-black uppercase text-white">📅 {t("nav_calendar")}</h1>
          <p className="text-sm text-[#555555] mt-1">
            {t("workouts_done_of", { done: completedDaysInMonth, total: totalWorkoutDaysInMonth })}
            {adherence >= 80 ? " 🏆" : adherence >= 50 ? " 💪" : totalWorkoutDaysInMonth > 0 ? ` — ${t("keep_going")}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-1 py-1 self-start sm:self-auto">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#A0A0A0]" />
          </button>
          <span className="font-bold text-white text-sm min-w-[120px] text-center capitalize">
            {currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#A0A0A0]" />
          </button>
        </div>
      </div>

      {/* Flex Day Monthly Tracker */}
      {flexFeedback && (
        <div
          className="rounded-lg border px-4 py-3 mb-4 flex items-center gap-3"
          style={{
            background: flexFeedback.highlight ? "color-mix(in srgb, var(--giq-accent) 6%, transparent)" : "var(--giq-bg-card)",
            borderColor: flexFeedback.highlight ? "color-mix(in srgb, var(--giq-accent) 25%, transparent)" : "var(--giq-border)",
          }}
        >
          <span className="text-xl shrink-0">{flexFeedback.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#AAFF45] uppercase tracking-wide mb-0.5">{t("flex_day_tracker")}</p>
            <p className={`text-sm font-medium ${flexFeedback.highlight ? "text-[#AAFF45]" : "text-[#A0A0A0]"}`}>
              {flexFeedback.msg}
            </p>
          </div>
        </div>
      )}

      {/* Adherence bar */}
      {totalWorkoutDaysInMonth > 0 && (
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-4 mb-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold text-[#555555] mb-1.5">
              <span>{t("monthly_adherence")}</span>
              <span className={adherence >= 80 ? "text-[#AAFF45]" : "text-[#555555]"}>{adherence}%</span>
            </div>
            <div className="h-2 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(adherence, 100)}%`,
                  backgroundColor: adherence >= 80 ? "var(--giq-accent)" : adherence >= 50 ? "#fb923c" : "#f87171",
                }}
              />
            </div>
          </div>
          <div className="text-2xl shrink-0">{adherence >= 80 ? "🏆" : adherence >= 50 ? "💪" : "🎯"}</div>
        </div>
      )}
      {adherenceFeedback && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-xl shrink-0">{adherenceFeedback.emoji}</span>
          <p className={`text-sm font-medium ${adherenceFeedback.color}`}>{adherenceFeedback.msg}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 mb-3 text-xs text-[#555555] font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#AAFF45]" />
          {t("completed_label")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#AAFF45]/20 border border-[#AAFF45]/40" />
          {t("planned_workout")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#2A2A2A] border border-[#3A3A3A]" />
          {t("rest_day")}
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#AAFF45]" />
          {t("flex_day")} (tap ⚡)
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#2A2A2A]">
          {DAY_HEADERS.map(h => (
            <div key={h} className="text-center py-2.5 text-xs font-bold text-[#555555] uppercase tracking-wide">
              {h}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="aspect-square border-b border-r border-[#2A2A2A] bg-[#111111]/30" />;
            }

            const dateStr = format(day, "yyyy-MM-dd");
            const dayName = DAY_NAME_MAP[getDay(day)];
            const isWorkoutDay = trainingDays.has(dayName);
            const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
            const isTodayDate = isToday(day);
            const completed = logMap[dateStr] === true;
            const isFlexDay = flexSet.has(dateStr);
            const weekStart = getISOWeekStart(day);
            const existingFlexInWeek = weekFlexMap[weekStart];
            const isFlexWeekUsed = !!existingFlexInWeek && existingFlexInWeek !== dateStr;
            const isLoadingFlex = pendingFlex === dateStr;
            const canFlex = !isPast;

            return (
              <div
                key={dateStr}
                className={`aspect-square border-b border-r border-[#2A2A2A] flex flex-col items-center justify-center relative transition-colors
                  ${isTodayDate ? "bg-[#AAFF45]" : ""}
                  ${!isTodayDate && isFlexDay ? "bg-[#AAFF45]/10" : ""}
                  ${!isTodayDate && isWorkoutDay && !completed && !isFlexDay ? "bg-[#AAFF45]/10" : ""}
                  ${!isTodayDate && completed ? "bg-[#AAFF45]/15" : ""}
                  ${(isWorkoutDay || completed) ? "cursor-pointer" : "cursor-default"}
                `}
                onClick={() => {
                  if (isWorkoutDay || completed) handleToggleWorkout(dateStr, completed);
                }}
              >
                {/* Date number */}
                <span
                  className={`text-sm font-bold leading-none mb-0.5 ${
                    isTodayDate ? "text-[#0A0A0A]"
                    : isWorkoutDay ? "text-[#AAFF45]"
                    : "text-[#555555]"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Workout status */}
                {isWorkoutDay && completed && (
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isTodayDate ? "text-[#0A0A0A]" : "text-[#AAFF45]"}`} />
                )}
                {isWorkoutDay && !completed && isPast && !isTodayDate && (
                  <Circle className="w-3.5 h-3.5 text-[#2A2A2A]" />
                )}
                {isWorkoutDay && !completed && !isPast && !isTodayDate && (
                  <Dumbbell className="w-3 h-3 text-[#AAFF45]/60" />
                )}
                {isTodayDate && isWorkoutDay && !completed && (
                  <Dumbbell className="w-3 h-3 text-[#0A0A0A]" />
                )}
                {isTodayDate && completed && (
                  <CheckCircle2 className="w-3 h-3 text-[#0A0A0A]" />
                )}

                {/* Flex Day label */}
                {isFlexDay && (
                  <span
                    className="font-black leading-none mt-0.5"
                    style={{
                      fontSize: 8,
                      color: isTodayDate ? "var(--giq-accent-text)" : "var(--giq-accent)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ⚡FLEX
                  </span>
                )}

                {/* ⚡ Flex Day button — large, always-clickable */}
                {canFlex && (
                  <button
                    type="button"
                    onClick={e => handleToggleFlex(e, dateStr, day)}
                    className="absolute top-0 right-0 flex items-center justify-center transition-opacity"
                    style={{
                      width: 26,
                      height: 26,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                    aria-label={isFlexDay ? "Remove Flex Day" : "Mark as Flex Day"}
                  >
                    <Zap
                      style={{
                        width: 14,
                        height: 14,
                        color: isFlexDay
                          ? (isTodayDate ? "var(--giq-accent-text)" : "var(--giq-accent)")
                          : isFlexWeekUsed
                          ? "#333333"
                          : "#666666",
                        opacity: isLoadingFlex ? 0.4 : 1,
                        filter: isFlexDay && !isTodayDate
                          ? "drop-shadow(0 0 4px var(--giq-accent))"
                          : "none",
                        transition: "color 0.15s, filter 0.15s",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                )}

                {/* 👁 Eye icon — completed workout days with saved history */}
                {isWorkoutDay && completed && historyMap[dateStr] && (
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHistoryModalRecord(historyMap[dateStr]);
                    }}
                    className="absolute bottom-0 left-0 flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                    aria-label="Ver detalles del entrenamiento"
                  >
                    <Eye
                      style={{
                        width: 11,
                        height: 11,
                        color: isTodayDate ? "var(--giq-accent-text)" : "var(--giq-accent)",
                        opacity: 0.85,
                      }}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[#555555] text-center mt-4">
        {t("tap_workout_hint")}
      </p>

      {historyModalRecord && (
        <WorkoutHistoryModal
          record={historyModalRecord}
          onClose={() => setHistoryModalRecord(null)}
        />
      )}
    </div>
  );
}
