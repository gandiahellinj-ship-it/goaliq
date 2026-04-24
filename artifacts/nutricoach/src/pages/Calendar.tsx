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
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Dumbbell, Eye, X } from "lucide-react";
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
  const isoWeeksInMonth = new Set(daysInMonth.map(d => getISOWeekStart(d))).size;

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

  // ── Feedback ───────────────────────────────────────────────────────────────

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
        msg: t("clean_weeks", { n: isoWeeksInMonth, s: isoWeeksInMonth !== 1 ? "s" : "" }),
        highlight: true,
      };
    }
    if (flexDaysThisMonth > 0) {
      return {
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-28 overflow-x-hidden">

      {/* ── Header: month nav ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-display font-black uppercase text-white">📅 {t("nav_calendar")}</h1>
        </div>
        <div className="flex items-center gap-2 bg-[#141414] border border-[#1f1f1f] rounded-xl px-1 py-1 self-start sm:self-auto">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#A0A0A0]" />
          </button>
          <span className="font-bold text-white text-sm min-w-[120px] text-center capitalize">
            {currentDate.toLocaleDateString(isES ? "es-ES" : "en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#A0A0A0]" />
          </button>
        </div>
      </div>

      {/* ── CHANGE 1: Stats strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Workouts done */}
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-3 flex flex-col items-center">
          <div className="tabular-nums font-black text-white leading-none">
            <span className="text-xl sm:text-2xl">{completedDaysInMonth}</span>
            <span className="text-sm font-normal text-[#555]">/{totalWorkoutDaysInMonth}</span>
          </div>
          <span className="text-[10px] text-[#555] mt-1 uppercase tracking-wide text-center leading-tight">
            {t("workouts_done_label")}
          </span>
        </div>

        {/* Adherence */}
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-3 flex flex-col items-center">
          <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${
            adherence >= 80 ? "text-[#AAFF45]" : adherence >= 50 ? "text-orange-400" : totalWorkoutDaysInMonth === 0 ? "text-[#555]" : "text-red-400"
          }`}>
            {adherence}%
          </span>
          <span className="text-[10px] text-[#555] mt-1 uppercase tracking-wide text-center leading-tight">
            {t("adherence_label")}
          </span>
        </div>

        {/* Flex days */}
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-3 flex flex-col items-center">
          <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${
            flexDaysThisMonth > 4 ? "text-red-400" : flexDaysThisMonth > 0 ? "text-[#FFB800]" : "text-[#555]"
          }`}>
            {flexDaysThisMonth}
          </span>
          <span className="text-[10px] text-[#555] mt-1 uppercase tracking-wide text-center leading-tight">
            😋 {t("flex_day")}
          </span>
        </div>
      </div>

      {/* ── CHANGE 2: Progress bar card ───────────────────────────────────────── */}
      {totalWorkoutDaysInMonth > 0 && (
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">{adherenceFeedback?.emoji ?? "🎯"}</span>
              <span className="text-sm font-medium text-white truncate">{adherenceFeedback?.msg ?? ""}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ml-2 ${
              adherence >= 80 ? "text-[#AAFF45]" : adherence >= 50 ? "text-orange-400" : "text-red-400"
            }`}>
              {completedDaysInMonth}/{totalWorkoutDaysInMonth}
            </span>
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
          {flexFeedback && (
            <p className={`text-xs mt-2.5 ${flexFeedback.highlight ? "text-[#AAFF45]" : "text-[#A0A0A0]"}`}>
              😋 {flexFeedback.msg}
            </p>
          )}
        </div>
      )}

      {/* ── CHANGE 3: Calendar grid in #141414 card ───────────────────────────── */}
      <div className="bg-[#141414] rounded-xl border border-[#1f1f1f] overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-[#1f1f1f]">
          {DAY_HEADER_KEYS.map(key => (
            <div key={key} className="text-center py-2.5 text-[10px] sm:text-xs font-bold text-[#555555] uppercase tracking-wide">
              {t(key).substring(0, 2)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="aspect-square border-b border-r border-[#1f1f1f] bg-[#0d0d0d]/40" />;
            }

            const dateStr = format(day, "yyyy-MM-dd");
            const dayName = DAY_NAME_MAP[getDay(day)];
            const isWorkoutDay = trainingDays.has(dayName);
            const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
            const isTodayDate = isToday(day);
            const completed = logMap[dateStr] === true;
            const isFlexDay = flexSet.has(dateStr);
            const isSelected = dateStr === selectedDate;

            // A day is interactive if it's a training day, completed, flex day, today, or future
            const canInteract = isWorkoutDay || completed || isFlexDay || isTodayDate || !isPast;

            return (
              <div
                key={dateStr}
                className={`aspect-square border-b border-r border-[#1f1f1f] flex flex-col items-center justify-center relative transition-all
                  ${!isSelected && isTodayDate ? "bg-[#AAFF45]" : ""}
                  ${!isSelected && !isTodayDate && isFlexDay ? "bg-[#AAFF45]/10" : ""}
                  ${!isSelected && !isTodayDate && isWorkoutDay && !completed && !isFlexDay ? "bg-[#AAFF45]/10" : ""}
                  ${!isSelected && !isTodayDate && completed ? "bg-[#AAFF45]/15" : ""}
                  ${canInteract ? "cursor-pointer" : "cursor-default"}
                `}
                style={isSelected ? {
                  backgroundColor: "color-mix(in srgb, var(--giq-accent) 8%, var(--giq-bg-card))",
                  outline: "2px solid var(--giq-accent)",
                  outlineOffset: "-2px",
                } : {}}
                onClick={() => {
                  if (!canInteract) return;
                  setSelectedDate(dateStr === selectedDate ? null : dateStr);
                  setSelectedAction(null);
                }}
              >
                {/* Date number */}
                <span
                  className={`text-sm font-bold leading-none mb-0.5 ${
                    isSelected ? "text-[#AAFF45]"
                    : isTodayDate ? "text-[#0A0A0A]"
                    : isWorkoutDay ? "text-[#AAFF45]"
                    : "text-[#555555]"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Workout status icons */}
                {isWorkoutDay && completed && (
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isTodayDate && !isSelected ? "text-[#0A0A0A]" : "text-[#AAFF45]"}`} />
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

                {/* 😋 Flex Day indicator */}
                {isFlexDay && (
                  <span className="leading-none mt-0.5" style={{ fontSize: 9 }}>😋</span>
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

      {/* ── CHANGE 4: Compact legend below calendar ───────────────────────────── */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 mb-4 px-1 text-[10px] text-[#555] font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#AAFF45]" />
          {t("completed_label")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#AAFF45]/20 border border-[#AAFF45]/40" />
          {t("planned_workout")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A] border border-[#3A3A3A]" />
          {t("rest_day")}
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10 }}>😋</span>
          {t("flex_day")}
        </div>
      </div>

      {/* ── CHANGE 5: Improved day detail panel ──────────────────────────────── */}
      {selectedDate && (
        <div
          ref={panelRef}
          className="mt-2 bg-[#141414] rounded-xl border border-[#1f1f1f] overflow-hidden"
        >
          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-[#1f1f1f]">
            <p className="text-xs font-bold text-center capitalize text-[#555]">
              {isES
                ? format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })
                : format(parseISO(selectedDate), "EEEE, MMMM d")}
            </p>
          </div>

          {/* Action rows */}
          <div className="p-3 space-y-2">
            {/* Workout row */}
            {showWorkoutOption && (
              <button
                type="button"
                onClick={() => setSelectedAction(selectedAction === "workout" ? null : "workout")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{
                  background: selectedAction === "workout"
                    ? "color-mix(in srgb, var(--giq-accent) 10%, transparent)"
                    : "var(--giq-bg-secondary)",
                  border: selectedAction === "workout"
                    ? "1.5px solid var(--giq-accent)"
                    : "1.5px solid var(--giq-border)",
                }}
              >
                <span className="text-xl shrink-0">{selectedDateCompleted ? "↩️" : "✅"}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold" style={{ color: selectedAction === "workout" ? "var(--giq-accent)" : "var(--giq-text-primary)" }}>
                    {selectedDateCompleted ? t("cancel") : t("completed_label")}
                  </p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                    {selectedDateCompleted ? t("mark_as_done") + " ↩" : t("mark_as_done")}
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: selectedAction === "workout" ? "var(--giq-accent)" : "var(--giq-border)",
                    background: selectedAction === "workout" ? "var(--giq-accent)" : "transparent",
                  }}
                >
                  {selectedAction === "workout" && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                </div>
              </button>
            )}

            {/* Flex Day row */}
            {showFlexOption && (
              <button
                type="button"
                onClick={() => setSelectedAction(selectedAction === "flex" ? null : "flex")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{
                  background: selectedAction === "flex" ? "rgba(255,184,0,0.08)" : "var(--giq-bg-secondary)",
                  border: selectedAction === "flex" ? "1.5px solid #FFB800" : "1.5px solid var(--giq-border)",
                }}
              >
                <span className="text-xl shrink-0">😋</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold" style={{ color: selectedAction === "flex" ? "#FFB800" : "var(--giq-text-primary)" }}>
                    {selectedDateIsFlexDay ? `${t("flex_day")} ↩` : t("flex_day")}
                  </p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                    {t("flex_day_desc")}
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: selectedAction === "flex" ? "#FFB800" : "var(--giq-border)",
                    background: selectedAction === "flex" ? "#FFB800" : "transparent",
                  }}
                >
                  {selectedAction === "flex" && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                </div>
              </button>
            )}
          </div>

          {/* Confirm / Cancel buttons */}
          <div className="flex gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={() => { setSelectedDate(null); setSelectedAction(null); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "var(--giq-border)", color: "var(--giq-text-muted)" }}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedAction}
              className="py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{
                flex: 2,
                background: selectedAction ? "var(--giq-accent)" : "var(--giq-border)",
                color: selectedAction ? "#0a0a0a" : "var(--giq-text-muted)",
                cursor: selectedAction ? "pointer" : "not-allowed",
              }}
            >
              {t("confirm")}
            </button>
          </div>
        </div>
      )}

      {historyModalRecord && (
        <WorkoutHistoryModal
          record={historyModalRecord}
          onClose={() => setHistoryModalRecord(null)}
        />
      )}
    </div>
  );
}
