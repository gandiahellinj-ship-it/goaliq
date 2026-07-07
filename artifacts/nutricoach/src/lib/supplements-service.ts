/**
 * Vision supplements — read/write the user's selected supplements and the
 * reminder on/off state.
 *
 * Phase 1: persistence is a DIRECT Supabase update of
 * `food_preferences.supplements` (the app already queries Supabase directly).
 * The reminder toggle is stored locally for now; the real OneSignal scheduling
 * is wired in Phase 2 via `syncSupplementSchedule()` (currently a no-op seam).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { StoredSupplement } from "@/lib/supplements";

const SUPPLEMENTS_KEY = ["food_preferences", "supplements"];

/** Read the user's selected supplements from food_preferences.supplements. */
export function useUserSupplements() {
  return useQuery({
    queryKey: SUPPLEMENTS_KEY,
    queryFn: async (): Promise<StoredSupplement[]> => {
      const { data, error } = await supabase
        .from("food_preferences")
        .select("supplements")
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.supplements ?? []) as Partial<StoredSupplement>[];
      // Normalize: tolerate older rows that stored only { id, timingIndex }.
      return raw
        .filter((s): s is StoredSupplement => typeof s?.id === "string")
        .map((s) => ({
          id: s.id as string,
          timingIndex: s.timingIndex ?? 0,
          variantIndex: s.variantIndex ?? 0,
          notificationTime: s.notificationTime ?? "08:00",
        }));
    },
  });
}

/** Snapshot carried from onMutate to onError so a failed save can roll back. */
interface UpdateContext {
  previous: StoredSupplement[] | undefined;
}

/**
 * Persist the full supplements array, scoped by user_id.
 *
 * Uses `upsert(..., { onConflict: "user_id" })` instead of a bare `.update()`
 * so the write also succeeds for users that don't yet have a food_preferences
 * row (the update would silently affect 0 rows). Applies an optimistic cache
 * update with rollback so the selector reflects the change instantly and
 * reverts if the write fails.
 */
export function useUpdateSupplements() {
  const qc = useQueryClient();
  return useMutation<StoredSupplement[], Error, StoredSupplement[], UpdateContext>({
    mutationFn: async (supplements) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");
      const { error } = await supabase
        .from("food_preferences")
        .upsert({ user_id: user.id, supplements }, { onConflict: "user_id" });
      if (error) throw error;
      return supplements;
    },
    // Optimistic: update the cache the selector reads, snapshotting the old value.
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: SUPPLEMENTS_KEY });
      const previous = qc.getQueryData<StoredSupplement[]>(SUPPLEMENTS_KEY);
      qc.setQueryData(SUPPLEMENTS_KEY, next);
      return { previous };
    },
    // Rollback to the last known-good value on failure.
    onError: (_err, _next, context) => {
      qc.setQueryData(SUPPLEMENTS_KEY, context?.previous ?? []);
    },
    // Reconcile with the server once the mutation settles either way.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SUPPLEMENTS_KEY });
    },
  });
}

/* ── Reminder enabled flag (local for Phase 1) ──────────────────────────── */

const reminderKey = (userId: string | undefined) =>
  `vision.supplementReminder.${userId ?? "anon"}`;

export function getReminderEnabled(userId: string | undefined): boolean {
  try {
    return localStorage.getItem(reminderKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setReminderEnabled(userId: string | undefined, enabled: boolean): void {
  try {
    localStorage.setItem(reminderKey(userId), enabled ? "1" : "0");
  } catch {
    /* ignore storage errors */
  }
}

/* ── Phase 2 seam: push the schedule to the backend / OneSignal ──────────── */

export interface SchedulePayload {
  userId: string;
  enabled: boolean;
  supplements: StoredSupplement[];
}

/**
 * Phase 2 will POST this to `/api/notifications/update-schedule`, which reads
 * ONESIGNAL_API_KEY from the backend env (Replit prod secret) and schedules the
 * recurring push. For now this is a no-op that resolves so callers can `await`
 * it without behaviour changing. Returns false to signal "not yet wired".
 */
export async function syncSupplementSchedule(
  _payload: SchedulePayload,
): Promise<boolean> {
  // TODO (Phase 2): real call —
  //   await fetch("/api/notifications/update-schedule", { method: "POST", ... })
  return false;
}
