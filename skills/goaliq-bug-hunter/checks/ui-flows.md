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

[More flows]
