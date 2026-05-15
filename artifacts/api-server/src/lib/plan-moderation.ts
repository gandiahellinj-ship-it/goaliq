// Numeric moderation of AI-generated plans (Mejora 6).
// Validates meal and workout plans against medical safety thresholds before
// they are persisted. If the plan crosses a threshold, the wrapper in
// aiGenerators.ts re-prompts the model once with reinforcement feedback;
// if the retry also fails, the endpoints return 422 without writing to DB.

// ─── Medical thresholds ──────────────────────────────────────────────────────

// Daily calorie floor. WHO baseline values, used as a hard medical safety
// floor — not a personalised TDEE. The AI is asked to compute TDEE with
// Mifflin-St Jeor in its prompt, this layer is the last line of defence.
export const MIN_CALORIES_WOMEN = 1200;
export const MIN_CALORIES_MEN   = 1500;
export const MIN_CALORIES_OTHER = 1200;   // conservative fallback when sex is unknown / "other"

// Daily calorie ceiling. Sanity bound — a plan above this is almost certainly
// a generation error, not a legitimate aggressive bulk.
export const MAX_CALORIES = 4000;

// Weekly volume — BOTH must be exceeded to block (combined gate to avoid
// false positives on advanced lifters with short, dense sessions).
export const MAX_WEEKLY_MINUTES   = 900;   // 15 h/week
export const MAX_WEEKLY_EXERCISES = 70;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModerationReason =
  | "too_low"
  | "too_high"
  | "incomplete_data"
  | "excessive_volume"
  | "force_fail_test";

export interface MealModerationResult {
  ok: boolean;
  reason?: ModerationReason;
  details?: {
    worstDay?:           string;                // e.g. "monday"
    worstDayCalories?:   number;
    minRequired?:        number;
    maxAllowed?:         number;
    sexUsed:             "female" | "male" | "other";
  };
}

export interface WorkoutModerationResult {
  ok: boolean;
  reason?: ModerationReason;
  details?: {
    weeklyMinutes:      number;
    weeklyExercises:    number;
    daysCount:          number;
    maxWeeklyMinutes:   number;
    maxWeeklyExercises: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function forceFail(): boolean {
  return process.env.MODERATION_FORCE_FAIL === "true";
}

function normalizeSex(sex: string | null | undefined): "female" | "male" | "other" {
  if (sex === "male") return "male";
  if (sex === "female") return "female";
  return "other";
}

function minCaloriesFor(sex: "female" | "male" | "other"): number {
  if (sex === "male") return MIN_CALORIES_MEN;
  if (sex === "female") return MIN_CALORIES_WOMEN;
  return MIN_CALORIES_OTHER;
}

// ─── Meal plan moderation ────────────────────────────────────────────────────

// Expected shape (duck-typed — the actual schemas in api-zod don't match
// what aiGenerators emits, see routes/meals.ts:44 for context):
//   plan: Array<{ day: string; meals: Array<{ calories: number; ... }> }>
export function moderateMealPlan(
  plan: unknown,
  profile: { sex: string | null | undefined },
): MealModerationResult {
  const sexUsed = normalizeSex(profile.sex);

  if (forceFail()) {
    return { ok: false, reason: "force_fail_test", details: { sexUsed } };
  }

  if (!Array.isArray(plan)) {
    return { ok: false, reason: "incomplete_data", details: { sexUsed } };
  }

  const minRequired = minCaloriesFor(sexUsed);

  for (const dayObj of plan as Array<{ day?: string; meals?: unknown }>) {
    const day = typeof dayObj?.day === "string" ? dayObj.day : "unknown";
    const meals = Array.isArray(dayObj?.meals) ? dayObj.meals : [];

    if (meals.length === 0) {
      return {
        ok: false,
        reason: "incomplete_data",
        details: { worstDay: day, sexUsed },
      };
    }

    const hasMissingCalories = meals.some(
      (m: unknown) => {
        const cal = (m as { calories?: unknown })?.calories;
        return typeof cal !== "number" || cal <= 0;
      },
    );
    if (hasMissingCalories) {
      return {
        ok: false,
        reason: "incomplete_data",
        details: { worstDay: day, sexUsed },
      };
    }

    const total = meals.reduce(
      (sum: number, m: unknown) => sum + ((m as { calories: number }).calories || 0),
      0,
    );

    if (total < minRequired) {
      return {
        ok: false,
        reason: "too_low",
        details: { worstDay: day, worstDayCalories: total, minRequired, sexUsed },
      };
    }
    if (total > MAX_CALORIES) {
      return {
        ok: false,
        reason: "too_high",
        details: { worstDay: day, worstDayCalories: total, maxAllowed: MAX_CALORIES, sexUsed },
      };
    }
  }

  return { ok: true };
}

// ─── Workout plan moderation ─────────────────────────────────────────────────

// Expected shape (duck-typed):
//   plan: Array<{ duration_minutes: number | null; exercises: Array<unknown> }>
export function moderateWorkoutPlan(
  plan: unknown,
  _profile: unknown,
): WorkoutModerationResult {
  if (forceFail()) {
    return {
      ok: false,
      reason: "force_fail_test",
      details: {
        weeklyMinutes: 0, weeklyExercises: 0, daysCount: 0,
        maxWeeklyMinutes: MAX_WEEKLY_MINUTES, maxWeeklyExercises: MAX_WEEKLY_EXERCISES,
      },
    };
  }

  if (!Array.isArray(plan)) {
    return {
      ok: false,
      reason: "incomplete_data",
      details: {
        weeklyMinutes: 0, weeklyExercises: 0, daysCount: 0,
        maxWeeklyMinutes: MAX_WEEKLY_MINUTES, maxWeeklyExercises: MAX_WEEKLY_EXERCISES,
      },
    };
  }

  let weeklyMinutes = 0;
  let weeklyExercises = 0;
  for (const day of plan as Array<{ duration_minutes?: unknown; exercises?: unknown }>) {
    const dm = day?.duration_minutes;
    if (typeof dm === "number") weeklyMinutes += dm;
    const ex = day?.exercises;
    if (Array.isArray(ex)) weeklyExercises += ex.length;
  }

  // Combined gate — both thresholds must be crossed to block (avoids false
  // positives on advanced lifters with high-density short sessions).
  if (weeklyMinutes > MAX_WEEKLY_MINUTES && weeklyExercises > MAX_WEEKLY_EXERCISES) {
    return {
      ok: false,
      reason: "excessive_volume",
      details: {
        weeklyMinutes,
        weeklyExercises,
        daysCount: (plan as unknown[]).length,
        maxWeeklyMinutes: MAX_WEEKLY_MINUTES,
        maxWeeklyExercises: MAX_WEEKLY_EXERCISES,
      },
    };
  }

  return { ok: true };
}
