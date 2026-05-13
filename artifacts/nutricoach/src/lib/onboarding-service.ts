import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/supabase-queries";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OnboardingFormData {
  displayName: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  goalType: string;
  dietType: string;
  allergies: string[];
  likedFoods: string[];
  dislikedFoods: string[];
  trainingLevel: string;
  trainingLocation: string;
  trainingDaysPerWeek: number;
  supplements?: { id: string; timingIndex: number; variantIndex?: number; notificationTime: string }[];
  goalPace?: string;
  fastingProtocol?: string | null;
}

// ─── Main Submit Function ─────────────────────────────────────────────────────

export async function submitOnboarding(data: OnboardingFormData): Promise<void> {
  const token = await getAccessToken();

  const body = {
    displayName: data.displayName.trim(),
    age: data.age,
    sex: data.sex,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg ?? null,
    goalType: data.goalType,
    goalPace: data.goalPace ?? null,
    fastingProtocol: data.fastingProtocol ?? null,
    dietType: data.dietType,
    allergies: data.allergies,
    likedFoods: data.likedFoods,
    dislikedFoods: data.dislikedFoods,
    trainingLevel: data.trainingLevel,
    trainingLocation: data.trainingLocation,
    trainingDaysPerWeek: data.trainingDaysPerWeek,
    supplements: data.supplements ?? [],
  };

  let res: Response;
  try {
    res = await fetch("/api/onboarding", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Error de conexión. Comprueba tu internet e inténtalo de nuevo.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error("Tu sesión ha caducado. Inicia sesión de nuevo.");
    }
    if (res.status === 400 && Array.isArray(err?.issues) && err.issues.length > 0) {
      // Backend ranks Zod issues in parse order — show the first.
      throw new Error(err.issues[0].message);
    }
    throw new Error(err?.error ?? `Error del servidor (HTTP ${res.status}).`);
  }
}

// ─── Health Validation Logging ────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

/** WHO BMI classification. "obesity_2" = 35–39.9, "obesity_3" = 40+. */
export type ImcCategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obesity_1"
  | "obesity_2"
  | "obesity_3";

/** Restricts logBlocked action_taken to a fixed, queryable set of values. */
export type BlockReason =
  | "auto_blocked_low_imc"       // underweight + goal that would worsen it
  | "auto_blocked_high_imc"      // obesity II/III + goal unsafe at that weight
  | "auto_blocked_unsafe_goal"   // generic unsafe combination
  | "auto_blocked_other";        // fallback for future cases

/** Single source of truth for the user_data_snapshot JSONB column. All keys snake_case. */
export interface UserDataSnapshot {
  age:              number;
  biological_sex:   string;
  height_cm:        number;
  weight_kg:        number;
  imc:              number;
  imc_category:     ImcCategory;
  goal_selected:    string;
  target_weight_kg: number | null;
  activity_level:   string | null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Maps a numeric BMI value to the canonical ImcCategory string. */
export function imcToCategory(imc: number): ImcCategory {
  if (imc < 18.5) return "underweight";
  if (imc < 25)   return "normal";
  if (imc < 30)   return "overweight";
  if (imc < 35)   return "obesity_1";
  if (imc < 40)   return "obesity_2";
  return "obesity_3";
}

/**
 * Builds the canonical UserDataSnapshot from in-memory form data.
 * Does NOT query Supabase — data is consumed from component state because
 * during onboarding the profile has not been persisted yet.
 */
export function buildUserDataSnapshot(params: {
  weightKg:       number;
  heightCm:       number;
  age:            number;
  sex:            string;
  goalType:       string;
  targetWeightKg: number | null;
  trainingLevel:  string | null;
}): UserDataSnapshot {
  const imc = params.heightCm > 0
    ? params.weightKg / Math.pow(params.heightCm / 100, 2)
    : 0;
  return {
    age:              params.age,
    biological_sex:   params.sex,
    height_cm:        params.heightCm,
    weight_kg:        params.weightKg,
    imc:              Math.round(imc * 10) / 10,
    imc_category:     imcToCategory(imc),
    goal_selected:    params.goalType,
    target_weight_kg: params.targetWeightKg ?? null,
    activity_level:   params.trainingLevel ?? null,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// In-memory dedup set — prevents duplicate info_shown / warning_shown / blocked
// when the user switches objectives multiple times in one session.
// warning_accepted is always inserted (intentional user action, not deduplicated).
const _loggedKeys = new Set<string>();

async function _insertLog(payload: {
  user_id: string;
  event_type: string;
  trigger_reason: string;
  user_data_snapshot: UserDataSnapshot;
  action_taken: string;
}): Promise<void> {
  const { error } = await supabase.from("health_validation_logs").insert(payload);
  if (error) {
    console.error("[health_validation_logs] insert failed, retrying in 1s…", error);
    await new Promise(r => setTimeout(r, 1000));
    const { error: e2 } = await supabase.from("health_validation_logs").insert(payload);
    if (e2) {
      console.error("[health_validation_logs] retry also failed — record lost:", e2);
    }
  }
}

async function _getUser(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Public log functions ──────────────────────────────────────────────────────

/** Shown when the IMC/goal combination is fine — green/blue informational box. */
export async function logInfoShown(
  triggerReason: string,
  snapshot: UserDataSnapshot,
): Promise<void> {
  const key = `info_shown:${triggerReason}`;
  if (_loggedKeys.has(key)) return;
  _loggedKeys.add(key);
  const userId = await _getUser();
  if (!userId) return;
  await _insertLog({ user_id: userId, event_type: "info_shown", trigger_reason: triggerReason, user_data_snapshot: snapshot, action_taken: "viewed" });
}

/** Shown when an amber warning with mandatory checkboxes appears. */
export async function logWarningShown(
  triggerReason: string,
  snapshot: UserDataSnapshot,
): Promise<void> {
  const key = `warning_shown:${triggerReason}`;
  if (_loggedKeys.has(key)) return;
  _loggedKeys.add(key);
  const userId = await _getUser();
  if (!userId) return;
  await _insertLog({ user_id: userId, event_type: "warning_shown", trigger_reason: triggerReason, user_data_snapshot: snapshot, action_taken: "displayed" });
}

/** Shown when the Continue button is hard-blocked — no checkboxes, user cannot proceed. */
export async function logBlocked(
  triggerReason: string,
  snapshot: UserDataSnapshot,
  blockReason: BlockReason,
): Promise<void> {
  const key = `blocked:${triggerReason}`;
  if (_loggedKeys.has(key)) return;
  _loggedKeys.add(key);
  const userId = await _getUser();
  if (!userId) return;
  await _insertLog({ user_id: userId, event_type: "blocked", trigger_reason: triggerReason, user_data_snapshot: snapshot, action_taken: blockReason });
}

/** User ticked both checkboxes and pressed Continue — always inserted, not deduplicated. */
export async function logWarningAccepted(
  triggerReason: string,
  snapshot: UserDataSnapshot,
): Promise<void> {
  const userId = await _getUser();
  if (!userId) return;
  await _insertLog({ user_id: userId, event_type: "warning_accepted", trigger_reason: triggerReason, user_data_snapshot: snapshot, action_taken: "accepted_and_continued" });
}
