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
