// Edge Function: validate-health-screening
// Server-side validation of GoalIQ's medical exclusion questionnaire.
// Persists the result in health_screenings and writes a legal audit row to
// health_validation_logs. Auth is enforced via the caller's JWT so that
// RLS (auth.uid() = user_id) applies to every write.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreeningPayload {
  pregnancy_lactation: boolean;
  eating_disorder: boolean;
  diabetes: boolean;
  cardiovascular: boolean;
  kidney_liver: boolean;
  on_medication: boolean;
  physical_limitations: boolean;
  minor_age: boolean;
  severe_allergies: boolean;
  declared_no_conditions: boolean;
  allergies_acknowledged: boolean;
}

type ScreeningResult = "passed" | "blocked" | "allergies_only";

interface ComputedResult {
  result: ScreeningResult;
  block_reason: string | null;
  scheduled_deletion_at: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BLOCKING_CONDITIONS = [
  "pregnancy_lactation",
  "eating_disorder",
  "diabetes",
  "cardiovascular",
  "kidney_liver",
  "on_medication",
  "physical_limitations",
  "minor_age",
] as const satisfies readonly (keyof ScreeningPayload)[];

const PAYLOAD_KEYS: readonly (keyof ScreeningPayload)[] = [
  ...BLOCKING_CONDITIONS,
  "severe_allergies",
  "declared_no_conditions",
  "allergies_acknowledged",
];

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// ─── Error helper ────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function validateAuth(req: Request): Promise<{ userId: string; supabase: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) throw new HttpError(401, "Missing authorization header");

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing bearer token");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[validate-health-screening] missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
    throw new HttpError(500, "Server misconfiguration");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Invalid or expired session");

  return { userId: data.user.id, supabase };
}

// ─── Payload validation ──────────────────────────────────────────────────────

function validatePayload(body: unknown): ScreeningPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }

  const obj = body as Record<string, unknown>;
  for (const key of PAYLOAD_KEYS) {
    if (typeof obj[key] !== "boolean") {
      throw new HttpError(400, `Field "${key}" is required and must be a boolean`);
    }
  }

  return {
    pregnancy_lactation: obj.pregnancy_lactation as boolean,
    eating_disorder: obj.eating_disorder as boolean,
    diabetes: obj.diabetes as boolean,
    cardiovascular: obj.cardiovascular as boolean,
    kidney_liver: obj.kidney_liver as boolean,
    on_medication: obj.on_medication as boolean,
    physical_limitations: obj.physical_limitations as boolean,
    minor_age: obj.minor_age as boolean,
    severe_allergies: obj.severe_allergies as boolean,
    declared_no_conditions: obj.declared_no_conditions as boolean,
    allergies_acknowledged: obj.allergies_acknowledged as boolean,
  };
}

// ─── Screening logic ─────────────────────────────────────────────────────────

function computeScreeningResult(payload: ScreeningPayload): ComputedResult {
  const triggered = BLOCKING_CONDITIONS.filter((k) => payload[k]);

  if (triggered.length > 0) {
    const block_reason = triggered.length === 1 ? triggered[0] : "multiple";
    const scheduled_deletion_at = new Date(Date.now() + NINETY_DAYS_MS).toISOString();
    return { result: "blocked", block_reason, scheduled_deletion_at };
  }

  if (payload.severe_allergies) {
    if (!payload.allergies_acknowledged) {
      throw new HttpError(400, "Debe aceptar la advertencia de alergias");
    }
    return { result: "allergies_only", block_reason: null, scheduled_deletion_at: null };
  }

  if (!payload.declared_no_conditions) {
    throw new HttpError(400, "Debe seleccionar al menos una opción");
  }

  return { result: "passed", block_reason: null, scheduled_deletion_at: null };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function upsertScreening(
  supabase: SupabaseClient,
  userId: string,
  payload: ScreeningPayload,
  computed: ComputedResult,
): Promise<string> {
  const now = new Date().toISOString();
  const completed_at = computed.result === "blocked" ? null : now;

  const { data, error } = await supabase
    .from("health_screenings")
    .upsert(
      {
        user_id: userId,
        pregnancy_lactation: payload.pregnancy_lactation,
        eating_disorder: payload.eating_disorder,
        diabetes: payload.diabetes,
        cardiovascular: payload.cardiovascular,
        kidney_liver: payload.kidney_liver,
        on_medication: payload.on_medication,
        physical_limitations: payload.physical_limitations,
        minor_age: payload.minor_age,
        severe_allergies: payload.severe_allergies,
        declared_no_conditions: payload.declared_no_conditions,
        allergies_acknowledged: payload.allergies_acknowledged,
        screening_result: computed.result,
        block_reason: computed.block_reason,
        scheduled_deletion_at: computed.scheduled_deletion_at,
        deletion_warning_sent_at: null,
        attempted_at: now,
        completed_at,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("[health_screenings] upsert failed", error);
    throw new HttpError(500, "Database error");
  }

  return data.id as string;
}

async function logToValidationLogs(
  supabase: SupabaseClient,
  userId: string,
  payload: ScreeningPayload,
  computed: ComputedResult,
): Promise<void> {
  const eventType = `screening_${computed.result}`;
  const triggerReason =
    computed.block_reason ??
    (computed.result === "allergies_only" ? "allergies_acknowledged" : "no_conditions");

  const { error } = await supabase.from("health_validation_logs").insert({
    user_id: userId,
    event_type: eventType,
    trigger_reason: triggerReason,
    user_data_snapshot: payload,
    action_taken: "auto_screening_validation",
  });

  if (error) {
    console.error("[health_validation_logs] insert failed (non-fatal)", error);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { userId, supabase } = await validateAuth(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const payload = validatePayload(body);
    const computed = computeScreeningResult(payload);
    const screeningId = await upsertScreening(supabase, userId, payload, computed);
    await logToValidationLogs(supabase, userId, payload, computed);

    return jsonResponse(
      {
        result: computed.result,
        block_reason: computed.block_reason,
        screening_id: screeningId,
        scheduled_deletion_at: computed.scheduled_deletion_at,
      },
      200,
    );
  } catch (e) {
    if (e instanceof HttpError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    console.error("[validate-health-screening] unexpected error", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
