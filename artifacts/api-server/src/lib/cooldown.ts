/*
SUPABASE MIGRATION — Run in Supabase SQL editor (Mejora 5):

CREATE TABLE IF NOT EXISTS public.profile_change_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_fields  TEXT[] NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('onboarding_edit','profile_patch')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_change_events_user_created_idx
  ON public.profile_change_events (user_id, created_at DESC);

ALTER TABLE public.profile_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile change events"
  ON public.profile_change_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own profile change events"
  ON public.profile_change_events
  FOR SELECT USING (auth.uid() = user_id);

The handlers in routes/onboarding.ts and routes/profile.ts use createUserClient
with the caller's JWT, so RLS auth.uid() = user_id is enforced on every
read/write — no service-role escalation needed.
*/

import type { SupabaseClient } from "@supabase/supabase-js";

export const COOLDOWN_WINDOW_HOURS = 24;
export const COOLDOWN_MAX_EVENTS   = 2;   // 2 events in 24h → block the 3rd attempt

export type ChangeSource = "onboarding_edit" | "profile_patch";
export type ChangeField  = "weightKg" | "goalType";

export interface CooldownCheck {
  blocked:      boolean;
  eventsCount:  number;        // events seen in the window (any source)
  oldestAt:     string | null; // ISO timestamp of the oldest event in window
  hoursToWait:  number;        // 0 when not blocked
}

interface MinimalLogger {
  warn: (obj: unknown, msg: string) => void;
}

/**
 * Returns whether the user has hit the cooldown limit for changing extreme
 * profile fields. Fail-open: if the query errors (e.g. table doesn't exist
 * yet because the SQL above hasn't been applied), we report blocked=false
 * so legitimate edits keep flowing. The cooldown protection only kicks in
 * once the migration is in place.
 */
export async function checkProfileChangeCooldown(
  db: SupabaseClient,
  userId: string,
): Promise<CooldownCheck> {
  const windowStart = new Date(
    Date.now() - COOLDOWN_WINDOW_HOURS * 3600 * 1000,
  ).toISOString();

  const { data, error } = await db
    .from("profile_change_events")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { blocked: false, eventsCount: 0, oldestAt: null, hoursToWait: 0 };
  }

  const eventsCount = data.length;
  const oldestAt    = (data[0]?.created_at as string | undefined) ?? null;

  if (eventsCount < COOLDOWN_MAX_EVENTS) {
    return { blocked: false, eventsCount, oldestAt, hoursToWait: 0 };
  }

  // Blocked. The user can edit again as soon as the OLDEST event in the
  // window falls out, dropping the count below the threshold.
  const oldestMs = new Date(oldestAt!).getTime();
  const elapsedHours = (Date.now() - oldestMs) / 3_600_000;
  const hoursToWait = Math.max(0, Math.ceil(COOLDOWN_WINDOW_HOURS - elapsedHours));
  return { blocked: true, eventsCount, oldestAt, hoursToWait };
}

/**
 * Records a successful change of one or more extreme fields. No-op if
 * `changedFields` is empty (e.g. the user submitted the same values they
 * already had). Best-effort: errors are logged as warnings, never thrown,
 * so a failed audit insert doesn't bubble up to the user-facing 200.
 */
export async function recordProfileChange(
  db: SupabaseClient,
  userId: string,
  changedFields: ChangeField[],
  source: ChangeSource,
  logger?: MinimalLogger,
): Promise<void> {
  if (changedFields.length === 0) return;
  const { error } = await db.from("profile_change_events").insert({
    user_id:        userId,
    changed_fields: changedFields,
    source,
  });
  if (error && logger) {
    logger.warn({ error }, "profile_change_events insert failed (non-fatal)");
  }
}
