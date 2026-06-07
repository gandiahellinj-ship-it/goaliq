-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GoalIQ Schema Health Check
-- Run via Supabase SQL Editor
-- Expected execution: < 30 seconds
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- CHECK 1: Critical tables exist
SELECT
  schemaname,
  tablename,
  CASE
    WHEN tablename IN (
      'profiles', 'meal_plans', 'workout_plans',
      'progress_logs', 'strength_logs', 'workout_history',
      'beta_invite_codes', 'deletion_logs', 'consent_log',
      'health_screenings', 'meal_plan_versions'
    ) THEN '✅ Required table present'
    ELSE 'ℹ️ Auxiliary table'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- CHECK 2: FK CASCADE rules
[más checks - placeholder]

-- CHECK 3: RLS enabled on critical tables
[más checks - placeholder]

-- CHECK 4: No orphaned data (users deleted but data remains)
[más checks - placeholder]

-- CHECK 5: Audit tables intact (pre-M8)
SELECT tablename,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = pg_tables.tablename) AS col_count
FROM pg_tables
WHERE tablename LIKE 'audit_pre_m8_%';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CHECK 6: workoutx_exercises catalog enrichment health (added v0.9.11)
-- Verifies all 8 enrichment fields are populated post-sync
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 6a. Field-by-field NOT NULL coverage
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE jsonb_array_length(secondary_muscles) > 0) AS with_secondary,
  COUNT(*) FILTER (WHERE jsonb_array_length(instructions) > 0) AS with_instructions,
  COUNT(*) FILTER (WHERE gif_url IS NOT NULL) AS with_gif_url,
  COUNT(*) FILTER (WHERE mechanic IS NOT NULL) AS with_mechanic,
  COUNT(*) FILTER (WHERE force IS NOT NULL) AS with_force,
  COUNT(*) FILTER (WHERE description IS NOT NULL) AS with_description,
  COUNT(*) FILTER (WHERE met IS NOT NULL) AS with_met,
  COUNT(*) FILTER (WHERE calories_per_minute IS NOT NULL) AS with_calories
FROM public.workoutx_exercises;
-- Expected post-v0.9.11 sync: total=1324, all 8 fields ≈ 1324 (≥99%)

-- 6b. Spot-check exercise 0001 (3/4 Sit-up) — known reference values
SELECT
  id, name, body_part, target,
  secondary_muscles,
  jsonb_array_length(instructions) AS num_instructions,
  mechanic, force, met, calories_per_minute,
  LEFT(description, 80) AS description_preview
FROM public.workoutx_exercises
WHERE id = '0001';
-- Expected: secondary_muscles=["Hip Flexors","Lower Back"],
-- mechanic=isolation, force=push, met=3.5, calories_per_minute=4.3

-- 6c. Distribution of mechanic and force values (sanity check)
SELECT mechanic, COUNT(*) FROM public.workoutx_exercises GROUP BY mechanic ORDER BY 2 DESC;
SELECT force, COUNT(*) FROM public.workoutx_exercises GROUP BY force ORDER BY 2 DESC;
-- Expected: mechanic ∈ {compound, isolation},
-- force ∈ {push, pull, static, carry} per v0.9.11 audit

-- 6d. Cache vs DB consistency
-- (run alongside GET /api/workoutx/sync-status; both numbers should match)
SELECT COUNT(*) FROM public.workoutx_exercises;
-- Expected: matches "cached" and "db" counts from /api/workoutx/sync-status

-- 6e. Backup safety net still present
SELECT COUNT(*) AS backup_rows
FROM public.workoutx_exercises_backup_pre_enrichment;
-- Expected: 1094 (pre-enrichment snapshot, preserved for rollback)

[Más checks aquí]
