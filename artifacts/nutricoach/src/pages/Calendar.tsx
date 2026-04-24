import { useState, useRef, useEffect } from "react";
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
import { useT, useLanguage } from "@/lib/language";
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, addMonths, subMonths, getDay, isBefore, startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { ShareWorkoutButton, getWorkoutTypeLabel, type WorkoutData } from "@/components/ShareWorkoutCard";

const DAY_HEADER_KEYS = ["day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat", "day_sun"] as const;

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
  const t = useT();
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
                    · {t("rest_seconds", { n: ex.rest_sec })}
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
            ⏱ {t("duration_label")}: {record.duration_minutes} min
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
          {t("close")}
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"workout" | "flex" | null>(null);
  const [historyModalRecord, setHistoryModalRecord] = useState<WorkoutHistoryRecord | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { lang } = useLanguage();
  const isES = lang !== "en";

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

  // Auto-scroll action panel into view when a date is selected
  useEffect(() => {
    if (selectedDate && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedDate]);

  // Reset selection when month changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedAction(null);
  }, [currentDate]);

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

  // ── Streak calculation ────────────────────────────────────────────────────
  const today = startOfDay(new Date());
  let currentStreak = 0;
  {
    let checkDate = new Date(today);
    while (true) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const dayName = DAY_NAME_MAP[getDay(checkDate) as keyof typeof DAY_NAME_MAP];
      const isTraining = trainingDays.has(dayName);
      if (isTraining && logMap[dateStr] === true) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      } else if (!isTraining) {
        checkDate = new Date(checkDate.getTime() - 86400000);
        if (checkDate < startOfMonth(currentDate)) break;
      } else {
        break;
      }
    }
  }

  // ── Best week calculation ─────────────────────────────────────────────────
  let bestWeekStart: string | null = null;
  let bestWeekCount = 0;
  {
    const weekMap = new Map<string, number>();
    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = DAY_NAME_MAP[getDay(day) as keyof typeof DAY_NAME_MAP];
      if (trainingDays.has(dayName) && logMap[dateStr] === true) {
        const mon = new Date(day);
        mon.setDate(mon.getDate() - ((getDay(mon) + 6) % 7));
        const weekKey = format(mon, "yyyy-MM-dd");
        weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
      }
    });
    weekMap.forEach((count, weekKey) => {
      if (count > bestWeekCount) { bestWeekCount = count; bestWeekStart = weekKey; }
    });
  }

  // ── Weight dots (days where user registered weight) ───────────────────────
  // Weight data not yet in this component — skip for now, use empty set
  const weightDates = new Set<string>();

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isTrainingDay(dateStr: string): boolean {
    if (!workoutPlan) return false;
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAME_MAP[getDay(d)];
    return trainingDays.has(dayName);
  }

  function getWorkoutForDate(dateStr: string) {
    if (!workoutPlan) return null;
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAME_MAP[getDay(d)];
    return workoutPlan.days.find(w => w.day === dayName)?.workout ?? null;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleWorkout = (dateStr: string, currentStatus: boolean) => {
    const willBeCompleted = !currentStatus;
    toggleMutation.mutate(
      { date: dateStr, completed: willBeCompleted },
      {
        onSuccess: () => {
          refetchLogs();
          if (willBeCompleted) {
            toast(t("workout_completed_toast"), {
              description: t("share_in_workouts"),
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

  const handleToggleFlex = (dateStr: string) => {
    const isFlexDay = flexSet.has(dateStr);
    const day = new Date(dateStr + "T00:00:00");
    const weekStart = getISOWeekStart(day);
    const existingFlexInWeek = weekFlexMap[weekStart];

    if (!isFlexDay && existingFlexInWeek && existingFlexInWeek !== dateStr) {
      toast(t("flex_day_used_week"), {
        description: t("only_one_flex"),
        duration: 3000,
      });
      return;
    }

    // Monthly limit warning — show toast when marking the 5th+ flex day
    if (!isFlexDay && flexDaysThisMonth >= 4) {
      toast(t("flex_limit_toast", { n: flexDaysThisMonth + 1 }), { duration: 4000 });
    }

    flexMutation.mutate(
      { date: dateStr, isFlexDay },
      {
        onSuccess: () => refetchFlex(),
        onError: () => toast(t("could_not_save_flex"), { duration: 3000 }),
      },
    );
  };

  function handleConfirm() {
    if (!selectedDate || !selectedAction) return;
    if (selectedAction === "workout") {
      const isCompleted = logMap[selectedDate] === true;
      handleToggleWorkout(selectedDate, isCompleted);
    } else if (selectedAction === "flex") {
      handleToggleFlex(selectedDate);
    }
    setSelectedDate(null);
    setSelectedAction(null);
  }

  // ── Panel context ──────────────────────────────────────────────────────────

  const selectedDateIsPast = selectedDate
    ? isBefore(parseISO(selectedDate), startOfDay(new Date()))
    : false;
  const selectedDateIsTraining = selectedDate ? isTrainingDay(selectedDate) : false;
  const selectedDateCompleted = selectedDate ? logMap[selectedDate] === true : false;
  const selectedDateIsFlexDay = selectedDate ? flexSet.has(selectedDate) : false;

  // Show workout option if it's a training day or already has a log entry
  const showWorkoutOption = selectedDateIsTraining || selectedDateCompleted;
  // Show flex option for today/future, or to remove an existing flex day
  const showFlexOption = !selectedDateIsPast || selectedDateIsFlexDay;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-32 overflow-x-hidden">

      {/* Month nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-display font-black uppercase text-white">📅 {t("nav_calendar")}</h1>
        <div className="flex items-center gap-2 bg-[#141414] border border-[#1f1f1f] rounded-xl px-1 py-1 self-start sm:self-auto">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors">
            <ChevronLeft className="w-4 h-4 text-[#A0A0A0]" />
          </button>
          <span className="font-bold text-white text-sm min-w-[120px] text-center capitalize">
            {currentDate.toLocaleDateString(isES ? "es-ES" : "en-US", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors">
            <ChevronRight className="w-4 h-4 text-[#A0A0A0]" />
          </button>
        </div>
      </div>

      {/* Stats strip — 4 columns */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
        {[
          { val: completedDaysInMonth, label: isES ? "Entrenos" : "Workouts", color: "var(--giq-accent)" },
          { val: `${adherence}%`, label: isES ? "Adherencia" : "Adherence", color: adherence >= 80 ? "var(--giq-accent)" : adherence >= 50 ? "#fb923c" : "#f87171" },
          { val: `🔥${currentStreak}`, label: isES ? "Racha" : "Streak", color: "#FF6B35" },
          { val: flexDaysThisMonth, label: "Flex Days", color: flexDaysThisMonth > 4 ? "#FF4444" : flexDaysThisMonth > 0 ? "#FFB800" : "#555" },
        ].map(s => (
          <div key={s.label} className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-2 sm:p-3 flex flex-col items-center">
            <span className="text-base sm:text-xl font-black leading-none" style={{ color: s.color }}>{s.val}</span>
            <span className="text-[8px] sm:text-[10px] text-[#555] mt-1 uppercase tracking-wide text-center leading-tight">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar card */}
      {totalWorkoutDaysInMonth > 0 && (
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-3 sm:p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-white">
              {adherence === 100 ? `🏆 ${t("adherence_perfect_month")}`
                : adherence >= 80 ? `🔥 ${t("adherence_crushing")}`
                : adherence >= 60 ? `💪 ${t("adherence_strong_month")}`
                : adherence >= 40 ? `🎯 ${t("adherence_good_effort")}`
                : completedDaysInMonth > 0 ? `🌱 ${t("adherence_started")}`
                : `🌅 ${t("adherence_fresh_month")}`}
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: adherence >= 80 ? "var(--giq-accent)" : adherence >= 50 ? "#fb923c" : "#f87171" }}>
              {completedDaysInMonth}/{totalWorkoutDaysInMonth}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(adherence, 100)}%`, backgroundColor: adherence >= 80 ? "var(--giq-accent)" : adherence >= 50 ? "#fb923c" : "#f87171" }} />
          </div>
          {flexDaysThisMonth > 0 && (
            <p className="text-[10px] mt-2" style={{ color: flexDaysThisMonth > 4 ? "#FF4444" : "#FFB800" }}>
              😋 {flexDaysThisMonth} Flex Days
              {flexDaysThisMonth > 4
                ? ` — ⚠️ ${isES ? "has superado el límite mensual" : "over monthly limit"}`
                : ` — ${isES ? `queda${4 - flexDaysThisMonth === 1 ? "" : "n"} ${4 - flexDaysThisMonth} más` : `${4 - flexDaysThisMonth} left`}`}
            </p>
          )}
        </div>
      )}

      {/* Best week banner */}
      {bestWeekStart && bestWeekCount >= 3 && (
        <div className="bg-[#88ee2208] border border-[#88ee2220] rounded-xl p-3 mb-3 flex items-center gap-3">
          <span className="text-lg shrink-0">🏆</span>
          <div>
            <p className="text-xs font-bold" style={{ color: "var(--giq-accent)" }}>
              {isES ? "Mejor semana" : "Best week"}: {format(new Date(bestWeekStart), isES ? "d MMM" : "MMM d", { locale: isES ? es : undefined })} – {format(new Date(new Date(bestWeekStart).getTime() + 6 * 86400000), isES ? "d MMM" : "MMM d", { locale: isES ? es : undefined })}
            </p>
            <p className="text-[10px] text-[#555]">{bestWeekCount} {isES ? "entrenos completados" : "workouts completed"}</p>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-[#141414] rounded-xl border border-[#1f1f1f] overflow-hidden mb-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#1f1f1f]">
          {DAY_HEADER_KEYS.map(key => (
            <div key={key} className="text-center py-2 text-[9px] sm:text-[10px] font-bold text-[#555] uppercase tracking-wide">
              {t(key).substring(0, 2)}
            </div>
          ))}
        </div>

        {/* Day cells — grouped by week rows */}
        {(() => {
          const weeks: (Date | null)[][] = [];
          for (let i = 0; i < calendarDays.length; i += 7) {
            weeks.push(calendarDays.slice(i, i + 7));
          }
          return weeks.map((week, wi) => {
            // Determine if this is the best week
            const firstReal = week.find(d => d !== null) as Date | undefined;
            const weekMonday = firstReal ? (() => {
              const d = new Date(firstReal);
              d.setDate(d.getDate() - ((getDay(d) + 6) % 7));
              return format(d, "yyyy-MM-dd");
            })() : null;
            const isBestWeek = weekMonday === bestWeekStart && bestWeekCount >= 3;

            // Streak dates set
            const streakDates = new Set<string>();
            if (currentStreak > 0) {
              let d = new Date(today);
              for (let s = 0; s < currentStreak + 10; s++) {
                const ds = format(d, "yyyy-MM-dd");
                const dn = DAY_NAME_MAP[getDay(d) as keyof typeof DAY_NAME_MAP];
                if (trainingDays.has(dn) && logMap[ds] === true) {
                  streakDates.add(ds);
                }
                d = new Date(d.getTime() - 86400000);
                if (streakDates.size >= currentStreak) break;
              }
            }

            return (
              <div key={wi} className="grid grid-cols-7" style={isBestWeek ? { background: "rgba(136,238,34,0.04)" } : {}}>
                {week.map((day, di) => {
                  if (!day) return <div key={`e-${wi}-${di}`} className="aspect-square border-r border-b border-[#1f1f1f] bg-[#0d0d0d]" />;

                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayName = DAY_NAME_MAP[getDay(day) as keyof typeof DAY_NAME_MAP];
                  const isPastDay = isBefore(startOfDay(day), today);
                  const isTodayDate = isToday(day);
                  const isWorkoutDay = trainingDays.has(dayName);
                  const completed = logMap[dateStr] === true;
                  const isFlexDay = flexSet.has(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isFuture = !isPastDay && !isTodayDate;
                  const isInStreak = streakDates.has(dateStr) || (isTodayDate && completed);
                  const isFlexOver = isFlexDay && flexDaysThisMonth > 4;
                  const canInteract = isWorkoutDay || completed || isFlexDay || isTodayDate || !isFuture;
                  const hasWeight = weightDates.has(dateStr);

                  let bg = "transparent";
                  let textColor = "#333";
                  let borderBottom = "1px solid #1f1f1f";

                  if (isTodayDate && !isSelected) { bg = "var(--giq-accent)"; textColor = "var(--giq-accent-text)"; }
                  else if (isSelected) { bg = "color-mix(in srgb, var(--giq-accent) 25%, transparent)"; textColor = "var(--giq-accent)"; }
                  else if (isFlexOver) { bg = "rgba(255,68,68,0.08)"; textColor = "#FF4444"; }
                  else if (isFlexDay) { bg = "rgba(255,184,0,0.1)"; textColor = "#FFB800"; }
                  else if (completed) { bg = "rgba(136,238,34,0.1)"; textColor = "var(--giq-accent)"; }
                  else if (isWorkoutDay && !isFuture) { textColor = "#444"; }
                  else if (isWorkoutDay && isFuture) { bg = "rgba(136,238,34,0.05)"; textColor = "rgba(136,238,34,0.4)"; }

                  if (isInStreak) borderBottom = "2px solid rgba(136,238,34,0.4)";

                  return (
                    <div
                      key={dateStr}
                      className="aspect-square border-r border-[#1f1f1f] flex flex-col items-center justify-center relative cursor-pointer transition-all"
                      style={{ background: bg, color: textColor, borderBottom, outline: isSelected ? "2px solid rgba(255,255,255,0.3)" : "none", outlineOffset: "-2px" }}
                      onClick={() => canInteract && (setSelectedDate(isSelected ? null : dateStr), setSelectedAction(null))}
                    >
                      <span className="text-[11px] sm:text-xs font-semibold leading-none">{format(day, "d")}</span>
                      {/* Status icon */}
                      {isWorkoutDay && completed && <CheckCircle2 className="w-2.5 h-2.5 mt-0.5" />}
                      {isWorkoutDay && !completed && isPastDay && !isFlexDay && <Circle className="w-2 h-2 mt-0.5 opacity-30" />}
                      {isFlexDay && <span style={{ fontSize: 8, marginTop: 1 }}>😋</span>}
                      {/* Weight dot */}
                      {hasWeight && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#7B8CDE]" />}
                      {/* Eye button */}
                      {isWorkoutDay && completed && historyMap[dateStr] && (
                        <button
                          className="absolute top-0.5 right-0.5 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); setHistoryModalRecord(historyMap[dateStr]); }}
                        >
                          <Eye className="w-2.5 h-2.5" style={{ color: "var(--giq-accent)" }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3 px-1">
        {[
          { color: "var(--giq-accent)", label: isES ? "Completado" : "Completed" },
          { color: "#FFB800", label: "Flex Day" },
          { color: "#FF4444", label: isES ? "Flex (+límite)" : "Flex (over limit)" },
          { color: "#7B8CDE", label: isES ? "Peso registrado" : "Weight logged" },
          { isStreak: true, label: isES ? "Racha activa" : "Active streak" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            {l.isStreak
              ? <div className="w-3 h-1 rounded-full bg-[#88ee2250]" />
              : <div className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />}
            <span className="text-[9px] sm:text-[10px] text-[#555]">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Action panel */}
      {selectedDate && (
        <div ref={panelRef} className="bg-[#141414] rounded-xl border border-[#1f1f1f] overflow-hidden mb-3">
          <div className="px-4 pt-3 pb-2 border-b border-[#1f1f1f]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#555] text-center">
              {isES
                ? format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })
                : format(parseISO(selectedDate), "EEEE, MMMM d")}
            </p>
          </div>
          <div className="p-3 space-y-2">
            {showWorkoutOption && (
              <button
                type="button"
                onClick={() => setSelectedAction(selectedAction === "workout" ? null : "workout")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{
                  background: selectedAction === "workout" ? "color-mix(in srgb, var(--giq-accent) 10%, transparent)" : "var(--giq-bg-secondary)",
                  border: `1.5px solid ${selectedAction === "workout" ? "var(--giq-accent)" : "var(--giq-border)"}`,
                }}
              >
                <span className="text-lg shrink-0">{selectedDateCompleted ? "↩️" : "✅"}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold" style={{ color: selectedAction === "workout" ? "var(--giq-accent)" : "var(--giq-text-primary)" }}>
                    {selectedDateCompleted ? (isES ? "Deshacer entreno" : "Undo workout") : (isES ? "Marcar como completado" : "Mark as completed")}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                    {selectedDateCompleted ? (isES ? "Quitar el registro de hoy" : "Remove today's log") : (isES ? "Registrar entreno completado" : "Log completed workout")}
                  </p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: selectedAction === "workout" ? "var(--giq-accent)" : "var(--giq-border)", background: selectedAction === "workout" ? "var(--giq-accent)" : "transparent" }}>
                  {selectedAction === "workout" && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                </div>
              </button>
            )}
            {showFlexOption && (
              <button
                type="button"
                onClick={() => setSelectedAction(selectedAction === "flex" ? null : "flex")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{
                  background: selectedAction === "flex" ? "rgba(255,184,0,0.08)" : "var(--giq-bg-secondary)",
                  border: `1.5px solid ${selectedAction === "flex" ? "#FFB800" : "var(--giq-border)"}`,
                }}
              >
                <span className="text-lg shrink-0">😋</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold" style={{ color: selectedAction === "flex" ? "#FFB800" : "var(--giq-text-primary)" }}>
                    {selectedDateIsFlexDay ? `Flex Day ↩` : "Flex Day"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: flexDaysThisMonth >= 4 && !selectedDateIsFlexDay ? "#FF4444" : "var(--giq-text-muted)" }}>
                    {flexDaysThisMonth >= 4 && !selectedDateIsFlexDay
                      ? (isES ? "⚠️ Límite mensual alcanzado" : "⚠️ Monthly limit reached")
                      : t("flex_day_desc")}
                  </p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: selectedAction === "flex" ? "#FFB800" : "var(--giq-border)", background: selectedAction === "flex" ? "#FFB800" : "transparent" }}>
                  {selectedAction === "flex" && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                </div>
              </button>
            )}
          </div>
          <div className="flex gap-2 px-3 pb-3">
            <button type="button" onClick={() => { setSelectedDate(null); setSelectedAction(null); }} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#666" }}>
              {t("cancel")}
            </button>
            <button type="button" onClick={handleConfirm} disabled={!selectedAction} className="rounded-xl py-2.5 text-sm font-bold transition-all" style={{ flex: 2, background: selectedAction ? "var(--giq-accent)" : "#1a1a1a", color: selectedAction ? "var(--giq-accent-text)" : "#444", border: "none", opacity: selectedAction ? 1 : 0.5 }}>
              {t("confirm")}
            </button>
          </div>
        </div>
      )}

      {/* Streak card — shown when streak >= 2 */}
      {currentStreak >= 2 && (
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 flex items-center gap-4">
          <span className="text-4xl font-black leading-none" style={{ color: "var(--giq-accent)" }}>{currentStreak}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{isES ? "días de racha" : "day streak"} 🔥</p>
            <p className="text-xs text-[#555] mt-0.5">{isES ? "¡Sigue así, lo estás haciendo genial!" : "Keep it up, you're doing great!"}</p>
          </div>
        </div>
      )}

    </div>
  );
}
