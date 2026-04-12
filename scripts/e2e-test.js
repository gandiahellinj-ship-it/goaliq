#!/usr/bin/env node
/**
 * GoalIQ E2E Test CLI
 * Authenticates as test-qa@goaliq.app (or the env TEST_EMAIL/TEST_PASSWORD)
 * and calls GET /api/qa/e2e with the session token.
 *
 * Run:  pnpm run e2e
 *   or: node scripts/e2e-test.js
 */

const TEST_EMAIL    = process.env.TEST_EMAIL    ?? "test-qa@goaliq.app";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "TestQA2026!";

function resolveApiBase() {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}`;
  const port = process.env.API_PORT ?? process.env.PORT ?? "8080";
  return `http://localhost:${port}`;
}

async function getToken() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error("❌ SUPABASE_URL / SUPABASE_ANON_KEY not set");
    return null;
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body:    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn(`⚠️  Sign-in failed (${res.status}): ${err.msg ?? err.error_description ?? "unknown"}`);
    console.warn("    Proceeding without auth — the E2E endpoint requires a valid session.");
    return null;
  }

  const data = await res.json();
  return data.access_token ?? null;
}

const apiBase = resolveApiBase();
const endpoint = `${apiBase}/api/qa/e2e`;

console.log("===== GOALIQ E2E TEST REPORT =====");
console.log(`Endpoint: ${endpoint}`);
console.log(`Auth user: ${TEST_EMAIL}`);
console.log("Ejecutando tests… (puede tardar 1-2 minutos)\n");

// 1. Obtain session token
const token = await getToken();

// 2. Call E2E endpoint
let report;
try {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    console.error(`❌ Server responded with ${res.status}`);
    process.exit(1);
  }
  report = await res.json();
} catch (err) {
  console.error(`❌ Request failed: ${err.message}`);
  process.exit(1);
}

const { timestamp, summary, results } = report;

// ─── Header ──────────────────────────────────────────────────────────────────

console.log(`Date: ${new Date(timestamp).toLocaleString("es-ES")}`);

const passing  = results.filter((r) => r.status === "pass");
const failing  = results.filter((r) => r.status === "fail");
const warnings = results.filter((r) => r.status === "warn");

console.log(`✅ PASSING  ${passing.length}/${summary.total}`);
console.log(`❌ FAILING  ${failing.length}/${summary.total}`);
console.log(`⚠️  WARNINGS ${warnings.length}/${summary.total}\n`);

// ─── All results ─────────────────────────────────────────────────────────────

for (const r of results) {
  const icon =
    r.status === "pass" ? "✅" :
    r.status === "fail" ? "❌" :
    r.status === "warn" ? "⚠️ " : "⏭️ ";
  const detail = r.detail ? ` — ${r.detail}` : "";
  console.log(`${icon} ${String(r.id).padStart(2, "0")}: ${r.name}${detail}`);
  if (r.warnings) {
    for (const w of r.warnings) console.log(`         ↳ ${w}`);
  }
}

// ─── Failing issues ───────────────────────────────────────────────────────────

if (failing.length > 0) {
  console.log("\n===== CRITICAL ISSUES =====");
  for (const r of failing) {
    console.log(`❌ ${String(r.id).padStart(2, "0")} ${r.name}: ${r.detail ?? "no detail"}`);
  }
}

// ─── Warnings ────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.log("\n===== WARNINGS =====");
  for (const r of warnings) {
    console.log(`⚠️  ${String(r.id).padStart(2, "0")} ${r.name}: ${r.detail ?? ""}`);
    if (r.warnings) {
      for (const w of r.warnings) console.log(`     ${w}`);
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n===== OVERALL STATUS =====");
const statusIcon =
  summary.status === "ALL GOOD"        ? "🟢" :
  summary.status === "NEEDS ATTENTION" ? "🟡" : "🔴";
console.log(`${statusIcon} ${summary.status}`);
console.log(`Time taken: ${(summary.durationMs / 1000).toFixed(1)}s\n`);

process.exit(failing.length > 0 ? 1 : 0);
