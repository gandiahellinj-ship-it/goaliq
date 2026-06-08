# Known Bugs - Historical Reference

## Active Bugs

**🏆 ZERO active bugs (historic milestone, v0.9.17).**

All identified bugs have been resolved through v0.9.17. See "Resolved Bugs" below for the historical record (20 entries).

The next entry here should appear only when a new bug is identified — until then, this section serves as the proud watermark of a clean backlog.

## Resolved Bugs (#1-#9, A, B, C, D, E, F partial, F.tooltip, G, H, I, J, K, L, M, N)

### BUG #1 - Pace copy goal-aware
- **Discovered**: 2026-06-05 (E2E test)
- **Severity**: 🟡 Medium
- **Symptom**: Onboarding Step 3 showed "déficit kcal" for all goals
- **Root cause**: Two structures (GOAL_DETAILS vs paceOptions), render used wrong one
- **Fix**: Source of truth unification (v0.9.3 commit 61f8883)
- **Lesson**: Watch for duplicate data structures with overlapping purpose

### BUG #2 - progress_logs table missing
- **Discovered**: 2026-06-06 (E2E test)
- **Severity**: 🔴 Critical
- **Symptom**: Frontend called inexistent table → 404 PGRST205
- **Root cause**: M8 migration didn't recreate the table
- **Fix**: CREATE TABLE + migrate from backup (v0.9.2)
- **Lesson**: After major migrations, validate ALL tables exist

### BUG #3 - workout_plans schema mismatch
- **Discovered**: 2026-06-06
- **Severity**: 🔴 Critical
- **Symptom**: 400 Bad Request on workout_plans queries
- **Root cause**: M8 changed schema (day_name → days jsonb), frontend not updated
- **Fix**: useProgressStats updated (v0.9.2 commit e5ea6ff)
- **Lesson**: Schema changes require frontend audit

### BUG #5 - /api/workouts vs Supabase REST inconsistency
- **Discovered**: 2026-06-06
- **Severity**: 🟡 Medium
- **Symptom**: Dashboard showed "Generate plan" when plan existed
- **Root cause**: Two endpoints with different filtering philosophy
- **Fix**: Align both to "last plan ever" (v0.9.3 commit 444568c)
- **Lesson**: Endpoints serving same data must use same logic

### BUG #8 - used_at not cleaned on beta release
- **Discovered**: 2026-06-06
- **Severity**: 🟡 Medium
- **Symptom**: Beta codes showed timestamp after release
- **Root cause**: FK SET NULL doesn't affect other columns
- **Fix**: Explicit UPDATE in both endpoint + cron (v0.9.3 commit 42d35c2)
- **Lesson**: FK CASCADE behavior is limited; explicit cleanup needed

### BUG #9 - deletion_logs missing on manual delete
- **Discovered**: 2026-06-05
- **Severity**: 🔴 Critical
- **Symptom**: RGPD audit trail incomplete (only cron created entries)
- **Root cause**: Manual endpoint didn't INSERT before DELETE
- **Fix**: Atomic transaction with INSERT first (v0.9.1 commit 9c15790)
- **Lesson**: Audit logs must precede CASCADE deletions

### BUG A - Refresh navigates to step 2 of onboarding (RESOLVED v0.9.5)
- **Discovered**: 2026-06-07 (E2E test)
- **Severity**: 🔴 Critical
- **Symptom**: F5 on any authenticated page redirected user to step 2 of onboarding
- **Root cause**: Multi-layered race condition in AppLayout
  - useAuth rehydrates session asynchronously on refresh
  - profiles useEffect had setProfileLoading(false) in "not authenticated" branch
  - Redirect useEffect fired with stale state before query completed
- **Fix sequence**:
  - a32ed2f: Initial session?.access_token guard
  - ff694fb: Verbose debug logs for diagnosis
  - 005e2bc: Final fix - only flip profileLoading when auth CONFIRMED logged out (!isAuthenticated && !authLoading)
- **Tag**: v0.9.5
- **Lesson**:
  - Side effects in "skipping query" gates are a TRAP
  - Only manipulate state when CERTAIN of outcome
  - Race conditions in auth rehydration are easy to miss
  - Verbose logs are your superpower for diagnosis
- **Added column**: profiles.onboarding_completed_at TIMESTAMPTZ (replaces fragile age proxy)

### BUG L - Weight log notes invisible (RESOLVED v0.9.17)
- **Discovered**: 2026-06-07 (during E2E test)
- **Severity**: 🟡 Low (data not lost, but not displayed)
- **Symptom**: Notes field saved with weight logs was not rendered/visible in "Peso Corporal" tab. On investigation, the chain was broken in 4 separate places — a classic "data dropped at multiple hops" bug.
- **Root cause** (4-link broken chain):
  1. UI captured `note` in state but did NOT forward it to the mutation call
  2. `useLogWeight` mutation accepted only `weightKg: number`, dropping notes silently
  3. `weightHistory` mapping in `useProgressStats` selected only `date + weightKg`, dropping the `notes` column
  4. WeightTab had no UI element to render historic entries (only the chart) — even if notes had made it through, there was nowhere to display them
- **Fix**: fbd5241 — Repaired all 4 links AND added a new "Historial reciente" section to WeightTab so notes have a UX home:
  - LogWeightSheet.handleSubmit forwards `{ weightKg, notes }` payload
  - useLogWeight mutation accepts the payload, conditionally upserts notes (preserves existing on re-log without note)
  - ProgressStats.weightHistory type extended with `notes: string | null`
  - weightHistory mapping includes `notes` from `progress_logs.notes` column
  - WeightTab renders last 8 entries with date + weight + delta + note rendering
- **Tag**: v0.9.17
- **Lesson**:
  - Pattern 16 (Bug Field Saved But Never Displayed): trace the FULL pipeline UI → mutation → DB → query → render. Missing ANY link = invisible feature.
  - When a "feature exists but doesn't work", inventory each step from input to display. The bug may be in any one of them, or in multiple steps.
  - Schema check is necessary but not sufficient — the column existing in DB only means storage is ready, not that the pipeline reaches it.

### BUG F.tooltip - /progress subgroup chart tooltip (RESOLVED obsolete v0.9.17)
- **Discovered**: 2026-06-07 (after BUG D fix), partially fixed in v0.9.9
- **Severity**: 🟡 Low (UX nice-to-have)
- **Original symptom**: Subgroup line chart showed `week_start` on X-axis with no way to see individual `logged_at` dates on hover. Suggested fix was a custom Recharts Tooltip component.
- **Resolution**: v0.9.17 — Closed as **obsolete**. The target LineChart was completely removed in v0.9.16 redesign (SubgroupTab now uses cards with mini BarCharts that don't render Tooltips at all). The feature the original bug requested no longer has a place to live; the data it wanted to surface is now available through the per-muscle cards themselves.
- **Tag**: v0.9.17
- **Lesson**:
  - Bugs can become obsolete when the surrounding code is redesigned. Don't blindly fix every backlog item — sometimes the right move is "this no longer applies, close it".
  - When closing as obsolete, document WHY (which redesign made it moot, what replaced the original code path) so future readers understand the history.

### BUG N - Subgroup tab visual inconsistency + anatomical sub-muscles (RESOLVED v0.9.16)
- **Discovered**: 2026-06-08 during v0.9.15 E2E validation
- **Severity**: 🟡 Medium (UX consistency + product feature)
- **Symptom**: After v0.9.15 redesigned "Grupos musculares" with professional cards, the sibling tab "Por subgrupo" still used the old line chart layout. Additionally, original user request: Pectoral showed as one bar instead of being split into superior/medio/inferior.
- **Root cause**: Two issues bundled — UX consistency (LineChart vs cards mismatch) + missing anatomical refinement (catalog target stays generic "Pectorals" without bench-angle distinction).
- **Fix**: 91f4c40 — Two-pronged solution:
  1. SubgroupCardsView component replaces LineChart (mirrors GroupsCardsView from v0.9.15)
  2. inferSpecificMuscle helper added to both backend (aiGenerators.ts PHASE 3.5) and frontend (Progress.tsx, mirror for backward compat). Refines Pectoral by Incline/Decline/Flat keywords and Deltoides by Front/Lateral/Rear keywords.
- **Tag**: v0.9.16
- **Lesson**:
  - Bundle 2 features when they share architecture (cards + helper) — single release with coherent narrative > two atomic releases
  - Mirror helpers FE/BE strategy (Pattern 15) enables backward + forward compatibility without migration
  - Catalog target is generic for a reason (1 target per exercise = simple), but reading layer can refine it for richer UX
  - Defensive duplicate helper: keep in sync via comment + code review checklist

### BUG M - Tonnage confusion in Groups tab (RESOLVED v0.9.15)
- **Discovered**: 2026-06-08 during v0.9.14 E2E validation
- **Severity**: 🟡 Medium (semantic UX confusion)
- **Symptom**: Tab "Grupos musculares" showed weekly tonnage (Σ peso × reps per week per group) with Y axis labeled "kg". User read "432 kg" as a real weight lifted, but it was actually a volume metric.
- **Root cause**: A single line chart trying to communicate compound information (Σ weight × reps) using the wrong unit suffix ("kg" alone). Tonnage is a valid strength training metric but is meaningless without explicit "kg × reps" framing.
- **Fix**: 8cdb541 — Full redesign of GroupsTab from single line chart to 6 professional cards. Each card shows 4 explicit KPIs (Peso máx kg, Volumen sem. kg·r, Sets, Reps) + mini 6-week bar chart + PR badge. Each metric carries its own unit label, eliminating the "kg" ambiguity.
- **Tag**: v0.9.15
- **Lesson**:
  - Units are UX, not just labels — "432 kg" and "432 kg·r" are different stories the chart tells
  - When a metric is compound (weight × reps), display it with a compound unit ("kg·r") so users don't conflate it with simple weight
  - A professional redesign is sometimes the right answer instead of a copy patch — Pattern 14 (KPI Cards with Explicit Units) documented
  - Cards give each metric breathing room; line charts force all metrics into one shared Y axis

### BUG K - Time filter "1A" doesn't span full year (RESOLVED v0.9.14, false positive)
- **Discovered**: 2026-06-07 (during E2E test with 16-week data)
- **Severity**: 🟡 Low
- **Reported symptom**: "1A" filter (1 year) doesn't include the full year range when user has data spanning >12 months
- **Investigation**: Code review confirmed the filter logic is CORRECT. TIME_FILTERS["1A"].months = 12, subMonths(today, 12) gives a valid cutoff. The chart correctly shows logs from the last 365 days — but if user only has 3-4 months of data, the chart looks the same as "3M".
- **Root cause**: User expectation mismatch (false positive, similar to BUG C v0.9.7). The chart only shows weeks that have data; if there's no data 6+ months back, those gaps are absent rather than empty.
- **Fix**: 462ed58 — Add "Mostrando X semana(s) con datos" indicator below subtitle when filterMonths > 0. Educates user about the actual range covered without changing filter behavior.
- **Tag**: v0.9.14
- **Lesson**:
  - Same false-positive class as BUG C — code is correct, UX expectation broken
  - Solution can be communication (indicator) rather than code change
  - "False positive" pattern surfaces during user testing in real environments — log them, don't dismiss them

### BUG J - Metric inconsistency between tabs (RESOLVED v0.9.14)
- **Discovered**: 2026-06-07 (during E2E test)
- **Severity**: 🟡 Medium (semantic confusion)
- **Symptom**: Two semantically different metrics under same UI parent — "Grupos musculares" tab showed weekly tonnage (Σ weight × reps), "Por subgrupo" tab showed max weight per week. Both labeled with the same ambiguous "(kg)" suffix.
- **Root cause**: Subgroup tab subtitle was "Carga por músculo específico (kg)" which didn't specify which metric.
- **Fix**: 462ed58 — Change subgroup subtitle to "Peso máximo por semana, por músculo (kg)". Both tabs now have explicit metric labels.
- **Tag**: v0.9.14
- **Lesson**:
  - Two tabs with different metrics CAN coexist if labeled correctly (volume vs. max). Forcing unification would lose information (PR-style data).
  - UX clarity > UX uniformity — explicit labels resolve confusion without architectural changes
  - Each metric has its purpose; the bug is labelling, not concept

### BUG I - SUBGROUP_COLORS palette collisions (RESOLVED v0.9.14)
- **Discovered**: 2026-06-07 (during E2E test with 16-week demo data)
- **Severity**: 🟡 Low (UX clarity)
- **Symptom**: Each subgroup chart used 3-4 tones of the same color (e.g., legs: 4 azules, arms: 3 naranjas). Lines indistinguishable when overlapping or crossing.
- **Root cause**: Monochromatic palette design. Variants of the same hue look similar especially in dim chart settings and with anti-aliased thin lines.
- **Fix**: 462ed58 — Polychrome palette per group. First color preserves canonical group identity (cross-feature with Feature F2 in /workouts), rest are maximally distinguishable hues.
- **Tag**: v0.9.14
- **Lesson**:
  - "More shades" ≠ "more distinguishable" — humans see hue better than lightness for categorical data
  - First-position color anchoring preserves group identity across the app even when the rest of the palette diverges
  - Pattern 13 (Polychrome Categorical Palette) documented

### BUG H - AI-invented muscle strings drift (RESOLVED v0.9.12)
- **Discovered**: 2026-06-08 during v0.9.11 enrichment audit
- **Severity**: 🟡 Medium (data quality, classification drift)
- **Symptom**: AI generated muscle strings that didn't match the catalog ("Espalda Superior", "Flexores de Cadera", "Pectoral medio + Tríceps", etc.), causing classification orphans in /progress when those strings weren't in MUSCLE_GROUPS.
- **Root cause**: The AI prompt gave an example format ("e.g., Chest, Triceps") but did NOT enforce the source. AI was free to invent or localize, leading to integration drift between AI output, frontend translation, and backend mapping.
- **Fix**: e13497e — Backend authoritative pattern (Pattern 11). PHASE 3 of post-AI pipeline overwrites the `muscles` field with `cached.target + cached.secondaryMuscles` from the catalog. AI's `muscles` field is now ignored when the `exercise_id` resolves (which it always does after `reconcileExerciseIds`). Also extended MUSCLE_GROUPS coverage to 97.8% (18/19 catalog targets) as defense-in-depth for edge cases where catalog data sneaks through to subgroup labels.
- **Tag**: v0.9.12
- **Lesson**:
  - Don't trust AI for canonical metadata — use it for content (notes, reps), not for refs (muscle names, IDs)
  - Backend-authoritative pattern: AI proposes, backend canonicalizes
  - When you have an enriched source-of-truth (v0.9.11 catalog), use it everywhere downstream
  - Audit catalog target coverage BEFORE deploying canonical injection — otherwise you swap one drift for another

### BUG E - 'general' muscle_group fallback (RESOLVED v0.9.12)
- **Discovered**: 2026-06-07 during BUG D audit
- **Severity**: 🟡 Medium (data quality, non-blocking)
- **Symptom**: 4 strength_logs records had muscle_group='general' — orphan logs that never appeared in /progress because no canonical group includes "general".
- **Root cause**: AI sometimes omitted the `muscles` field in generated plans. Frontend `Workouts.tsx:624` had `?? "general"` fallback when `exercise.muscles` was null/undefined. The "general" string was never added to MUSCLE_GROUPS (rightly so — it's a fallback, not a real group), so logs ended up unmapped.
- **Fix**: e13497e — Same backend-authoritative pattern as BUG H. PHASE 3 of post-AI pipeline always injects `muscles` from catalog. Result: `exercise.muscles` is never null when `exercise_id` resolves. The `?? "general"` fallback in `Workouts.tsx:624` still exists as defense-in-depth, but should never fire for new plans.
- **Tag**: v0.9.12
- **Lesson**:
  - "Fallback to a string the system doesn't understand" is anti-defensive — better to either skip the entry or surface an error
  - Two-bug bundle (E+H): same root cause family (AI free-form drift), same fix (backend authoritative). Cheaper to fix together than separately
  - Old orphan logs remain in DB until manually fixed or re-keyed; only NEW plans get the canonical pipeline

### BUG G - arms group label was "Trapecio" (RESOLVED v0.9.9)
- **Discovered**: 2026-06-07 (during pre-test audit for catalog classification)
- **Severity**: 🟡 Low (UX, label only)
- **Symptom**: The `arms` canonical group in GROUP_META was labeled "Trapecio" (anatomically a back muscle = trapezius). Users logging bicep curls saw their data under a tab labeled "Trapecio".
- **Root cause**: Label-data semantic drift in canonical mapping config. The `key` of the group was correct (`arms`), but the display `label` ("Trapecio") was semantically incoherent with the key.
- **Fix**: eab1026 - One-line change: arms.label "Trapecio" → "Brazos"
- **Tag**: v0.9.9
- **Lesson**:
  - TypeScript doesn't catch semantic mismatches (any string is valid for label field)
  - Config tables with key→label mappings need semantic review during creation
  - Audit other canonical mappings for similar drift (Pattern 9)

### BUG F - /progress strength UX confusing labels (RESOLVED partial v0.9.9)
- **Discovered**: 2026-06-07 (after BUG D fix validation)
- **Severity**: 🟡 Low (UX polish)
- **Symptoms** (pre-existing, exposed once data displayed):
  - Label "Carga total por sesión" was ambiguous (it's actually weekly tonnage)
  - "Registra más sesiones" message didn't explain WHY (threshold is 2+ distinct weeks)
- **Fix**: eab1026 - Label + threshold message updated for clarity:
  - "Carga total levantada por sesión (kg)" → "Volumen total por semana (peso × reps · kg)"
  - "Registra más sesiones para ver la gráfica" → "Registra logs en al menos 2 semanas diferentes para ver tu progresión"
  - Added px-4 + text-center for wrap on narrow viewports
- **Tag**: v0.9.9
- **Note**: Partial resolution. Optional tooltip showing individual logged_at dates per data point remains active (see BUG F.tooltip).
- **Lesson**:
  - UX labels need to match the actual semantics of the data shown
  - "Por sesión" vs "por semana" matters when the calculation is aggregating
  - Threshold messages should explain the requirement, not just say "más"

### BUG D - /progress missing strength logs (RESOLVED v0.9.8)
- **Discovered**: 2026-06-07 (E2E test by user)
- **Severity**: 🔴 Critical
- **Symptom**: /progress shows "Aún no tienes sesiones registradas" even with strength_logs records in DB
- **Root cause**: MUSCLE_GROUPS in routes/strength.ts:48-69 missing Spanish plural forms. AI-generated plans produce values like 'Pectorales' that weren't in any group's muscle list.
- **Fix**: 4ccfca5 - Add 'Pectorales', 'Espalda', 'Piernas', 'Brazos' to corresponding groups (4 lines)
- **Tag**: v0.9.8
- **Audit findings**: 8 distinct muscle_group values in DB; 7 mapped correctly after fix, 1 ('general') orphan → tracked as BUG E
- **Lesson**:
  - Integration drift between AI output, frontend translation, and backend mapping is common
  - Audit production data BEFORE assuming fix is complete
  - Run SELECT DISTINCT muscle_group queries to discover actual values vs expected
  - One bug fix can reveal multiple variations of the same pattern
  - The 4 plural forms (Pectorales, Espalda, Piernas, Brazos) were a preventive layer, not just a single-bug fix

### BUG C - Strength save investigated (FALSE POSITIVE v0.9.7)
- **Discovered**: 2026-06-07 (E2E test)
- **Severity**: 🟢 Investigated (no fix needed)
- **Reported symptom**: Click "Guardar" doesn't fire POST /api/strength
- **Reported observation**: Only GET /api/strength?muscle=X visible in Network
- **Investigation**: Added verbose [DEBUG BUG C] logs in commit 53648c9
- **Console output revealed full success flow**:
  - handleSave → executes
  - Validation → passes (kg=25, reps=8)
  - mutationFn → entry
  - Token → obtained (length: 986)
  - POST /api/strength → 200
  - PR detected (isNewPR: true, prDelta: 5)
  - UI → '🏆 ¡Récord personal!'
- **Root cause**: FALSE POSITIVE. Initial report likely due to:
  - Network filter misconfiguration
  - Accidental refresh between attempts
  - Temporary session/token state
- **Tag**: v0.9.7
- **Defensive improvements retained**:
  - try/catch around getAccessToken
  - onError callback at hook level (with toast.error UX feedback)
  - Clear error prefixes [strength]
- **Lesson**:
  - Verbose logs work BOTH for confirming bugs AND proving they don't exist
  - Network filter UX in browser devtools can mislead
  - Same enfoque cerró BUG A definitively in 1 iteration
  - Always validate before assuming a bug is real

### BUG B - Exercise GIFs not loading in /workouts (RESOLVED v0.9.6)
- **Discovered**: 2026-06-07 (UI test)
- **Severity**: 🔴 Critical
- **Symptom**: /api/workoutx/gif/[ID] all returned 404
- **Root cause**: workoutx.ts declared 7 routes with /api/ prefix duplicated. app.ts:106 mounts router with /api already → endpoints served at /api/api/workoutx/* (doubled prefix)
- **Fix**: a0a8b18 - Remove /api/ from 7 route declarations
- **Tag**: v0.9.6
- **Lesson**:
  - Single anomalous file in a codebase with consistent convention is a red flag
  - Frontend correctness ≠ backend correctness
  - 17 other routers used pattern X; only this one used X+1
  - Network log evidence (404s) pointed directly to backend
- **Historical**: Bug likely present since 8c58b15 (initial WorkoutX integration). UI fallback to SVG component masked the issue

## Recurring patterns
- **Race conditions**: Multiple instances of fetching data before auth is ready
- **Schema drift**: Frontend assumes old schema, breaks after backend migration
- **Multiple sources of truth**: Two endpoints/tables for "same" concept diverge
- **Silent failures**: Errors swallowed in .then() without logging
