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

## Pattern 11: Backend Authoritative on AI-Generated Metadata
**Symptom**: An AI generates a structured payload where some fields are free-form text (e.g., muscle names, category labels, classification tags). The AI drifts: localizes inconsistently, invents new variants, omits the field. Downstream systems that depend on canonical values break.
**How to detect**:
- AI response includes a field that's "supposed to" match a canonical taxonomy but is just a string
- Production data audit reveals high-cardinality, low-coherence values in that field (variant spellings, mixed languages, fictional terms)
- Classification logic downstream uses the AI string directly and has frequent orphan/fallback cases
**Approach (battle-tested in v0.9.12)**:
1. **Identify the authoritative source**: usually an enriched local catalog (Pattern 10) or a deterministic mapping the AI used as input (e.g., a pool of allowed values).
2. **Reorganize the post-AI pipeline in explicit phases**:
   - PHASE 1: defaults + cleanup on AI fields the AI is allowed to own
   - PHASE 2: reconcile references (IDs, names) the AI may have mis-copied
   - PHASE 3 NEW: overwrite the drift-prone field with the canonical value from the authoritative source
3. **Keep a defensive fallback** to the AI's original value for edge cases where the canonical lookup fails (cache empty, ID not resolved, etc.). Better to keep what the AI said than to crash.
4. **Audit downstream classification BEFORE deploying** — if the canonical source has values your downstream mapping doesn't recognize, you swap one drift for another.
**Lesson learned (from v0.9.12 — BUG E + BUG H closed together)**:
- AI is good for content (notes, prose, creative reps strings), not for refs (canonical IDs, taxonomy values)
- Prompt engineering to "constrain" the AI is encouragement, not enforcement. If correctness matters, override programmatically.
- One pattern (backend authoritative) can close multiple bugs with the same root cause family (free-form AI drift). Identify the family, not just each instance.
- Order matters: PHASE 3 must run AFTER reconciliation (PHASE 2), so the lookup has a valid exercise_id/key to query the catalog with
- Coverage check: BEFORE deploying canonical injection, audit which canonical values exist in production data — extend MUSCLE_GROUPS-style mappings to cover gaps (Pattern 8)

## Pattern 10: Additive Enrichment Migration + ON CONFLICT DO UPDATE
**Symptom**: An existing table with production data needs new columns to enable future features, without losing or churning legacy data.
**How to detect**:
- Schema needs new fields but existing rows must survive intact
- Re-sync from authoritative source will UPDATE existing rows, not just INSERT new ones
- Risk: re-sync overwrites manually-fixed legacy fields
**Approach (battle-tested in v0.9.11)**:
1. **ALTER TABLE additive + idempotent**: `ADD COLUMN IF NOT EXISTS` with safe defaults (`DEFAULT '[]'::jsonb` for JSONB arrays, NULL for nullable scalars). Existing rows get the defaults automatically.
2. **Backup pre-sync**: `CREATE TABLE foo_backup_pre_X AS SELECT * FROM foo;` as safety net.
3. **INSERT ... ON CONFLICT (pk) DO UPDATE SET only_new_fields = EXCLUDED.only_new_fields**: legacy fields are NOT overwritten on conflict — preserves any manual fixes or upstream corrections.
4. **Schema migration runs BEFORE cache load at boot**: ensures SELECT with new columns doesn't crash on first start.
**Lesson learned (from v0.9.11 WorkoutX enrichment)**:
- Sequence at boot matters: `ensureSupabaseTablesReady()` MUST run before `loadWorkoutXCache()` so the SELECT finds new columns
- `ON CONFLICT DO NOTHING` is wrong for enrichment — it skips existing rows entirely, leaving new columns NULL forever
- `ON CONFLICT DO UPDATE` for ALL fields is too aggressive — risks overwriting manual fixes upstream
- The hybrid (UPDATE only new fields) is the right balance: enrichment without churn
- Cost analysis matters: 1324 exercises / 10 per page = 133 API calls. Always verify external API quota before re-sync
- 100% enrichment validation post-sync: `COUNT(*) FILTER (WHERE new_field IS NOT NULL)` per new field

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
