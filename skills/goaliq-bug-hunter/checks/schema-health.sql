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

[Más checks aquí]
