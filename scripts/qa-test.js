#!/usr/bin/env node
/**
 * GoalIQ QA Test Script
 * Run: node scripts/qa-test.js
 *   or: pnpm run qa (from root)
 */

import pg from "pg";

const REQUIRED_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "STRIPE_SECRET_KEY",
  "RAPIDAPI_KEY",
];

const SUPABASE_TABLES = [
  "profiles",
  "food_preferences",
  "meal_plans",
  "workout_plans",
  "progress_logs",
  "calendar_events",
];

const LOCAL_PG_TABLES = ["stripe_users", "flex_days", "workout_history"];

const AUTHENTICATED_API_ROUTES = [
  { method: "GET",  path: "/api/meals" },
  { method: "GET",  path: "/api/workouts" },
  { method: "GET",  path: "/api/flex-days" },
  { method: "GET",  path: "/api/progress" },
];

const FRONTEND_ROUTES = [
  "/",
  "/dashboard",
  "/meals",
  "/workouts",
  "/calendar",
  "/progress",
  "/shopping",
  "/billing",
  "/pricing",
];

// ── Result tracking ──────────────────────────────────────────────────────────

const passing  = [];
const failing  = [];
const warnings = [];

function pass(label)           { passing.push(label); }
function fail(label, reason)   { failing.push({ label, reason }); }
function warn(label, reason)   { warnings.push({ label, reason }); }

// ── Resolve base URLs ────────────────────────────────────────────────────────

function resolveApiBase() {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}`;
  const port = process.env.API_PORT || process.env.PORT || "3001";
  return `http://localhost:${port}`;
}

function resolveFrontendBase() {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}`;
  return `http://localhost:${process.env.FRONTEND_PORT || "5173"}`;
}

// ── 1. Environment Variables ─────────────────────────────────────────────────

function checkEnvVars() {
  for (const name of REQUIRED_ENV_VARS) {
    if (process.env[name]) {
      pass(`Env: ${name}`);
    } else {
      fail(`Env: ${name}`, "MISSING");
    }
  }
}

// ── 2. Local PostgreSQL Tables ───────────────────────────────────────────────

async function checkLocalPgTables() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("Local PostgreSQL", "DATABASE_URL not set");
    return;
  }

  let pool;
  try {
    pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    await pool.query("SELECT 1"); // connectivity check
    pass("Local PostgreSQL: connection OK");

    for (const table of LOCAL_PG_TABLES) {
      try {
        const result = await pool.query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1
           ) AS exists`,
          [table],
        );
        if (result.rows[0].exists) {
          pass(`Local PG table: ${table}`);
        } else {
          fail(`Local PG table: ${table}`, "Table does not exist");
        }
      } catch (err) {
        fail(`Local PG table: ${table}`, err.message);
      }
    }
  } catch (err) {
    fail("Local PostgreSQL: connection", err.message);
  } finally {
    await pool?.end();
  }
}

// ── 3. Supabase Tables (via REST API) ────────────────────────────────────────

async function checkSupabaseTables() {
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    fail("Supabase tables", "SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping");
    return;
  }

  for (const table of SUPABASE_TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok || res.status === 401 || res.status === 403) {
        // 200/401/403 all mean the table exists (RLS may block anon access)
        pass(`Supabase table: ${table}`);
      } else {
        const body = await res.json().catch(() => ({}));
        const code  = body?.code ?? res.status;
        if (code === "42P01" || code === "PGRST102") {
          fail(`Supabase table: ${table}`, "Table does not exist");
        } else {
          warn(`Supabase table: ${table}`, `Status ${res.status} — ${body?.message ?? "unknown error"}`);
        }
      }
    } catch (err) {
      fail(`Supabase table: ${table}`, `Request failed: ${err.message}`);
    }
  }
}

// ── 4. API Endpoints ─────────────────────────────────────────────────────────

async function checkApiEndpoints() {
  const apiBase = resolveApiBase();

  // Health endpoint — no auth
  try {
    const res = await fetch(`${apiBase}/api/healthz`);
    if (res.ok) {
      pass("API GET /api/healthz: 200 OK");
    } else {
      fail("API GET /api/healthz", `Status ${res.status}`);
    }
  } catch (err) {
    fail("API GET /api/healthz", `Request failed: ${err.message}`);
  }

  // Exercise GIF — may or may not require auth
  try {
    const res = await fetch(`${apiBase}/api/exercises/gif?name=squat`);
    if (res.ok || res.status === 401) {
      pass(`API GET /api/exercises/gif: reachable (${res.status})`);
    } else {
      warn("API GET /api/exercises/gif", `Status ${res.status}`);
    }
  } catch (err) {
    fail("API GET /api/exercises/gif", `Request failed: ${err.message}`);
  }

  // Auth-required routes — expect 401 when called without token
  for (const { method, path } of AUTHENTICATED_API_ROUTES) {
    try {
      const res = await fetch(`${apiBase}${path}`, { method });
      if (res.status === 401) {
        pass(`API ${method} ${path}: auth guard works (401)`);
      } else if (res.status >= 500) {
        fail(`API ${method} ${path}`, `Server error: ${res.status}`);
      } else if (res.ok) {
        warn(`API ${method} ${path}`, `Expected 401 but got ${res.status} — route may be unprotected`);
      } else {
        pass(`API ${method} ${path}: responds (${res.status})`);
      }
    } catch (err) {
      fail(`API ${method} ${path}`, `Request failed: ${err.message}`);
    }
  }
}

// ── 5. Frontend Routes ───────────────────────────────────────────────────────

async function checkFrontendRoutes() {
  const frontendBase = resolveFrontendBase();

  for (const route of FRONTEND_ROUTES) {
    try {
      const res = await fetch(`${frontendBase}${route}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        pass(`Frontend route ${route}: ${res.status}`);
      } else {
        fail(`Frontend route ${route}`, `Status ${res.status}`);
      }
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        warn(`Frontend route ${route}`, "Request timed out — server may not be running");
      } else {
        fail(`Frontend route ${route}`, `Request failed: ${err.message}`);
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

function printReport() {
  const timestamp = new Date().toISOString();

  console.log("\n===== GOALIQ QA REPORT =====");
  console.log(`Date: ${timestamp}\n`);

  if (passing.length > 0) {
    console.log(`✅ PASSING (${passing.length} tests)`);
    for (const p of passing) console.log(`  - ${p}`);
    console.log();
  }

  if (failing.length > 0) {
    console.log(`❌ FAILING (${failing.length} tests)`);
    for (const f of failing) console.log(`  - ${f.label}: ${f.reason}`);
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length} tests)`);
    for (const w of warnings) console.log(`  - ${w.label}: ${w.reason}`);
    console.log();
  }

  const status =
    failing.length === 0 ? "HEALTHY" :
    failing.length <= 3  ? "NEEDS ATTENTION" :
                           "CRITICAL";

  console.log("===== SUMMARY =====");
  console.log(`${passing.length} passing, ${failing.length} failing, ${warnings.length} warnings`);
  console.log(`Status: ${status}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("Running GoalIQ QA checks…\n");

checkEnvVars();

await Promise.all([
  checkLocalPgTables(),
  checkSupabaseTables(),
  checkApiEndpoints(),
  checkFrontendRoutes(),
]);

printReport();

process.exit(failing.length > 0 ? 1 : 0);
