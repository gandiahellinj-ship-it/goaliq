# Known Bugs - Historical Reference

## Active Bugs

### BUG E - 'general' muscle_group fallback (ACTIVE, non-blocking)
- **Discovered**: 2026-06-07 during BUG D audit
- **Severity**: 🟡 Medium (data quality, non-blocking)
- **Symptom**: 4 strength_logs records have muscle_group='general'
- **Source**: Workouts.tsx:623 fallback when exercise.muscles is null/undefined
- **Impact**: These logs will never appear in /progress (no group includes 'general')
- **Possible root causes**:
  - AI generates exercise with empty muscles field
  - Plan data corruption during generation
  - Edge case in muscle extraction
- **Status**: Pending investigation
- **Action**: Investigate after MEJORA 11 visual / when relevant

### BUG F.tooltip - /progress subgroup chart tooltip (ACTIVE, partial of BUG F)
- **Discovered**: 2026-06-07 (after BUG D fix validation), partially fixed in v0.9.9
- **Severity**: 🟡 Low (UX nice-to-have)
- **Symptom**: Subgroup line chart shows `week_start` (ISO Monday) on X-axis with no way to see the actual `logged_at` dates of the individual data points
- **Status**: BUG F resolved partial in v0.9.9 (label + threshold copy). Tooltip remains active.
- **Suggested fix**: Custom Recharts tooltip component that fetches the individual logs and displays them on hover
- **Files involved**: artifacts/nutricoach/src/pages/Progress.tsx (line ~612 Tooltip element)
- **Effort**: ~30-45 min (custom tooltip + per-log fetch)
- **Priority**: Low - not blocking; revisit during /progress polishing pass

### BUG I - SUBGROUP_COLORS palette collisions (ACTIVE)
- **Discovered**: 2026-06-07 (during E2E test with 16-week demo data)
- **Severity**: 🟡 Low (UX clarity)
- **Symptom**: Color palette for subgroup chart has internal collisions
  - `legs` group: Cuádriceps/Glúteos both shades of blue, hard to distinguish lines
  - `arms` group: Bíceps/Tríceps both shades of orange, hard to distinguish lines
- **Files involved**: artifacts/nutricoach/src/pages/Progress.tsx:46-53 (SUBGROUP_COLORS)
- **Suggested fix**: Pick higher-contrast color combinations per group (avoid same-hue collisions inside one group)
- **Priority**: Low

### BUG J - Metric inconsistency between tabs (ACTIVE)
- **Discovered**: 2026-06-07 (during E2E test)
- **Severity**: 🟡 Medium (semantic confusion)
- **Symptom**: Two semantically different metrics under same UI parent
  - "Grupos musculares" tab: weekly tonnage (sum of weight × reps)
  - "Por subgrupo" tab: max weight per week (Math.max of weight_kg)
- **Files involved**: Progress.tsx (aggregateGroupLoad line 68, subgroup chart line 502-525)
- **Suggested fix**: Either unify the metric (both tonnage or both max), OR add explicit subtitle to "Por subgrupo" tab clarifying "Peso máximo por semana"
- **Priority**: Medium - causes user confusion when comparing tabs

### BUG K - Time filter "1A" doesn't span full year (ACTIVE)
- **Discovered**: 2026-06-07 (during E2E test with 16-week data)
- **Severity**: 🟡 Low
- **Symptom**: Time filter pill "1A" (1 año / 1 year) doesn't include the full year range when user has data spanning >12 months
- **Files involved**: Progress.tsx TIME_FILTERS definition
- **Suggested fix**: Verify TIME_FILTERS[..."1A"].months === 12; or change to "Todo" / "All time" pill
- **Priority**: Low

### BUG L - Weight log notes invisible (ACTIVE)
- **Discovered**: 2026-06-07 (during E2E test)
- **Severity**: 🟡 Low (data not lost, but not displayed)
- **Symptom**: Notes field saved with weight logs is not rendered/visible in "Peso Corporal" tab
- **Files involved**: Progress.tsx WeightTab + LogWeightSheet (line ~124-155, log display section)
- **Suggested fix**: Render the note field next to/below each weight entry in the timeline
- **Priority**: Low

## Resolved Bugs (#1-#9, A, B, C, D, F partial, G)

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
