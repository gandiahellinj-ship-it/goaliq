# Recurring Bug Patterns in GoalIQ

## Pattern 1: Race Condition on Auth Hydration
**Symptom**: Query runs before JWT is in client
**How to detect**:
- Query to RLS-protected table returns null on first load
- Works after a few seconds
- Disappears with fresh login

## Pattern 2: Schema Drift
**Symptom**: 400/404 errors after migration
**How to detect**:
- grep for old column names after schema changes
- Check that frontend types match BBDD types

## Pattern 3: Multiple Sources of Truth
**Symptom**: Two screens show conflicting data
**How to detect**:
- Find endpoints/tables with similar names
- Check if both are used for same concept

## Pattern 4: Silent Failures
**Symptom**: Bug not visible until production
**How to detect**:
- grep for `.then(({ data })` without `error` handling
- Find `try/catch` blocks that swallow errors

## Pattern 5: Service Worker Cache Staleness
**Symptom**: Old code/assets after deploy
**How to detect**:
- DevTools Application → Service Workers
- Check registered SW version vs current commit

## Pattern 6: Route Prefix Duplication
**Symptom**: API endpoints return 404 despite frontend requesting correct URL
**How to detect**:
- Network log shows 404 with frontend-requested URL
- Backend logs show no matching route handler invoked
- Inconsistent prefix declaration vs mount point
**How to fix**:
- Audit all router declarations against mount point in app.ts
- Look for outliers in route prefix convention
- Compare router.get/post/put paths across all routers
**Lesson learned (from BUG B)**:
- workoutx.ts was THE ONLY router declaring with /api/ prefix
- The 17 other routers used relative paths
- When you see ONE file doing something different, investigate immediately
