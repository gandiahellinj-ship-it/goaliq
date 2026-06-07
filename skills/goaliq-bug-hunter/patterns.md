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

## Pattern 7: False Positive Bug Reports
**Symptom**: User reports feature broken, but verbose logs show it works correctly
**How to detect**:
- Add verbose logs along the suspected flow
- Compare log output vs expected vs reported
- If logs show success but user reports failure: false positive
**How to verify**:
- Same enfoque as real bugs: logs first, conclusions after
- Don't dismiss user reports too quickly
- But also don't assume every report = real bug
**Lesson learned (from BUG C)**:
- Initial report seemed clear: "POST doesn't fire"
- Logs revealed: full successful flow
- Defensive improvements retained anyway (worth the time)
- Pattern: user testing also exposes observation errors, not just actual bugs

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

## Pattern 9: Label-Data Semantic Drift in Canonical Mappings
**Symptom**: A config table has key → label mapping where the label is semantically wrong for the key (e.g., `arms: { label: "Trapecio" }` — but trapezius is a back muscle, not arms)
**How to detect**:
- Audit `GROUP_META` / similar config objects with key→label pairs
- Check whether each label is semantically coherent with what its key represents
- Watch for surprising user feedback: "wait, why does X say Y?"
**How to fix**:
- Trivial: one-line label correction
- Cross-check other entries in the same config for similar drift
**Lesson learned (from BUG G)**:
- TypeScript doesn't catch semantic mismatches — any string satisfies `label: string`
- Config changes need a semantic review pass, not just type-check
- Defensive practice: when adding/renaming canonical keys, eyeball every label against its key
- Distinct from Pattern 8 (value mismatch): Pattern 8 is about runtime data drifting; Pattern 9 is about a static config being authored incorrectly

## Pattern 8: Value Mapping Drift (frontend/backend mismatch)
**Symptom**: Endpoint returns empty results despite valid data in DB
**How to detect**:
- Compare frontend query parameters with backend mapping
- Check if frontend sends canonical EN keys but DB has ES values
- Audit DISTINCT values in DB column vs expected mapping
**How to fix**:
- Add missing values to mapping table (additive, zero risk)
- Run audit queries: SELECT DISTINCT col, COUNT(*) FROM table
- Document all known variations
**Lesson learned (from BUG D)**:
- AI-generated values can drift from canonical forms
- Single audit query reveals more variations than expected
- Always verify mapping completeness with production data
- Prevention layer: constrain AI prompt to output canonical only
