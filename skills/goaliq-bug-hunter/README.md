# How to use the GoalIQ Bug Hunter Skill

## Quick start
Just ask Claude Code:
- "ejecuta bug hunt completo"
- "valida que no haya regresiones"
- "audita el sistema de strength tracking"

## Available checks

### 1. Schema Health Check (`checks/schema-health.sql`)
Validates:
- FK CASCADE rules consistent
- RLS policies present
- No orphaned data
- Audit tables intact
- Indexes on critical columns

Run via Supabase SQL Editor or psql.

### 2. API Smoke Tests (`checks/endpoints.md`)
Validates critical endpoints:
- POST /api/strength
- GET /api/strength/group
- POST /api/meals
- GET /api/meals
- POST /api/workouts
- GET /api/workouts
- DELETE /api/account
- GET /api/export-data

### 3. UI Flow Validations (`checks/ui-flows.md`)
Critical flows that must always work:
- Signup → Onboarding → Plan generation
- Login → Dashboard
- Refresh on any page → STAY ON SAME PAGE (BUG history)
- Workout completion → strength_logs INSERT
- Beta code release on delete

## Historical context
See known-bugs.md for bugs #1-#9 and lessons learned.
