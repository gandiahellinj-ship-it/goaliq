import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const STRIPE_PRICE_ID = "price_1TFYJVAC9aQrlGDtdvlFPtjX";

const TEST_PROFILE = {
  age:                 30,
  sex:                 "male",
  heightCm:            175,
  weightKg:            75,
  targetWeightKg:      70,
  goalType:            "lose_weight",
  dietType:            "omnivore",
  trainingLevel:       "intermediate",
  trainingDaysPerWeek: 3,
  trainingLocation:    "gym",
  allergies:           [] as string[],
  likedFoods:          [] as string[],
  dislikedFoods:       [] as string[],
};

const ENGLISH_FOOD_WORDS = [
  "chicken", "rice", "beef", "soup", "bread",
  "eggs", "pasta", "tuna",
];
// Note: "salad" excluded — "ensalada" (Spanish) is a false positive substring match
// Note: "salmon" excluded — same as Spanish "salmón"
function hasEnglishFoodWord(mealName: string): boolean {
  const lower = mealName.toLowerCase();
  return ENGLISH_FOOD_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = "pass" | "fail" | "warn" | "skip";

interface TestResult {
  id:        number;
  name:      string;
  status:    TestStatus;
  detail?:   string;
  warnings?: string[];
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function parseJwtUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function base(): string {
  return `http://localhost:${process.env.PORT}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function currentMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(now);
  mon.setDate(diff);
  return mon.toISOString().split("T")[0];
}

function apiHeaders(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function sbHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey:         process.env.SUPABASE_ANON_KEY!,
    Authorization:  `Bearer ${token}`,
  };
}

async function sbFrom(table: string, token: string, qs?: string): Promise<any[]> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: sbHeaders(token) });
  if (!res.ok) return [];
  return res.json() as Promise<any[]>;
}

async function sbDelete(table: string, token: string, qs: string): Promise<boolean> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}?${qs}`;
  const res = await fetch(url, { method: "DELETE", headers: sbHeaders(token) });
  return res.ok || res.status === 204;
}

async function sbInsert(table: string, token: string, body: object): Promise<boolean> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { ...sbHeaders(token), Prefer: "return=minimal" },
    body:    JSON.stringify(body),
  });
  return res.ok || res.status === 201 || res.status === 204;
}

async function safeFetch(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10_000, ...rest } = opts;
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...rest, signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
}

async function runTest(
  id: number,
  name: string,
  fn: () => Promise<{ status: TestStatus; detail?: string; warnings?: string[] }>,
): Promise<TestResult> {
  try {
    const r = await fn();
    return { id, name, ...r };
  } catch (err: any) {
    const msg = err.name === "AbortError" ? "Timed out" : (err.message ?? String(err));
    return { id, name, status: "fail", detail: msg };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/qa/e2e", async (req, res) => {
  res.setTimeout(180_000);

  const startMs  = Date.now();
  const results: TestResult[] = [];

  let token  = "";
  let userId = "";
  let mealDays: any[] = [];
  let savedMealPlanId: string | null = null;

  // ── TEST 1: Authentication ─────────────────────────────────────────────────
  results.push(await runTest(1, "Authentication", async () => {
    const fromHeader = extractBearerToken(req);
    if (fromHeader) {
      // Use the caller's session token
      const uid = parseJwtUserId(fromHeader);
      if (!uid) return { status: "fail", detail: "Could not parse user ID from Authorization token" };
      token  = fromHeader;
      userId = uid;
      return { status: "pass", detail: `Using caller session (uid=${userId.slice(0, 8)}…)` };
    }

    // Fallback: try Supabase password sign-in for a dedicated test user
    const sbRes = await safeFetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.SUPABASE_ANON_KEY! },
        body:    JSON.stringify({ email: "test-qa@goaliq.app", password: "TestQA2026!" }),
        timeoutMs: 10_000,
      },
    );
    if (sbRes.ok) {
      const d = await sbRes.json() as any;
      if (d.access_token && d.user?.id) {
        token  = d.access_token;
        userId = d.user.id;
        return { status: "pass", detail: `Signed in as test-qa@goaliq.app (${userId.slice(0, 8)}…)` };
      }
    }

    return {
      status: "fail",
      detail: "No Authorization header supplied and test-qa@goaliq.app sign-in failed. Open the QA modal while logged in to run E2E with your session.",
    };
  }));

  if (!token) {
    for (let i = 2; i <= 15; i++) {
      results.push({ id: i, name: `Test ${i}`, status: "skip", detail: "Skipped: authentication failed" });
    }
    return res.json(buildReport(results, startMs));
  }

  // ── TEST 2: Profile ────────────────────────────────────────────────────────
  results.push(await runTest(2, "Profile in Supabase", async () => {
    const [row] = await sbFrom("profiles", token, `select=age,sex,height_cm,weight_kg,goal,diet_type&id=eq.${userId}`);
    if (row) {
      const missing = (["age", "sex", "height_cm", "weight_kg", "goal", "diet_type"] as const)
        .filter((k) => row[k] == null);
      if (missing.length > 0) return { status: "warn", detail: `Profile exists but missing: ${missing.join(", ")}` };
      return { status: "pass", detail: `Profile exists (goal=${row.goal}, diet=${row.diet_type})` };
    }

    // Create a test profile
    const apiRes = await safeFetch(`${base()}/api/onboarding`, {
      method:  "POST",
      headers: apiHeaders(token),
      body:    JSON.stringify(TEST_PROFILE),
      timeoutMs: 10_000,
    });
    if (!apiRes.ok) {
      const b = await apiRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /onboarding → ${apiRes.status}: ${b?.error ?? "unknown"}` };
    }
    return { status: "pass", detail: "Profile created via onboarding" };
  }));

  // ── TEST 3: Food preferences ───────────────────────────────────────────────
  results.push(await runTest(3, "Food preferences", async () => {
    const rows = await sbFrom("food_preferences", token, `select=user_id&user_id=eq.${userId}`);
    if (rows.length > 0) return { status: "pass", detail: "food_preferences row exists" };
    // Create it if missing (onboarding creates it, but just in case)
    const ok = await sbInsert("food_preferences", token, {
      user_id: userId, allergies: [], liked_foods: [], disliked_foods: [],
    });
    return ok
      ? { status: "pass", detail: "food_preferences row created" }
      : { status: "fail", detail: "No food_preferences row and could not create one" };
  }));

  // ── TEST 4: AI Meal plan generation ───────────────────────────────────────
  results.push(await runTest(4, "AI Meal plan generation", async () => {
    const apiRes = await safeFetch(`${base()}/api/meals`, {
      method: "POST", headers: apiHeaders(token), timeoutMs: 90_000,
    });
    if (!apiRes.ok) {
      const b = await apiRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /meals → ${apiRes.status}: ${b?.error ?? "unknown"}` };
    }
    const data  = await apiRes.json() as any;
    mealDays    = Array.isArray(data.days) ? data.days : [];

    if (mealDays.length !== 7) return { status: "fail", detail: `Expected 7 days, got ${mealDays.length}` };

    const totalMeals = mealDays.reduce((s: number, d: any) => s + (d.meals?.length ?? 0), 0);
    if (totalMeals < 21) return { status: "fail", detail: `Expected 21 meals total, got ${totalMeals}` };

    const emptyDays = mealDays.filter((d: any) => !d.meals || d.meals.length < 3);
    if (emptyDays.length > 0) {
      return { status: "fail", detail: `Days missing meals: ${emptyDays.map((d: any) => d.day).join(", ")}` };
    }

    let ingredientsFail = false;
    for (const day of mealDays) {
      for (const meal of day.meals ?? []) {
        if (!meal.ingredients || meal.ingredients.length < 2) ingredientsFail = true;
      }
    }
    if (ingredientsFail) return { status: "fail", detail: "Some meals have fewer than 2 ingredients" };

    // Capture saved ID if server returned one
    const mealPlanId = (data as any).id;
    if (mealPlanId) savedMealPlanId = String(mealPlanId);

    const englishMeals: string[] = [];
    for (const day of mealDays) {
      for (const meal of day.meals ?? []) {
        if (hasEnglishFoodWord(meal.name ?? "")) {
          englishMeals.push(`${day.day}/${meal.mealType}: "${meal.name}"`);
        }
      }
    }

    if (englishMeals.length > 0) {
      return {
        status:   "warn",
        detail:   `${totalMeals} meals generated`,
        warnings: [`${englishMeals.length} meals may have English names: ${englishMeals.join("; ")}`],
      };
    }
    return { status: "pass", detail: `${totalMeals} meals generated (all in Spanish)` };
  }));

  // ── TEST 5: Meal plan saved to database ───────────────────────────────────
  results.push(await runTest(5, "Meal plan saved to database", async () => {
    if (mealDays.length === 0) return { status: "fail", detail: "No meal days from TEST 4" };
    const weekStart = currentMonday();

    // POST /meals now saves to DB server-side — just verify via GET
    const getRes = await safeFetch(`${base()}/api/meals`, { headers: apiHeaders(token) });
    if (!getRes.ok) return { status: "fail", detail: `GET /meals → ${getRes.status}` };
    const data = await getRes.json() as any;

    // Also try to look up the ID for cleanup (if not already set from TEST 4)
    if (!savedMealPlanId) {
      const [row] = await sbFrom("meal_plans", token, `select=id&user_id=eq.${userId}&week_start=eq.${weekStart}`);
      savedMealPlanId = row?.id ?? null;
    }

    if (!data.days || data.days.length !== 7) {
      return { status: "fail", detail: `GET /meals returned ${data.days?.length ?? 0} days (expected 7)` };
    }
    return { status: "pass", detail: `Meal plan saved (week_start=${weekStart}, id=${savedMealPlanId})` };
  }));

  // ── TEST 6: AI Workout plan generation ────────────────────────────────────
  let workoutDays: any[] = [];
  results.push(await runTest(6, "AI Workout plan generation", async () => {
    const apiRes = await safeFetch(`${base()}/api/workouts`, {
      method: "POST", headers: apiHeaders(token), timeoutMs: 90_000,
    });
    if (!apiRes.ok) {
      const b = await apiRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /workouts → ${apiRes.status}: ${b?.error ?? "unknown"}` };
    }
    const data   = await apiRes.json() as any;
    workoutDays  = data.days ?? [];
    const count  = workoutDays.length;
    if (count < 1) return { status: "fail", detail: `Got 0 workout days` };

    const englishWorkouts: string[] = [];
    for (const day of workoutDays) {
      const exercises = day.exercises ?? [];
      if (exercises.length < 4) {
        return { status: "fail", detail: `Day "${day.day_name}" has only ${exercises.length} exercises (≥4 required)` };
      }
      for (const ex of exercises) {
        if (!ex.name) return { status: "fail", detail: "Exercise missing name" };
        if (ex.sets == null) return { status: "fail", detail: `"${ex.name}" missing sets` };
        if (!ex.reps && !ex.duration) return { status: "fail", detail: `"${ex.name}" missing reps/duration` };
      }
      const wt = (day.workout_type ?? "").toLowerCase();
      if (/\b(workout|training|session)\b/.test(wt)) {
        englishWorkouts.push(`${day.day_name}: "${day.workout_type}"`);
      }
    }

    if (englishWorkouts.length > 0) {
      return {
        status:   "warn",
        detail:   `${count} workouts generated`,
        warnings: [`${englishWorkouts.length} workout types may be in English: ${englishWorkouts.join("; ")}`],
      };
    }
    return { status: "pass", detail: `${count} workout days with ≥4 exercises each` };
  }));

  // ── TEST 7: Workout plan saved to database ────────────────────────────────
  const weekStart = currentMonday();
  results.push(await runTest(7, "Workout plan saved to database", async () => {
    // Use GET /api/workouts (pg.Pool, bypasses RLS) instead of sbFrom which uses
    // Supabase REST — workout_plans has no authenticated SELECT policy so sbFrom
    // always returns [] even when the row exists.
    const getRes = await safeFetch(`${base()}/api/workouts`, { headers: apiHeaders(token) });
    if (!getRes.ok) return { status: "fail", detail: `GET /workouts → ${getRes.status}` };
    const data = await getRes.json() as any;
    const count = (data.days ?? []).length;
    if (count === 0) return { status: "fail", detail: "Workout plan has 0 days after POST" };
    return { status: "pass", detail: `Workout plan saved (${count} training days, week ${data.weekStart ?? weekStart})` };
  }));

  // ── TEST 8: Shopping list (ingredients) ───────────────────────────────────
  results.push(await runTest(8, "Shopping list generation", async () => {
    if (mealDays.length === 0) return { status: "fail", detail: "No meal plan available" };
    const allNames: string[] = [];
    const categories = new Set<string>();
    for (const day of mealDays) {
      for (const meal of day.meals ?? []) {
        for (const ing of meal.ingredients ?? []) {
          if (ing.name) allNames.push(ing.name.toLowerCase());
          if (ing.category) categories.add(ing.category);
        }
      }
    }
    const unique = new Set(allNames);
    if (unique.size < 20) return { status: "fail", detail: `Only ${unique.size} unique ingredients (need ≥20)` };
    return { status: "pass", detail: `${unique.size} unique ingredients across ${categories.size} categories` };
  }));

  // ── TEST 9: Calendar - mark workout complete ──────────────────────────────
  results.push(await runTest(9, "Calendar - mark workout complete", async () => {
    const apiRes = await safeFetch(`${base()}/api/calendar/complete`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ date: today(), isCompleted: true }),
    });
    if (!apiRes.ok) {
      const b = await apiRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /calendar/complete → ${apiRes.status}: ${b?.error ?? "unknown"}` };
    }
    return { status: "pass", detail: `Calendar event saved for ${today()}` };
  }));

  // ── TEST 10: Flex Day ──────────────────────────────────────────────────────
  results.push(await runTest(10, "Flex Day", async () => {
    const flexDate = today();

    // Clean any existing
    await safeFetch(`${base()}/api/flex-days`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ date: flexDate, remove: true }),
    });

    // Add
    const addRes = await safeFetch(`${base()}/api/flex-days`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ date: flexDate }),
    });
    if (!addRes.ok) {
      const b = await addRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `Add flex day → ${addRes.status}: ${b?.error ?? "unknown"}` };
    }

    // Duplicate (must be graceful)
    const dupRes = await safeFetch(`${base()}/api/flex-days`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ date: flexDate }),
    });
    if (!dupRes.ok) {
      return { status: "fail", detail: `Duplicate add returned ${dupRes.status} (expected graceful handling)` };
    }

    // Remove
    const removeRes = await safeFetch(`${base()}/api/flex-days`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ date: flexDate, remove: true }),
    });
    if (!removeRes.ok) {
      const b = await removeRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `Remove flex day → ${removeRes.status}: ${b?.error ?? "unknown"}` };
    }

    return { status: "pass", detail: "Flex day added (duplicate graceful), removed successfully" };
  }));

  // ── TEST 11: Progress logging ─────────────────────────────────────────────
  results.push(await runTest(11, "Progress logging", async () => {
    const saveRes = await safeFetch(`${base()}/api/progress`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ weightKg: 75 }),
    });
    if (!saveRes.ok) {
      const b = await saveRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /progress → ${saveRes.status}: ${b?.error ?? "unknown"}` };
    }
    const getRes = await safeFetch(`${base()}/api/progress`, { headers: apiHeaders(token) });
    if (!getRes.ok) return { status: "fail", detail: `GET /progress → ${getRes.status}` };
    const data = await getRes.json() as any;
    if (data.currentWeightKg == null) return { status: "fail", detail: "No currentWeightKg in response" };
    return { status: "pass", detail: `Weight: ${data.currentWeightKg}kg, history: ${data.weightHistory?.length ?? 0} entries` };
  }));

  // ── TEST 12: Streak calculation ───────────────────────────────────────────
  results.push(await runTest(12, "Streak calculation", async () => {
    // Mark last 3 days as completed
    const dates = [today(), daysAgo(1), daysAgo(2)];
    for (const date of dates) {
      await safeFetch(`${base()}/api/calendar/complete`, {
        method: "POST", headers: apiHeaders(token),
        body: JSON.stringify({ date, isCompleted: true }),
      });
    }

    const calRes = await safeFetch(`${base()}/api/calendar`, { headers: apiHeaders(token) });
    const calData = await calRes.json() as any;
    const completedDates = new Set(
      (calData.events ?? [])
        .filter((e: any) => e.eventType === "workout" && e.isCompleted === true)
        .map((e: any) => e.date as string)
    );
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 366; i++) {
      const ds = cursor.toISOString().split("T")[0];
      if (completedDates.has(ds)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }

    if (streak < 3) return { status: "fail", detail: `Streak = ${streak} (expected ≥ 3)` };
    return { status: "pass", detail: `Streak = ${streak} consecutive completed days` };
  }));

  // ── TEST 13: Stripe - checkout session ────────────────────────────────────
  results.push(await runTest(13, "Stripe - checkout session", async () => {
    const apiRes = await safeFetch(`${base()}/api/checkout`, {
      method: "POST", headers: apiHeaders(token),
      body: JSON.stringify({ priceId: STRIPE_PRICE_ID }),
    });
    if (!apiRes.ok) {
      const b = await apiRes.json().catch(() => ({})) as any;
      return { status: "fail", detail: `POST /checkout → ${apiRes.status}: ${b?.error ?? "unknown"}` };
    }
    const data = await apiRes.json() as any;
    if (!data.url?.startsWith("https://checkout.stripe.com")) {
      return { status: "fail", detail: `Bad URL: ${data.url ?? "none"}` };
    }
    return { status: "pass", detail: "Valid Stripe checkout URL returned" };
  }));

  // ── TEST 14: Language check - Spanish meal names ──────────────────────────
  results.push(await runTest(14, "Language check - Spanish", async () => {
    if (mealDays.length === 0) return { status: "skip", detail: "No meal plan from TEST 4" };
    const englishMeals: string[] = [];
    for (const day of mealDays) {
      for (const meal of day.meals ?? []) {
        if (hasEnglishFoodWord(meal.name ?? "")) {
          englishMeals.push(`${day.day} ${meal.mealType}: "${meal.name}"`);
        }
      }
    }
    if (englishMeals.length > 0) {
      return { status: "warn", detail: `${englishMeals.length} meals with English food words`, warnings: englishMeals };
    }
    return { status: "pass", detail: "No common English food words in meal names" };
  }));

  // ── TEST 15: Data cleanup ─────────────────────────────────────────────────
  results.push(await runTest(15, "Data cleanup", async () => {
    const errors: string[] = [];

    // Only delete the meal plan we created in this run
    if (savedMealPlanId) {
      const ok = await sbDelete("meal_plans", token, `id=eq.${savedMealPlanId}`);
      if (!ok) errors.push("meal_plans");
    } else {
      // Fallback: delete by week_start
      await sbDelete("meal_plans", token, `user_id=eq.${userId}&week_start=eq.${weekStart}`);
    }

    // Delete the workout plan + calendar events we created this week
    await sbDelete("workout_plans", token, `user_id=eq.${userId}&week_start=eq.${weekStart}`);
    await sbDelete("calendar_events", token, `user_id=eq.${userId}&date=gte.${weekStart}`);

    // Delete the progress entry we created (weightKg=75, created just now — last minute)
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    await sbDelete("weight_entries", token, `user_id=eq.${userId}&created_at=gte.${oneMinAgo}`);

    // Clean up flex days
    for (const date of [today(), daysAgo(1), daysAgo(2)]) {
      await safeFetch(`${base()}/api/flex-days`, {
        method: "POST", headers: apiHeaders(token),
        body: JSON.stringify({ date, remove: true }),
      }).catch(() => null);
    }

    if (errors.length > 0) return { status: "warn", detail: `Could not delete: ${errors.join(", ")}` };
    return { status: "pass", detail: "Test data removed (profile and food prefs preserved)" };
  }));

  return res.json(buildReport(results, startMs));
});

// ─── Report builder ───────────────────────────────────────────────────────────

function buildReport(results: TestResult[], startMs: number) {
  const passing  = results.filter((r) => r.status === "pass").length;
  const failing  = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const total    = results.length;
  const durationMs = Date.now() - startMs;

  const status =
    failing === 0 ? "ALL GOOD" :
    failing <= 3  ? "NEEDS ATTENTION" :
                   "CRITICAL ISSUES";

  return {
    timestamp: new Date().toISOString(),
    summary:   { total, passing, failing, warnings, status, durationMs },
    results,
  };
}

export default router;
