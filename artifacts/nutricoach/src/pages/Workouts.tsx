import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkoutPlan, useGenerateWorkoutPlan, useStrengthLogs, useSaveStrengthLog } from "@/lib/supabase-queries";
import type { Exercise } from "@/lib/supabase-queries";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Timer, Repeat, Zap, X, ArrowRight, Dumbbell } from "lucide-react";
import { TrialGate } from "@/components/TrialGate";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { useT, useLanguage, translateDay } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { ShareWorkoutButton, ShareRestDayButton } from "@/components/ShareWorkoutCard";

type ExerciseImages = { imageStart: string | null; imageEnd: string | null; isGif?: boolean; equipment?: string };

async function fetchExerciseImages(name: string, lang: string = "en", exerciseId?: string | null): Promise<ExerciseImages> {
  // If we have an exact exercise_id from WorkoutX, skip name search entirely
  if (exerciseId) {
    return { imageStart: `/api/workoutx/gif/${exerciseId}`, imageEnd: null, isGif: true };
  }

  try {
    const res = await fetch(`/api/workoutx/exercise?name=${encodeURIComponent(name)}&lang=${lang}`);
    if (res.ok) {
      const data = await res.json();
      if (data.gifUrl) {
        const gifId = data.gifUrl.split("/gifs/")[1]?.replace(".gif", "");
        const proxyUrl = gifId ? `/api/workoutx/gif/${gifId}` : null;
        if (proxyUrl) return { imageStart: proxyUrl, imageEnd: null, isGif: true, equipment: data.equipment ?? undefined };
      }
    }
  } catch (err) {
    console.error("[WorkoutX] error:", err);
  }
  return { imageStart: null, imageEnd: null, isGif: false };
}

function useExerciseImages(name: string, lang: string = "en", exerciseId?: string | null) {
  return useQuery<ExerciseImages>({
    queryKey: ["exercise-images-wx", exerciseId ?? name.toLowerCase(), lang],
    queryFn: () => fetchExerciseImages(name, lang, exerciseId),
    staleTime: Infinity,
    retry: 1,
  });
}

// ── Muscle name translation ────────────────────────────────────────────────────

const MUSCLE_TRANSLATIONS: Record<string, string> = {
  "quads": "Cuádriceps",
  "quadriceps": "Cuádriceps",
  "glutes": "Glúteos",
  "glute": "Glúteos",
  "hamstrings": "Isquiotibiales",
  "calves": "Gemelos",
  "calf": "Gemelos",
  "pectorals": "Pectoral",
  "pectoral": "Pectoral",
  "chest": "Pecho",
  "lats": "Dorsales",
  "upper back": "Espalda alta",
  "lower back": "Lumbares",
  "traps": "Trapecios",
  "trapezius": "Trapecios",
  "delts": "Deltoides",
  "delt": "Deltoides",
  "deltoids": "Deltoides",
  "shoulders": "Hombros",
  "biceps": "Bíceps",
  "triceps": "Tríceps",
  "abs": "Abdominales",
  "obliques": "Oblicuos",
  "forearms": "Antebrazos",
  "adductors": "Aductores",
  "abductors": "Abductores",
  "quad": "Cuádriceps",
  "hip flexors": "Flexores de cadera",
  "serratus anterior": "Serrato anterior",
  "rhomboids": "Romboides",
  "spine": "Columna",
  "neck": "Cuello",
};

function translateMuscle(muscle: string, lang: string): string {
  if (lang !== "es") return muscle;
  return MUSCLE_TRANSLATIONS[muscle.toLowerCase().trim()] ?? muscle;
}

function translateMuscles(muscles: string, lang: string): string {
  if (!muscles) return muscles;
  return muscles
    .split(/[,·]/)
    .map(m => translateMuscle(m.trim(), lang))
    .join(" · ");
}

function equipmentTKey(equipment: string): string {
  const map: Record<string, string> = {
    "barbell": "eq_barbell",
    "dumbbell": "eq_dumbbell",
    "cable": "eq_cable",
    "body weight": "eq_body_weight",
    "kettlebell": "eq_kettlebell",
    "resistance band": "eq_resistance_band",
    "leverage machine": "eq_machine",
    "smith machine": "eq_smith_machine",
    "ez barbell": "eq_barbell",
    "assisted": "eq_machine",
  };
  return map[equipment.toLowerCase()] ?? "eq_machine";
}

function estimateDuration(exercises: Exercise[]): number {
  if (!exercises || exercises.length === 0) return 0;
  let totalSeconds = 0;
  for (const ex of exercises) {
    const sets = ex.sets ?? 3;
    const restSec = (ex as any).rest_seconds ?? ex.rest_sec ?? 60;
    totalSeconds += sets * 45 + sets * restSec;
  }
  const totalMinutes = Math.round((totalSeconds / 60 + 10) / 5) * 5;
  return Math.max(totalMinutes, 20);
}

const DAYS = [
  { id: "monday" },
  { id: "tuesday" },
  { id: "wednesday" },
  { id: "thursday" },
  { id: "friday" },
  { id: "saturday" },
  { id: "sunday" },
];

const WORKOUT_TYPE_LABELS: Record<string, { tKey: string; emoji: string; color: string }> = {
  cardio:          { tKey: "wt_cardio",    emoji: "🏃", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  hiit:            { tKey: "wt_hiit",      emoji: "⚡", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  circuit:         { tKey: "wt_circuit",   emoji: "🔄", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  strength_upper:  { tKey: "wt_upper",     emoji: "💪", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  strength_lower:  { tKey: "wt_lower",     emoji: "🦵", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  full_body:       { tKey: "wt_full",      emoji: "🏋️", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  push_day:        { tKey: "wt_push",      emoji: "🤜", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  pull_day:        { tKey: "wt_pull",      emoji: "🤛", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  leg_day:         { tKey: "wt_legs",      emoji: "🦵", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" },
  core_day:        { tKey: "wt_core",      emoji: "🎯", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  cardio_day:      { tKey: "wt_cardio_day",emoji: "🏃", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
}

export default function Workouts() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_workout_plan")} pageEmoji="💪">
      <WorkoutsContent />
    </TrialGate>
  );
}


function WorkoutsContent() {
  const { data: workoutPlan, isLoading } = useWorkoutPlan();
  const generateMutation = useGenerateWorkoutPlan();
  const hasTriggeredRegen = useRef(false);
  const t = useT();
  const { lang } = useLanguage();

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const defaultDay = DAYS.find(d => d.id === todayName)?.id ?? "monday";

  // Effect: auto-regen when no plan or missing exercise_ids
  useEffect(() => {
    if (isLoading || hasTriggeredRegen.current || generateMutation.isPending) return;

    const needsRegen = !workoutPlan || (workoutPlan.days ?? []).some(day =>
      day.workout?.exercises?.some((ex: any) => !ex.exercise_id)
    );

    if (needsRegen) {
      hasTriggeredRegen.current = true;
      generateMutation.mutate({ lang });
    }
  }, [workoutPlan, isLoading]);

  const [activeDay, setActiveDay] = useState(defaultDay);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--giq-accent)" }} />
      </div>
    );
  }

  if (!workoutPlan) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <Dumbbell className="w-16 h-16 mb-5" style={{ color: "var(--giq-accent)" }} />
        <h2 className="text-2xl font-display font-black uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>{t("no_workout_plan")}</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--giq-text-secondary)" }}>
          {t("complete_onboarding_workout")}
        </p>
      </div>
    );
  }

  const activeDayData = workoutPlan.days.find(d => d.day === activeDay);
  const isTrainingDay = !activeDayData?.isRestDay;

  return (
    <div className="px-3 py-4 sm:p-7 lg:p-10 max-w-4xl mx-auto pb-32">

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-black uppercase flex items-center gap-2" style={{ color: "var(--giq-text-primary)" }}>
            <Dumbbell className="w-6 h-6" style={{ color: "var(--giq-accent)" }} /> {t("weekly_training_title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--giq-text-muted)" }}>
            {t("training_days_count", { n: workoutPlan.trainingDays.size })}
          </p>
        </div>
      </div>

      {/* Day Tabs — 7-column grid, fits all screen sizes */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-4 sm:mb-6">
        {DAYS.map(day => {
          const isToday = day.id === todayName;
          const isActive = day.id === activeDay;
          const isTraining = workoutPlan.trainingDays.has(day.id);
          const dayWorkout = workoutPlan.days.find(d => d.day === day.id)?.workout;
          const duration = isTraining && dayWorkout
            ? (dayWorkout.duration_minutes ?? estimateDuration(dayWorkout.exercises))
            : null;
          return (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className="flex flex-col items-center px-0 py-1.5 sm:px-3 sm:py-2 rounded-lg font-semibold transition-all relative"
              style={
                isActive
                  ? { backgroundColor: "var(--giq-accent)", color: "var(--giq-accent-text)" }
                  : isTraining
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--giq-accent) 10%, transparent)",
                      color: "var(--giq-accent)",
                      border: "1px solid color-mix(in srgb, var(--giq-accent) 20%, transparent)",
                    }
                  : {
                      backgroundColor: "var(--giq-bg-card)",
                      color: "var(--giq-text-muted)",
                      border: "1px solid var(--giq-border)",
                    }
              }
            >
              <span className="w-full text-center text-[10px] sm:text-xs leading-none">
                {translateDay(day.id, t).substring(0, 2)}
              </span>
              {/* Training/rest dot indicator on mobile */}
              <span
                className="block sm:hidden w-1.5 h-1.5 rounded-full mt-0.5"
                style={{ backgroundColor: isTraining ? "var(--giq-accent)" : "transparent" }}
              />
              {/* Duration / rest label on sm+ */}
              {isTraining && duration ? (
                <span
                  className="hidden sm:block font-bold leading-none mt-0.5 text-[9px] sm:text-xs"
                  style={{ color: isActive ? "color-mix(in srgb, var(--giq-accent-text) 60%, transparent)" : "var(--giq-accent)" }}
                >
                  {duration}'
                </span>
              ) : !isTraining ? (
                <span className="hidden sm:block leading-none mt-0.5 text-[9px] sm:text-xs" style={{ color: "var(--giq-text-muted)" }}>
                  {t("rest_short")}
                </span>
              ) : null}
              {isToday && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full"
                  style={{
                    backgroundColor: isActive ? "color-mix(in srgb, var(--giq-accent-text) 30%, transparent)" : "var(--giq-accent)",
                    border: "2px solid var(--giq-bg-primary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {!isTrainingDay ? (
            <div className="rounded-lg p-8 text-center flex flex-col items-center" style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}>
              <div className="text-5xl mb-4">🧘</div>
              <h2 className="text-xl font-display font-bold uppercase mb-2" style={{ color: "var(--giq-text-primary)" }}>{t("rest_recover")}</h2>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: "var(--giq-text-secondary)" }}>
                {t("rest_recover_msg")}
              </p>
              {activeDay === todayName && (
                <div className="mt-6">
                  <ShareRestDayButton />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeDayData?.workout && (
                <WorkoutBanner
                  workoutType={activeDayData.workout.workout_type}
                  exerciseCount={activeDayData.workout.exercises.length}
                  notes={activeDayData.workout.notes}
                  isToday={activeDay === todayName}
                />
              )}

              {activeDayData?.workout?.exercises.map((ex, i) => (
                <ExerciseCard key={i} exercise={ex} index={i} />
              ))}

              {activeDay === todayName && activeDayData?.workout && (
                <ShareWorkoutButton workout={activeDayData.workout} />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const MOTIVATIONAL_QUOTES: Record<string, string[]> = {
  cardio: [
    "Every step is progress. Pace yourself and finish strong.",
    "Cardio builds your engine — fuel it, and it'll carry you anywhere.",
    "Breathe. Move. Repeat. You've got this.",
  ],
  hiit: [
    "Short, intense, effective. Give it everything you've got.",
    "HIIT is hard for a reason — that's exactly why it works.",
    "Push hard. Rest. Repeat. Each interval makes you stronger.",
  ],
  circuit: [
    "Circuit training builds strength and endurance at once — efficient and effective.",
    "Keep moving between stations. Your body adapts when you challenge it.",
    "One station at a time. Finish what you started.",
  ],
  strength_upper: [
    "Focus on form today — quality reps build lasting strength.",
    "Upper body day: posture, power, and control.",
    "Strong shoulders and arms start with consistency, not luck.",
  ],
  strength_lower: [
    "Your legs carry you through life — train them well.",
    "Lower body strength is the foundation of everything athletic.",
    "Drive through your heels. Engage your core. Finish each rep with control.",
  ],
  full_body: [
    "A full-body session is a complete investment in yourself.",
    "Work every muscle, every rep, every set. Total effort.",
    "Full body = full commitment. You showed up — now give it your all.",
  ],
};

function getMotivationalQuote(workoutType: string): string {
  const quotes = MOTIVATIONAL_QUOTES[workoutType] ?? [
    "Show up, do the work, and the results will follow.",
    "Progress is progress — no matter the pace.",
    "Every rep is a vote for the person you want to become.",
  ];
  return quotes[new Date().getDate() % quotes.length];
}

function WorkoutBanner({
  workoutType,
  exerciseCount,
  notes,
  isToday,
}: {
  workoutType: string;
  exerciseCount: number;
  notes: string;
  isToday: boolean;
}) {
  const t = useT();
  const meta = WORKOUT_TYPE_LABELS[workoutType] ?? { tKey: workoutType, emoji: "🎯", color: "bg-[#AAFF45]/10 text-[#AAFF45] border-[#AAFF45]/20" };
  const quote = getMotivationalQuote(workoutType);
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{meta.emoji}</span>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--giq-accent)" }}>
            {isToday ? t("todays_focus") : t("session_focus")}
          </p>
          <p className="font-bold" style={{ color: "var(--giq-text-primary)" }}>{t(meta.tKey)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "var(--giq-text-muted)" }}>{t("exercises_label")}</p>
          <p className="font-bold" style={{ color: "var(--giq-text-primary)" }}>{exerciseCount}</p>
        </div>
      </div>
      {notes && (
        <p
          className="text-xs rounded-lg px-3 py-2 leading-relaxed"
          style={{
            color: "var(--giq-text-secondary)",
            backgroundColor: "color-mix(in srgb, var(--giq-accent) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--giq-accent) 10%, transparent)",
          }}
        >{notes}</p>
      )}
      {isToday && (
        <p className="text-xs italic leading-relaxed pt-3" style={{ color: "var(--giq-text-muted)", borderTop: "1px solid var(--giq-border)" }}>
          💬 "{quote}"
        </p>
      )}
    </div>
  );
}

function ExerciseImg({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="object-cover rounded-[6px]"
      style={{ width: size, height: size }}
    />
  );
}

function ExercisePair({
  imageStart,
  imageEnd,
  name,
  size = 60,
}: {
  imageStart: string;
  imageEnd: string;
  name: string;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <ExerciseImg src={imageStart} alt={`${name} start`} size={size} />
      <ArrowRight
        className="shrink-0"
        style={{ width: 14, height: 14, color: "var(--giq-accent)" }}
      />
      <ExerciseImg src={imageEnd} alt={`${name} end`} size={size} />
    </div>
  );
}

function ExerciseModal({
  name,
  imageStart,
  imageEnd,
  isGif = false,
  onClose,
}: {
  name: string;
  imageStart: string;
  imageEnd: string;
  isGif?: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-5 rounded-xl p-6"
        style={{ background: "var(--giq-bg-card)", border: "1px solid var(--giq-border)", maxWidth: 320, width: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 transition-colors"
          style={{ color: "var(--giq-text-muted)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-sm font-semibold text-center leading-snug pr-4" style={{ color: "var(--giq-text-primary)" }}>
          {name}
        </p>

        {isGif ? (
          <img
            src={imageStart}
            alt={name}
            style={{ width: 240, height: 240, borderRadius: 12, objectFit: "cover" }}
          />
        ) : (
          <>
            <ExercisePair
              imageStart={imageStart}
              imageEnd={imageEnd}
              name={name}
              size={120}
            />
            <div className="flex justify-between w-full text-xs px-1" style={{ color: "var(--giq-text-muted)" }}>
              <span>{t("start")}</span>
              <span>{t("end")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ── Auto-detect exercise type from name when field is missing ─────────────────
function detectExerciseType(name: string): "strength" | "cardio" | "bodyweight" | "timed" {
  const n = name.toLowerCase();
  if (/plank|dead.?hang|wall.?sit|l.?sit|hollow.?hold|superman.?hold|isometric|aguantar|sostener/.test(n)) return "timed";
  if (/correr|running|cycling|cardio|bici|remo|rowing|saltar|jump rope|burpee|sprint|box jump|mountain climb|jumping jack/.test(n)) return "cardio";
  if (/press|curl|row(?! your)|pull(?!up|-up)|deadlift|squat with|sentadilla con|mancuerna|barbell|cable|machine|kettlebell|lat pulldown|leg press/.test(n)) return "strength";
  if (/push.?up|pull.?up|lunge|dip|crunch|abs|squat(?! with| con)/.test(n)) return "bodyweight";
  return "strength"; // safe default
}

// Parse target seconds from reps strings like "40 segundos", "45 seconds", "30-45 sec"
function parseTargetSeconds(reps: string | number | undefined): number {
  if (!reps) return 30;
  const str = String(reps);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 30;
}

function NumericInput({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  active,
  optional,
  optionalLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  active?: boolean;
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-1 mb-1.5">
        <p className="text-[10px]" style={{ color: "var(--giq-text-muted)" }}>{label}</p>
        {optional && (
          <span className="text-[9px] px-1 rounded" style={{ color: "var(--giq-text-muted)", background: "var(--giq-border)" }}>
            {optionalLabel ?? "opt"}
          </span>
        )}
      </div>
      <input
        type="number"
        step={step ?? "1"}
        min={min ?? "0"}
        max={max ?? "9999"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="w-full text-center text-lg font-bold rounded-xl py-2.5 focus:outline-none"
        style={{
          background: "var(--giq-bg-card)",
          border: `1.5px solid ${active && value ? "var(--giq-accent)" : "var(--giq-border)"}`,
          color: value ? "var(--giq-text-primary)" : "var(--giq-text-muted)",
        }}
      />
    </div>
  );
}

function ExerciseLogSection({ exercise }: { exercise: Exercise }) {
  const t = useT();
  const { lang } = useLanguage();
  const muscleGroup = translateMuscle(
    exercise.muscles?.split(/[,·]/)[0].trim() ?? "general",
    lang,
  );
  const { data: logs = [] } = useStrengthLogs(muscleGroup);
  const saveLog = useSaveStrengthLog();

  const exType = exercise.exercise_type ?? detectExerciseType(exercise.name);

  const [expanded, setExpanded] = useState(false);
  const [prInfo, setPrInfo] = useState<{ delta: number | null } | null>(null);

  // Strength / bodyweight fields
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [setsDoneInput, setSetsDoneInput] = useState("");

  // Cardio fields
  const [distInput, setDistInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [hrInput, setHrInput] = useState("");

  // Timed fields
  const targetSecs = parseTargetSeconds(exercise.reps);
  const [timedInput, setTimedInput] = useState(String(targetSecs));

  // Find previous max for strength PR detection
  const exerciseLogs = logs.filter(l => l.exercise_name === exercise.name);
  const prevMax = exerciseLogs.length > 0
    ? Math.max(...exerciseLogs.map(l => l.weight_kg))
    : null;

  const currentWeight = parseFloat(weightInput);
  const isPotentialPR = exType === "strength" && prevMax !== null && !isNaN(currentWeight) && currentWeight > prevMax;

  // Auto-calculate pace
  const dist = parseFloat(distInput);
  const mins = parseFloat(timeInput);
  const pace = !isNaN(dist) && !isNaN(mins) && dist > 0 ? (mins / dist).toFixed(2) : null;

  // Toggle label per type
  const toggleEmoji = exType === "cardio" ? "🏃" : exType === "bodyweight" ? "💪" : exType === "timed" ? "⏱" : "🏋️";
  const toggleLabel = exType === "cardio" ? t("log_cardio") : exType === "bodyweight" ? t("log_bodyweight") : exType === "timed" ? t("log_timed") : t("log_todays_max");

  const canSaveStrength = weightInput !== "" && repsInput !== "";
  const canSaveBodyweight = repsInput !== "";
  const canSaveCardio = distInput !== "" || timeInput !== "";
  const canSaveTimed = timedInput !== "";

  const handleSave = () => {
    if (exType === "strength") {
      const kg = parseFloat(weightInput);
      const reps = parseInt(repsInput, 10);
      if (!kg || isNaN(kg) || kg <= 0 || !reps || isNaN(reps) || reps <= 0) return;
      saveLog.mutate(
        { exerciseName: exercise.name, muscleGroup, weightKg: kg, reps },
        { onSuccess: (result) => { setPrInfo({ delta: result.prDelta }); setWeightInput(""); setRepsInput(""); setTimeout(() => setPrInfo(null), 4000); } },
      );
    } else if (exType === "bodyweight") {
      const reps = parseInt(repsInput, 10);
      const sets = parseInt(setsDoneInput, 10) || 1;
      if (!reps || isNaN(reps) || reps <= 0) return;
      saveLog.mutate(
        { exerciseName: exercise.name, muscleGroup, weightKg: 0, reps: reps * sets },
        { onSuccess: () => { setRepsInput(""); setSetsDoneInput(""); } },
      );
    } else if (exType === "timed") {
      const secs = parseInt(timedInput, 10);
      if (!secs || isNaN(secs) || secs <= 0) return;
      saveLog.mutate(
        { exerciseName: exercise.name, muscleGroup, weightKg: 0, reps: secs },
        { onSuccess: () => { setTimedInput(String(targetSecs)); } },
      );
    } else {
      // cardio
      const d = parseFloat(distInput) || 0;
      const m = parseFloat(timeInput) || 0;
      const p = pace ? parseFloat(pace) : undefined;
      const hr = hrInput ? parseInt(hrInput, 10) : undefined;
      if (d === 0 && m === 0) return;
      saveLog.mutate(
        { exerciseName: exercise.name, muscleGroup, weightKg: 0, reps: 1, distanceKm: d || undefined, durationMin: m || undefined, paceMinPerKm: p, heartRateAvg: hr },
        { onSuccess: () => { setDistInput(""); setTimeInput(""); setHrInput(""); } },
      );
    }
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--giq-border)" }}>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-xs font-semibold transition-colors w-full"
        style={{ color: expanded ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
      >
        <span>{toggleEmoji}</span>
        <span>{toggleLabel}</span>
        {exType === "strength" && prevMax !== null && !expanded && (
          <span className="ml-auto text-xs" style={{ color: "var(--giq-text-muted)" }}>
            {t("prev_record", { n: prevMax })}
          </span>
        )}
        <span style={{ fontSize: 10, marginLeft: (exType === "strength" && prevMax !== null && !expanded) ? 4 : "auto" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{ background: "var(--giq-bg-secondary)", border: "1px solid var(--giq-border)" }}
        >
          {/* ── STRENGTH ───────────────────────────────────────────────── */}
          {exType === "strength" && (
            <>
              {prevMax !== null && (
                <p className="text-xs mb-3" style={{ color: "var(--giq-text-muted)" }}>
                  {t("prev_record", { n: prevMax })}
                </p>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--giq-text-muted)" }}>
                {t("log_todays_max")}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] mb-1.5" style={{ color: "var(--giq-text-muted)" }}>Peso (kg)</p>
                  <input
                    type="number" step="0.5" min="0" max="999"
                    value={weightInput} onChange={e => setWeightInput(e.target.value)}
                    placeholder="0"
                    className="w-full text-center text-lg font-bold rounded-xl py-3 focus:outline-none"
                    style={{
                      background: "var(--giq-bg-card)",
                      border: `1.5px solid ${isPotentialPR ? "#FFB800" : weightInput ? "var(--giq-accent)" : "var(--giq-border)"}`,
                      color: isPotentialPR ? "#FFB800" : weightInput ? "var(--giq-accent)" : "var(--giq-text-primary)",
                    }}
                  />
                </div>
                <span className="text-xl font-bold mt-4" style={{ color: "var(--giq-text-muted)" }}>×</span>
                <div className="flex-1">
                  <p className="text-[10px] mb-1.5" style={{ color: "var(--giq-text-muted)" }}>Reps</p>
                  <input
                    type="number" min="1" max="999"
                    value={repsInput} onChange={e => setRepsInput(e.target.value)}
                    placeholder="0"
                    className="w-full text-center text-lg font-bold rounded-xl py-3 focus:outline-none"
                    style={{
                      background: "var(--giq-bg-card)",
                      border: `1.5px solid ${repsInput ? "var(--giq-accent)" : "var(--giq-border)"}`,
                      color: repsInput ? "var(--giq-text-primary)" : "var(--giq-text-muted)",
                    }}
                  />
                </div>
              </div>
              {isPotentialPR && !prInfo && (
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-sm">🏆</span>
                  <p className="text-xs font-bold" style={{ color: "#FFB800" }}>{t("personal_record")}</p>
                </div>
              )}
              {prInfo && (
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-sm">🏆</span>
                  <p className="text-xs font-bold" style={{ color: "#FFB800" }}>
                    {prInfo.delta != null ? t("new_pr", { n: prInfo.delta }) : t("personal_record")}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── BODYWEIGHT ─────────────────────────────────────────────── */}
          {exType === "bodyweight" && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--giq-text-muted)" }}>
                {t("log_bodyweight")}
              </p>
              <div className="flex items-center gap-3">
                <NumericInput label={t("sets_done")} value={setsDoneInput} onChange={setSetsDoneInput} placeholder="3" active />
                <span className="text-xl font-bold mt-4" style={{ color: "var(--giq-text-muted)" }}>×</span>
                <NumericInput label="Reps" value={repsInput} onChange={setRepsInput} placeholder="0" active />
              </div>
            </>
          )}

          {/* ── TIMED ──────────────────────────────────────────────────── */}
          {exType === "timed" && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--giq-text-muted)" }}>
                {t("log_timed")}
              </p>
              {/* Target time display */}
              <div className="flex flex-col items-center py-3 mb-3 rounded-xl" style={{ background: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--giq-text-muted)" }}>{t("target_time")}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black" style={{ color: "var(--giq-accent)" }}>{targetSecs}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--giq-text-muted)" }}>{t("seconds_unit")}</span>
                </div>
              </div>
              {/* Actual time input */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: "var(--giq-text-muted)" }}>{t("actual_time")}</p>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={timedInput}
                  onChange={e => setTimedInput(e.target.value)}
                  className="w-full text-center text-lg font-bold rounded-xl py-3 focus:outline-none"
                  style={{
                    background: "var(--giq-bg-card)",
                    border: `1.5px solid ${timedInput && parseInt(timedInput) >= targetSecs ? "var(--giq-accent)" : "var(--giq-border)"}`,
                    color: timedInput && parseInt(timedInput) >= targetSecs ? "var(--giq-accent)" : "var(--giq-text-primary)",
                  }}
                />
              </div>
            </>
          )}

          {/* ── CARDIO ─────────────────────────────────────────────────── */}
          {exType === "cardio" && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--giq-text-muted)" }}>
                {t("log_cardio")}
              </p>
              <div className="flex gap-2 mb-2">
                <NumericInput label={t("distance_km")} value={distInput} onChange={setDistInput} step="0.1" placeholder="0.0" active />
                <NumericInput label={t("duration_min")} value={timeInput} onChange={setTimeInput} placeholder="0" active />
              </div>
              <div className="flex gap-2">
                {/* Pace — read-only computed */}
                <div className="flex-1">
                  <p className="text-[10px] mb-1.5" style={{ color: "var(--giq-text-muted)" }}>{t("pace_label")}</p>
                  <div
                    className="w-full text-center text-lg font-bold rounded-xl py-2.5"
                    style={{ background: "var(--giq-bg-card)", border: "1.5px solid var(--giq-border)", color: pace ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
                  >
                    {pace ?? "—"}
                  </div>
                </div>
                <NumericInput
                  label={t("heart_rate")}
                  value={hrInput}
                  onChange={setHrInput}
                  placeholder="—"
                  min="30"
                  max="250"
                  optional
                  optionalLabel={t("optional_field")}
                />
              </div>
            </>
          )}

          {/* Save button */}
          {(() => {
            const canSave = exType === "strength" ? canSaveStrength
              : exType === "bodyweight" ? canSaveBodyweight
              : exType === "timed" ? canSaveTimed
              : canSaveCardio;
            return (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLog.isPending || !canSave}
                className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background: canSave ? "var(--giq-accent)" : "var(--giq-border)",
                  color: canSave ? "var(--giq-accent-text)" : "var(--giq-text-muted)",
                }}
              >
                {saveLog.isPending ? "…" : t("save_log")}
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const { lang } = useLanguage();
  const { data, isLoading } = useExerciseImages(exercise.name, lang, exercise.exercise_id);
  const [modalOpen, setModalOpen] = useState(false);
  const t = useT();

  const imageStart = data?.imageStart ?? null;
  const imageEnd = data?.imageEnd ?? null;
  const isGif = data?.isGif ?? false;
  const equipment = data?.equipment ?? null;
  const hasImages = !isLoading && imageStart;

  return (
    <>
      <div className="rounded-lg p-5" style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}>
        <div className="flex items-start gap-4">
          {/* Index badge */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
            style={{ backgroundColor: "var(--giq-border)", color: "var(--giq-text-muted)" }}
          >
            {index + 1}
          </div>

          {/* Exercise details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-2.5">
              <h3 className="font-bold" style={{ color: "var(--giq-text-primary)" }}>{exercise.name}</h3>
              {exercise.muscles && (
                <span
                  className="shrink-0 font-medium"
                  style={{
                    color: "var(--giq-accent)",
                    background: "var(--giq-border)",
                    fontSize: 11,
                    borderRadius: 4,
                    padding: "2px 8px",
                  }}
                >
                  {translateMuscles(exercise.muscles, lang)}
                </span>
              )}
              {equipment && (
                <span
                  className="shrink-0 font-medium"
                  style={{
                    color: "var(--giq-text-muted)",
                    background: "var(--giq-border)",
                    fontSize: 10,
                    borderRadius: 4,
                    padding: "2px 8px",
                  }}
                >
                  {t(equipmentTKey(equipment))}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {exercise.sets && exercise.reps && (
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--giq-accent) 10%, transparent)",
                    color: "var(--giq-accent)",
                    border: "1px solid color-mix(in srgb, var(--giq-accent) 20%, transparent)",
                  }}
                >
                  <Repeat className="w-3 h-3" />
                  {t("sets_x_reps", { sets: exercise.sets, reps: exercise.reps })}
                </span>
              )}
              {exercise.duration_sec && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Timer className="w-3 h-3" />
                  {formatDuration(exercise.duration_sec)}
                </span>
              )}
              {exercise.rest_sec && (
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: "var(--giq-border)", color: "var(--giq-text-muted)", border: "1px solid var(--giq-bg-card-hover)" }}
                >
                  <Zap className="w-3 h-3" />
                  {t("rest_duration", { duration: formatDuration(exercise.rest_sec) })}
                </span>
              )}
            </div>

            {exercise.notes && (
              <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--giq-text-secondary)" }}>{exercise.notes}</p>
            )}

            {hasImages && (
              <button
                onClick={() => setModalOpen(true)}
                className="text-xs font-medium transition-colors"
                style={{ color: "var(--giq-accent)" }}
              >
                {t("view_example_arrow")}
              </button>
            )}

            <ExerciseLogSection exercise={exercise} />
          </div>

          {/* Exercise visual — animated GIF, static pair, or SVG fallback */}
          {hasImages ? (
            <div
              className="shrink-0 flex cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              {isGif ? (
                <img
                  src={imageStart!}
                  alt={exercise.name}
                  style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }}
                />
              ) : (
                <ExercisePair
                  imageStart={imageStart!}
                  imageEnd={imageEnd ?? imageStart!}
                  name={exercise.name}
                  size={60}
                />
              )}
            </div>
          ) : (
            <div className="shrink-0 hidden min-[380px]:block opacity-70 hover:opacity-100 transition-opacity duration-300">
              <ExerciseAnimation name={exercise.name} />
            </div>
          )}
        </div>
      </div>

      {modalOpen && imageStart && (
        <ExerciseModal
          name={exercise.name}
          imageStart={imageStart}
          imageEnd={imageEnd ?? imageStart}
          isGif={isGif}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
