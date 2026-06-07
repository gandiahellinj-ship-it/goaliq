# Critical UI Flows

## Flow 1: Refresh anywhere → stay on same page
**Test**:
1. Login + complete onboarding
2. Navigate to /dashboard
3. F5 / refresh
**Expected**: Stay on /dashboard
**Current state**: ✅ PASSING (v0.9.5 fix)

## Flow 2: Workout exercise log → graphic visualization
**Test**:
1. Open Workouts
2. Expand exercise log
3. Enter weight + reps
4. Save
5. Navigate to /progress
**Expected**: Graph shows the recorded entry

## Flow 3: Beta code release on delete
**Test**:
1. Signup with beta code
2. Delete account from Settings
**Expected**:
- Beta code: used_by_user_id=NULL AND used_at=NULL

## Flow 4: Exercise GIFs load in /workouts
**Test**:
1. Login + navigate to /workouts
2. Inspect Network tab
3. Verify GET /api/workoutx/gif/[ID] requests
**Expected**:
- All requests return 200
- Content-Type: image/gif
- GIFs visible in exercise cards
- Modal "Ver ejemplo →" shows animated preview
**Current state**: ✅ PASSING (v0.9.6 fix)

## Flow 5: Strength tracking save flow
**Test**:
1. Login + /workouts
2. Expand strength exercise (e.g., Bench Press)
3. Enter weight + reps
4. Click "Guardar"
**Expected**:
- Console: [DEBUG BUG C] logs trace through full flow (if logs active)
- Network: POST /api/strength returns 200
- Response: { log, isNewPR, prDelta, prevMax }
- UI: "Anterior: Xkg" updates, "🏆 ¡Récord personal!" if new PR
**Current state**: ✅ PASSING (v0.9.7 investigation)

## Flow 11: Subgroup cards + anatomical sub-muscles validation (v0.9.16)
**Test**:
1. Login + navigate to /progress → tab "Por subgrupo"
2. Cycle through groups via the selector
3. For each, inspect the cards rendered
**Expected**:
- Subtitle says "Estadísticas semanales por músculo" (NOT "Peso máximo por semana, por músculo (kg)")
- Cards stacked (NOT a line chart)
- Each card structure mirrors Groups tab (v0.9.15): colored dot + muscle name + optional PR badge + 4 KPIs grid + mini bar chart
- Empty state cards for muscles without logs in the filter window
- Indicator "Mostrando X semanas con datos" appears when filter active

**Anatomical sub-muscles (backward compat)**:
- Pectoral with only flat Bench Press logs → 1 card "Pectoral medio" in canonical green
- Pectoral with Incline Dumbbell Press logs → additional card "Pectoral superior" in coral (SUBGROUP_COLORS[1])
- Pectoral with Decline logs → additional card "Pectoral inferior" in yellow (SUBGROUP_COLORS[2])
- Shoulders with Lateral Raise → "Deltoides lateral" card
- Shoulders with Front Raise / Shoulder Press → "Deltoides anterior" card
- Shoulders with Rear Delt Fly / Bent-over Lateral → "Deltoides posterior" card

**Forward compat (post-v0.9.16 plans)**:
- Backend pipeline (aiGenerators.ts PHASE 3.5) writes `muscles: "Pectoral superior, Triceps, ..."` for Incline exercises
- Logs created from those plans have `strength_logs.muscle_group = "Pectoral superior"` directly
- Frontend helper is idempotent: re-classifying already-specific values returns them unchanged

**Cross-feature consistency**:
- First card per group has the canonical group color (matches Workouts.tsx F2 pill + Progress.tsx GroupsCardsView dot)
- chest verde #1D9E75, legs azul #378ADD, arms naranja #BA7517, etc.

**Regression check**:
- Tab "Grupos musculares" (v0.9.15) still works
- Tab "Peso corporal" unchanged

**Current state**: ✅ PASSING (v0.9.16 fix)
**Validated**: E2E with test2goaliq real data — Pectoral 1 card backward compat, Piernas 2 cards, Brazos 2 cards, PRs detected across groups

## Flow 10: Professional Groups cards visual validation (v0.9.15)
**Test**:
1. Login + navigate to /progress → tab "Grupos musculares"
2. Inspect the 6 group cards (or empty states)
**Expected**:
- 6 cards rendered vertically (one per canonical group: Hombros, Piernas, Espalda, Pectoral, Abdomen, Brazos)
- Each card with data shows:
  - Header: colored dot (canonical group color) + group label
  - Optional PR badge: "🏆 PR! +X kg" in gold/#FFD700 (only if latest week max > previous week)
  - KPI grid: Peso máx (kg), Volumen sem. (kg·r), Sets, Reps
  - Mini bar chart: last 6 weeks of volume, color = canonical group
- Cards without data show empty state:
  - Opacity-60
  - Dot with reduced opacity
  - Text "Sin sesiones registradas en este grupo"
- Indicator "Mostrando X semanas con datos" still appears when filter active
- Subtitle "Estadísticas semanales por grupo" replaces old "Volumen total por semana (peso × reps · kg)"
**Filter behavior**:
- Changing filter (1M, 3M, 1A, Todo) updates KPI values
- Mini bar charts DO NOT change (trend always last 6 weeks)
- "Mostrando X semanas" indicator updates with filter
**Mobile (375px)**:
- KPIs render in 2 columns (grid-cols-2)
- Desktop (≥768px) renders 4 columns (md:grid-cols-4)
- PR badge floats right in header without overflow
**Cross-feature**:
- Card dot color matches the primary muscle pill color in /workouts for the same group
- Mini-chart bars use same color
**Current state**: ✅ PASSING (v0.9.15 fix)
**Validated**: E2E with test2goaliq real data — 3 cards with PRs (Piernas, Pectoral, Brazos), 3 empty states (Hombros, Espalda, Abdomen)

## Flow 9: Cross-feature color consistency (v0.9.14)
**Test**:
1. Open /workouts with an AI-generated plan
2. Locate a Bench Press card → note the primary muscle pill color (should be green #1D9E75)
3. Navigate to /progress → "Por subgrupo" tab → select "Pectoral"
4. Inspect the first line in the chart legend
5. Repeat for legs (blue #378ADD), arms (orange #BA7517), back (purple #7F77DD), shoulders (pink #D4537E), core (olive #639922)
**Expected**:
- The primary muscle badge color in /workouts MATCHES the first line color in /progress for the same group
- This anchors the visual language established in Feature F2 (v0.9.13)
- The rest of the palette in /progress (positions 1+) can diverge — that's expected polychrome (Pattern 13)
**Why this matters**:
- Cross-feature consistency means a color "carries meaning" throughout the app (chest = green, legs = blue, etc.)
- Pattern 12 (Design System Color Reuse) + Pattern 13 (Polychrome) must agree on position 0
- If they diverge, users get confused: "Why is chest green here but red there?"
**Current state**: ✅ PASSING (v0.9.14 fix)
**Validated**: E2E for the 6 groups with test2goaliq plan

## Flow 8: Muscle hierarchy badges visual validation (v0.9.13)
**Test**:
1. Login + navigate to /workouts with an AI-generated plan (v0.9.12 or later)
2. Inspect each exercise card's header row
**Expected**:
- Primary muscle (first) renders as a badge in the canonical group color:
  - chest → green (#1D9E75)
  - back → purple (#7F77DD)
  - legs → blue (#378ADD)
  - shoulders → pink (#D4537E)
  - arms → orange (#BA7517)
  - core → olive (#639922)
- Secondary muscles render as muted gray badges (smaller, less emphasis)
- Equipment pill renders unchanged (separate from muscles, gray legacy style)
- On mobile (375px wide), badges wrap naturally to a second line — no horizontal scroll
- Color matches /progress charts for the same group (visual consistency)
**Edge cases**:
- Exercise with no muscles: no muscle badges render (same as before v0.9.13)
- AI-invented muscle string (legacy plan): regex catches most via group name, fallback to accent color
**Current state**: ✅ PASSING (v0.9.13 fix)
**Validated**: User-confirmed visual E2E for test2goaliq plan post-Replit sync

## Flow 7: Plan AI muscles canonical validation (v0.9.12)
**Test**:
1. DELETE the user's current workout_plans row in BBDD
2. Trigger plan regeneration (UI: Settings → onboarding edit → save)
3. Query the new plan's exercise muscles:
   ```sql
   SELECT
     (jsonb_path_query(plan, '$.days[*].workout.exercises[*]') ->> 'name') AS name,
     (jsonb_path_query(plan, '$.days[*].workout.exercises[*]') ->> 'exercise_id') AS id,
     (jsonb_path_query(plan, '$.days[*].workout.exercises[*]') ->> 'muscles') AS muscles
   FROM workout_plans
   WHERE user_id = '<uuid>'
   ORDER BY updated_at DESC;
   ```
4. Verify each `muscles` value
**Expected**:
- All `muscles` strings are canonical English from catalog
- Format: `"Target, Secondary1, Secondary2"` (comma-separated)
- No "general", no Spanish drift ("Espalda Superior", "Flexores de Cadera")
- 100% match with `getExerciseById(exercise_id).target + .secondaryMuscles`
- First muscle (split by `,`) maps cleanly to a canonical group via MUSCLE_GROUPS
**Current state**: ✅ PASSING (v0.9.12 fix)
**Validated**: E2E with regenerated plan for test2goaliq, 18 exercises across 5 days, 15 distinct muscle names all canonical

## Flow 6: Strength logs visible in /progress
**Test**:
1. Login + log strength data in /workouts (multiple sets of same exercise)
2. Navigate to /progress
3. Verify charts render with data
**Expected**:
- GET /api/strength/group?group=X returns 200
- byMuscle object contains user's logs keyed by muscle_group
- "Grupos musculares" tab: weekly tonnage point per week (sum of weight × reps)
- "Por subgrupo" tab: line chart per specific muscle (requires ≥2 distinct weeks)
- Subtitle reads "Volumen total por semana (peso × reps · kg)" — clear formula hint
- Threshold message reads "Registra logs en al menos 2 semanas diferentes para ver tu progresión"
- "arms" tab labeled "Brazos" (NOT "Trapecio")
- PR detection shows 🏆 on records
**Current state**: ✅ PASSING (v0.9.8 fix + v0.9.9 UX polish)
**Validated**: E2E with 16-week demo data, 5 exercises, deload weeks visible

[More flows]
