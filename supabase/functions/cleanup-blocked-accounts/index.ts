// Edge Function: cleanup-blocked-accounts
// Daily cron job that hard-deletes auth.users rows whose
// health_screenings.scheduled_deletion_at has passed (90-day GDPR cleanup
// for users whose medical exclusion blocked their account). Captures an
// audit row in deletion_logs BEFORE deleting so the cascade does not
// destroy the metadata.
//
// Auth model: verify_jwt = true (config.toml) + bearer-token equality
// against SUPABASE_SERVICE_ROLE_KEY inside the handler. Only the holder of
// the service role can invoke it — i.e. the Supabase cron configured by
// the project admin. Not callable by regular user JWTs.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreeningRow {
  id: string;
  user_id: string;
  block_reason: string | null;
  attempted_at: string | null;
  scheduled_deletion_at: string;
}

interface DeletionError {
  user_id: string;
  email: string | null;
  error: string;
}

interface CleanupSummary {
  started_at: string;
  completed_at: string;
  duration_ms: number;
  candidates_found: number;
  deleted_count: number;
  error_count: number;
  deleted_emails: string[];
  errors: DeletionError[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 100;
const DELETION_REASON = "rgpd_90_day_auto_cleanup";
const DELETION_METHOD = "automatic_cron_job";
const METADATA_VERSION = "1.0";
const EMAIL_FALLBACK = "unknown@deleted-user.invalid";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorize(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === serviceRoleKey;
}

function createServiceClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findExpired(supabase: SupabaseClient): Promise<ScreeningRow[]> {
  const { data, error } = await supabase
    .from("health_screenings")
    .select("id, user_id, block_reason, attempted_at, scheduled_deletion_at")
    .eq("screening_result", "blocked")
    .not("scheduled_deletion_at", "is", null)
    .lt("scheduled_deletion_at", new Date().toISOString())
    .order("scheduled_deletion_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);
  if (error) throw new Error(`findExpired failed: ${error.message}`);
  return (data ?? []) as ScreeningRow[];
}

async function fetchEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ email: string; fallbackUsed: boolean }> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      return { email: EMAIL_FALLBACK, fallbackUsed: true };
    }
    return { email: data.user.email, fallbackUsed: false };
  } catch {
    return { email: EMAIL_FALLBACK, fallbackUsed: true };
  }
}

async function logDeletion(
  supabase: SupabaseClient,
  screening: ScreeningRow,
  email: string,
  emailFallbackUsed: boolean,
): Promise<void> {
  const metadata: Record<string, unknown> = { version: METADATA_VERSION };
  if (emailFallbackUsed) metadata.email_fallback = true;

  const { error } = await supabase.from("deletion_logs").insert({
    deleted_user_email: email,
    deleted_user_id: screening.user_id,
    original_screening_id: screening.id,
    original_block_reason: screening.block_reason,
    original_attempted_at: screening.attempted_at,
    scheduled_deletion_at: screening.scheduled_deletion_at,
    deletion_reason: DELETION_REASON,
    deletion_method: DELETION_METHOD,
    metadata,
  });
  if (error) throw new Error(`deletion_logs insert failed: ${error.message}`);
}

async function deleteAuthUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(`auth.admin.deleteUser failed: ${error.message}`);
}

async function processOne(
  supabase: SupabaseClient,
  screening: ScreeningRow,
): Promise<string> {
  const { email, fallbackUsed } = await fetchEmail(supabase, screening.user_id);
  console.log(`Processing user ${email}...`);
  // Log first — auth.users cascade would otherwise delete the screening
  // row before we can capture id/block_reason/attempted_at.
  await logDeletion(supabase, screening, email, fallbackUsed);
  await deleteAuthUser(supabase, screening.user_id);
  return email;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[cleanup-blocked-accounts] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  if (!authorize(req, serviceRoleKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  console.log(`Starting cleanup batch at ${startedAt}`);

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  let candidates: ScreeningRow[];
  try {
    candidates = await findExpired(supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cleanup-blocked-accounts] failed to query candidates", msg);
    return jsonResponse({ error: "Failed to query candidates", detail: msg }, 500);
  }

  const deletedEmails: string[] = [];
  const errors: DeletionError[] = [];

  for (const screening of candidates) {
    try {
      const email = await processOne(supabase, screening);
      deletedEmails.push(email);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cleanup-blocked-accounts] failed for user ${screening.user_id}: ${msg}`);
      errors.push({ user_id: screening.user_id, email: null, error: msg });
    }
  }

  const completedAtMs = Date.now();
  const summary: CleanupSummary = {
    started_at: startedAt,
    completed_at: new Date(completedAtMs).toISOString(),
    duration_ms: completedAtMs - startedAtMs,
    candidates_found: candidates.length,
    deleted_count: deletedEmails.length,
    error_count: errors.length,
    deleted_emails: deletedEmails,
    errors,
  };

  console.log(`Cleanup completed. Deleted: ${summary.deleted_count}, Errors: ${summary.error_count}`);
  return jsonResponse(summary, 200);
});
