import { Router, type IRouter, type Request } from "express";
import pg from "pg";

const router: IRouter = Router();

// ── Types ────────────────────────────────────────────────────────────────────

type TestResult = {
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const AUTH_ROUTES = [
  { method: "GET",  path: "/api/meals" },
  { method: "GET",  path: "/api/workouts" },
  { method: "GET",  path: "/api/flex-days" },
  { method: "GET",  path: "/api/progress" },
];

function selfUrl(): string {
  return `http://localhost:${process.env.PORT}`;
}

// ── Check functions ───────────────────────────────────────────────────────────

function checkEnvVars(): TestResult[] {
  return REQUIRED_ENV_VARS.map((name) => ({
    label: `Env: ${name}`,
    status: process.env[name] ? "pass" : "fail",
    detail: process.env[name] ? undefined : "MISSING",
  }));
}

async function checkLocalPgTables(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return [{ label: "Local PostgreSQL", status: "fail", detail: "DATABASE_URL not set" }];
  }

  let pool: pg.Pool | null = null;
  try {
    pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    await pool.query("SELECT 1");
    results.push({ label: "Local PostgreSQL: connection", status: "pass" });

    for (const table of LOCAL_PG_TABLES) {
      try {
        const r = await pool.query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1
           ) AS "exists"`,
          [table],
        );
        if (r.rows[0].exists) {
          results.push({ label: `Local PG table: ${table}`, status: "pass" });
        } else {
          results.push({ label: `Local PG table: ${table}`, status: "fail", detail: "Table does not exist" });
        }
      } catch (err: any) {
        results.push({ label: `Local PG table: ${table}`, status: "fail", detail: err.message });
      }
    }
  } catch (err: any) {
    results.push({ label: "Local PostgreSQL: connection", status: "fail", detail: err.message });
  } finally {
    await pool?.end();
  }

  return results;
}

async function checkSupabaseTables(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [{
      label: "Supabase tables",
      status: "fail",
      detail: "SUPABASE_URL or SUPABASE_ANON_KEY not set",
    }];
  }

  for (const table of SUPABASE_TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (res.ok || res.status === 401 || res.status === 403) {
        results.push({ label: `Supabase table: ${table}`, status: "pass" });
      } else {
        const body = await res.json().catch(() => ({})) as any;
        const code  = body?.code ?? String(res.status);
        if (code === "42P01" || code === "PGRST102" || res.status === 404) {
          results.push({ label: `Supabase table: ${table}`, status: "fail", detail: "Table does not exist" });
        } else {
          results.push({
            label:  `Supabase table: ${table}`,
            status: "warn",
            detail: `Status ${res.status} — ${body?.message ?? "unknown"}`,
          });
        }
      }
    } catch (err: any) {
      results.push({ label: `Supabase table: ${table}`, status: "fail", detail: err.message });
    }
  }

  return results;
}

async function checkApiEndpoints(token?: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const base = selfUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Health check (no auth)
  try {
    const res = await fetch(`${base}/api/healthz`);
    results.push({
      label:  "API GET /api/healthz",
      status: res.ok ? "pass" : "fail",
      detail: res.ok ? undefined : `Status ${res.status}`,
    });
  } catch (err: any) {
    results.push({ label: "API GET /api/healthz", status: "fail", detail: err.message });
  }

  // Exercise GIF endpoint
  try {
    const res = await fetch(`${base}/api/exercises/gif?name=squat`, { headers });
    const ok = res.ok || res.status === 401;
    results.push({
      label:  "API GET /api/exercises/gif",
      status: ok ? "pass" : "warn",
      detail: ok ? `reachable (${res.status})` : `Status ${res.status}`,
    });
  } catch (err: any) {
    results.push({ label: "API GET /api/exercises/gif", status: "fail", detail: err.message });
  }

  // Auth-required routes
  for (const { method, path } of AUTH_ROUTES) {
    try {
      const res = await fetch(`${base}${path}`, { method, headers });

      if (token) {
        // With auth: expect 200 or 404, not 401/500
        if (res.ok || res.status === 404) {
          results.push({ label: `API ${method} ${path}`, status: "pass", detail: `${res.status}` });
        } else if (res.status === 401) {
          results.push({ label: `API ${method} ${path}`, status: "fail", detail: "Auth token rejected (401)" });
        } else if (res.status >= 500) {
          results.push({ label: `API ${method} ${path}`, status: "fail", detail: `Server error ${res.status}` });
        } else {
          results.push({ label: `API ${method} ${path}`, status: "warn", detail: `Status ${res.status}` });
        }
      } else {
        // Without auth: expect 401
        if (res.status === 401) {
          results.push({ label: `API ${method} ${path}`, status: "pass", detail: "auth guard works (401)" });
        } else if (res.status >= 500) {
          results.push({ label: `API ${method} ${path}`, status: "fail", detail: `Server error ${res.status}` });
        } else {
          results.push({ label: `API ${method} ${path}`, status: "warn", detail: `Expected 401, got ${res.status}` });
        }
      }
    } catch (err: any) {
      results.push({ label: `API ${method} ${path}`, status: "fail", detail: err.message });
    }
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/qa", async (req: Request, res) => {
  // Allow unauthenticated access (dev tool); token used for richer API tests when available
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? undefined;

  try {
    const [pgResults, supabaseResults, apiResults] = await Promise.all([
      checkLocalPgTables(),
      checkSupabaseTables(),
      checkApiEndpoints(token),
    ]);

    const allResults: TestResult[] = [
      ...checkEnvVars(),
      ...pgResults,
      ...supabaseResults,
      ...apiResults,
    ];

    const passing  = allResults.filter((r) => r.status === "pass");
    const failing  = allResults.filter((r) => r.status === "fail");
    const warnings = allResults.filter((r) => r.status === "warn");

    const status =
      failing.length === 0 ? "HEALTHY" :
      failing.length <= 3  ? "NEEDS ATTENTION" :
                             "CRITICAL";

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        passing:  passing.length,
        failing:  failing.length,
        warnings: warnings.length,
        status,
      },
      results: allResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: "QA check failed", detail: err.message });
  }
});

export default router;
