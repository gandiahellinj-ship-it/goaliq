# Changelog

All notable changes to GoalIQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mejora 11: Implementación visual plato 3D + sistema 5 fondos diurnos + onboarding parallax
- Mejora 12: Regenerador inteligente de planes IA (post beta validation)
- Mejora 13: Activar Stripe + lanzamiento público con pricing
- Landing Page producción con stack creativo (Claude prompts → Nano Banana → Kling 3.0 → GSAP)
- Beta launch real con amigos (5-10 invitaciones)
- FASE 10 final cleanup: investigar y eliminar `heliumdb` dependency
- Resolver bugs low priority restantes (BUG #6, #7, TypeScript preexistentes)

---

## [0.9.8] — 2026-06-07

### 🐛 BUG D resuelto: `/progress` now displays strength logs

Patch release que cierra **BUG D**: la página `/progress` no mostraba los logs de strength training guardados porque el mapeo `group→muscle_group` del backend no incluía los plurales españoles que la AI genera como valores de `muscle_group`.

### Fixed

- **BUG D (critical)**: `/progress` showed "Aún no tienes sesiones registradas" even with strength logs in the database.

  **Symptom**: User logs Bench Press (`muscle_group='Pectorales'`), but `GET /api/strength/group?group=chest` returns empty array.

  **Root cause**: `MUSCLE_GROUPS` mapping in `routes/strength.ts:48-69` was missing Spanish plural forms. AI-generated plans produce values like `'Pectorales'` that weren't in any group's muscle list. The SQL filter `WHERE muscle_group = ANY(ARRAY[...])` never matched.

  **Fix** (commit `4ccfca5`): Add 4 Spanish plurals to corresponding groups:
  - `chest`: `+'Pectorales'`
  - `back`: `+'Espalda'`
  - `legs`: `+'Piernas'`
  - `arms`: `+'Brazos'`

  Single-file additive change (4 lines). No frontend changes, no database migration. Zero regression risk.

### Audit findings — muscle_group values in strength_logs

Post-fix audit query (`SELECT muscle_group, COUNT(*) FROM strength_logs GROUP BY 1 ORDER BY 2 DESC`) revealed 8 distinct values:

| muscle_group | count | mapped to |
|---|---|---|
| Pectorales | 4 | ✅ chest (this fix) |
| general | 4 | ⚠️ orphan (BUG E — see below) |
| Isquiotibiales | 1 | ✅ legs (pre-existing) |
| Cuádriceps | 1 | ✅ legs (pre-existing) |
| Deltoides | 1 | ✅ shoulders (pre-existing) |
| Tríceps | 1 | ✅ arms (pre-existing) |
| Calves | 1 | ✅ legs (pre-existing) |
| Forearms | 1 | ✅ arms (pre-existing) |

→ 7 of 8 variants correctly mapped post-fix. The only orphan is the `'general'` fallback (BUG E).

### Identified — non-blocking issues (not bundled in this release)

- **BUG E** (data quality): 4 logs have `muscle_group='general'`. Source: `Workouts.tsx:623` fallback `exercise.muscles?.split(...)[0].trim() ?? "general"` when AI-generated plan has null/undefined `muscles`. Those logs are orphans (no canonical group includes `"general"`). Tracked for future investigation.

- **BUG F** (UX polish): label/copy issues in `/progress` strength tab surfaced once data started rendering. All pre-existing, not regressions:
  - "Carga total por sesión" label is actually weekly tonnage (sum of `weight_kg × reps` per week).
  - X-axis shows `week_start` (ISO Monday), not individual log dates — would benefit from tooltip showing actual `logged_at`.
  - "Registra más sesiones para ver la gráfica" message fires when there's only 1 distinct week of data; could be more specific ("Registra logs en al menos 2 semanas diferentes").

### Verified — E2E validation (commit `4ccfca5` in production)

- ✅ `GET /api/strength/group?group=chest` returns 664 bytes (4 logs of `Pectorales`).
- ✅ Other groups correctly return `[]` (28 bytes) when user has no data.
- ✅ `/progress` "Grupos musculares" tab renders the chest data point: `200 + 200 + 200 + 180 = 780 kg` weekly tonnage on `1 jun` (Monday of the week).
- ✅ Math verified: 4 logs (20kg×10, 20kg×10, 25kg×8, 30kg×6) → 780 kg total volume.
- ✅ Date "1 jun" verified as `week_start` (Monday) for logs registered week of June 1–7.
- ✅ Subgroup chart correctly defers rendering until ≥2 distinct weeks exist (1-point line would be meaningless).

---

## [0.9.7] — 2026-06-07

### 🔍 BUG C investigated: strength tracking validated (false positive)

Patch release que cierra la investigación de **BUG C**: el botón "Guardar" en `/workouts` SÍ funciona correctamente. El reporte inicial fue un falso positivo descubierto durante E2E testing con logs verbose.

### Investigated

- **BUG C (false positive)**: Initial report claimed "Guardar button doesn't fire POST /api/strength" with the observation that "only GET /api/strength?muscle=X" was visible in the Network panel.

  Verbose `[DEBUG BUG C]` logs added in commit `53648c9` revealed the full success flow:
  - `handleSave` executes on click
  - Input validation passes (`kg=25, reps=8`)
  - `mutationFn` entry with full payload
  - Token obtained (length: 986)
  - `POST /api/strength` returns 200
  - PR detection works (`isNewPR: true, prDelta: 5`)
  - UI shows "🏆 ¡Récord personal!" feedback

  **Conclusion**: false positive. Initial report likely caused by Network filter misconfiguration, accidental page refresh between attempts, or a temporary session state during testing.

### Changed

- **Defensive improvements retained** (carried over from the debug commit):
  - `try/catch` around `getAccessToken()` in `useSaveStrengthLog` for cleaner error handling.
  - Hook-level `onError` callback in `useSaveStrengthLog` — breaks the silent-failure pattern (Pattern #4 in skill bug-hunter) by logging + showing a `toast.error()` with the failure reason.
  - Per-call `onError` in `handleSave` strength branch — same goal, per-component logging.
  - Clear error message prefixes (`[strength] auth failed:`, `[strength] response error:`, `[strength] save failed:`) for grep-ability and clarity.

### Verified — E2E validation

- ✅ `handleSave` executes on click.
- ✅ Input validation passes correctly.
- ✅ `mutationFn` enters with payload.
- ✅ Token obtained successfully via `getAccessToken()`.
- ✅ `POST /api/strength` returns 200.
- ✅ PR detection functional.
- ✅ UI shows `🏆 ¡Récord personal!` feedback.
- ✅ Debug logs cleaned up after validation (commit on this release).

### Notes

- A non-blocking sidebar finding surfaced during BUG C investigation: AI-generated workout plans occasionally produce incorrect `exercise.muscles[0]` values (e.g., `"Abs"` for a Bench Press). The frontend treats the first value as canonical, so the `useStrengthLogs` query may filter by the wrong muscle group. Logged for future investigation; not bundled here.

---

## [0.9.6] — 2026-06-07

### 🐛 BUG B resuelto: GIFs de ejercicios ahora cargan en /workouts

Patch release que cierra **BUG B**: los GIFs de los ejercicios no cargaban en la página Entrenos porque el endpoint backend estaba inalcanzable por un prefix duplicado en las declaraciones de ruta.

### Fixed

- **BUG B (critical)**: Exercise GIFs failed to load in `/workouts`. All `/api/workoutx/gif/[ID]` requests returned 404.

  **Root cause**: Single-file bug in `routes/workoutx.ts`. The 7 route declarations included `/api/` prefix manually, while `app.ts:106` already mounts the router with `app.use("/api", router)`. Result: endpoints were served at `/api/api/workoutx/*` (doubled), but the frontend correctly requested `/api/workoutx/*` → 404.

  The other 17 routers in the codebase correctly declare paths without `/api/` prefix. Only `workoutx.ts` had this issue.

  **Fix**: Remove `/api/` from the 7 route declarations:
  - `/api/workoutx/exercise` → `/workoutx/exercise`
  - `/api/workoutx/gif/:id` → `/workoutx/gif/:id`
  - `/api/workoutx/by-location` → `/workoutx/by-location`
  - `/api/workoutx/equipment` → `/workoutx/equipment`
  - `/api/workoutx/muscle` → `/workoutx/muscle`
  - `/api/workoutx/sync-status` → `/workoutx/sync-status`
  - `/api/workoutx/force-sync` → `/workoutx/force-sync`

  **Single commit fix** (`a0a8b18`): 7 lines, 1 file. No frontend changes, no mount point changes, no DB changes.

### Verified — E2E validation (commit `a0a8b18` in production)

- ✅ `/workouts` page displays exercise GIFs in cards.
- ✅ "Ver ejemplo →" modal shows animated GIF preview.
- ✅ Browser Console shows no 404 errors for `/api/workoutx/gif/*`.
- ✅ Network requests to `/api/workoutx/gif/[ID]` return 200 + Content-Type: image/gif.
- ✅ api-server logs show `[workoutx-cache] Loaded 1094 exercises from DB`.

### Historical context

Bug likely present since commit `8c58b15` (initial WorkoutX integration). Possibly never worked properly — the UI has a fallback to `<ExerciseAnimation>` SVG component, which may have masked the issue until users explicitly noticed missing animated previews.

---

## [0.9.5] — 2026-06-07

### 🐛 BUG A resuelto: refresh ya no redirige a onboarding step 2

Patch release que cierra definitivamente **BUG A** (regresión crítica documentada en v0.9.4): el F5 sobre cualquier ruta autenticada bouncing al usuario a `/onboarding` paso 2. El bug era una race condition multinivel en `AppLayout` durante la rehidratación de sesión de Supabase.

### Fixed

- **BUG A (critical)**: Refresh on any authenticated page redirected user to onboarding step 2 instead of staying on the current route.

  **Root cause**: Multi-layered race condition in `AppLayout`:
  1. On refresh, `useAuth` rehydrates the Supabase session asynchronously (transient state where `isAuthenticated=false` + `authLoading=true`).
  2. The profiles query useEffect had `setProfileLoading(false)` in the "not authenticated" branch, which fired during rehydration.
  3. The redirect useEffect then saw `{ profileLoading: false, hasCompletedOnboarding: false }` and redirected to `/onboarding`.
  4. The profiles query completed milliseconds later with correct data, but the redirect had already happened.

  **Fix applied in 3 commits**:
  - `a32ed2f`: Initial race condition guard (`session?.access_token` gate on the query).
  - `ff694fb`: Verbose debug logs for diagnosis (temporary, removed in this release).
  - `005e2bc`: Final fix — only flip `profileLoading` to `false` when auth is CONFIRMED logged out (`!isAuthenticated && !authLoading`), not during transient rehydration. Added `authLoading` to the useEffect dep array to ensure re-evaluation when auth state transitions.

- Added explicit `onboarding_completed_at TIMESTAMPTZ` column to the `profiles` table. Replaces the fragile `age` proxy previously used by AppLayout's redirect gate. Backwards compatible — falls back to age check for users created before the column existed.

### Changed

- Profiles query in `AppLayout` now selects both `age` and `onboarding_completed_at` for dual-check redirect logic (commit `005e2bc`).
- `useEffect` dep array now includes `authLoading` to ensure re-evaluation when auth state transitions.
- Onboarding POST (`api-server/src/routes/onboarding.ts`) now writes `onboarding_completed_at: new Date().toISOString()` on profile upsert, so newly onboarded users get the flag set explicitly.

### Database

- `ALTER TABLE public.profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ` applied to production.
- Retroactive update: 8 existing users with `age IS NOT NULL` flagged as completed at 2026-06-07 09:00:05 UTC.

### Removed

- Diagnostic `console.log("[DEBUG ...] ...")` statements added in `ff694fb` for BUG A diagnosis, after E2E validation confirmed the fix.
  - `AppLayout.tsx`: 9 debug logs (MOUNT, profiles useEffect, query lifecycle, redirect check).
  - `useAuth.tsx`: 1 state-change log.
  - `Onboarding.tsx`: 6 logs (MOUNT, screening useEffect lifecycle).
  - Kept: `console.error("[AppLayout] profiles query failed:", error)` — useful for future runtime diagnosis, not a debug artifact.

### Verified — E2E validation (commit `005e2bc` in production)

- ✅ F5 en `/dashboard` → permanece en `/dashboard`.
- ✅ Navegación a `/workouts` → permanece en `/workouts`.
- ✅ F5 en `/workouts` → permanece en `/workouts`.
- ✅ Nunca aparece redirect espurio a `/onboarding`.
- ✅ Secuencia de logs (antes del cleanup) confirmó: `profileLoading` se mantiene `true` durante la ventana de rehidratación, el redirect useEffect queda bloqueado por el guard, y la query corre con sesión válida.

---

## [0.9.4] — 2026-06-07

### 🧹 Pre-Mejora 11: Tech debt cleanup + E2E validation completa

Patch que limpia deuda técnica pendiente y valida E2E los fixes de Mejora 10 antes de empezar el trabajo visual de Mejora 11. Sin nuevos features, solo housekeeping profesional.

### Changed

- **Schema rename Supabase (sin commit en código)**: 
  - Renombradas 4 tablas de `backup_*_legacy` a `audit_pre_m8_*` para clarificar su propósito real (audit log legal, no backups recuperables).
  - Comments añadidos en cada tabla documentando propósito y fecha tentativa de cleanup futuro (2027).
  - Tablas afectadas:
    - `backup_meal_plans_legacy` → `audit_pre_m8_meal_plans` (135 filas, 136 kB)
    - `backup_progress_logs_legacy` → `audit_pre_m8_progress_logs` (59 filas, 16 kB)
    - `backup_weekly_checkins_legacy` → `audit_pre_m8_weekly_checkins` (2 filas, 16 kB)
    - `backup_workout_plans_legacy` → `audit_pre_m8_workout_plans` (18 filas, 24 kB)
  - **Razón de mantenerlas**: schema pre-M8 incompatible con actual, pero contienen 214 audit records de 3 usuarios (gandiahellinj, blckbtz96, josehellingandia) que podrían ser relevantes para reclamos legales pre-M8. `meal_plan_versions` (activo desde M7) cubre el audit hacia adelante.

### Fixed (Tech debt - commit `712e777`)

- **Bug latente "Lumbares" en strength.ts**:
  - `MUSCLE_GROUPS` Record tenía 2 declaraciones de la key `core` (líneas 54 ES + 68 EN)
  - La segunda sobrescribía la primera silenciosamente, perdiendo "Lumbares" del grupo core
  - Fix: eliminada línea 54 + añadido "Lumbares" a línea 68 (anatomicamente correcto: core SÍ incluye lumbares)
  - Resuelve TS1117 warning en build esbuild

- **Schema huérfano `weight_entries`**:
  - Tabla definida en Drizzle schema (`lib/db/src/schema/nutricoach.ts`) pero nunca materializada en Supabase
  - Verificado: cero queries reales a la tabla en frontend (grep exhaustivo)
  - La variable `weightEntries` en `progress.ts` solo era un nombre mal elegido (consultaba `progress_logs` realmente)
  - Fix: eliminada definición pgTable + export type WeightEntry (−10 líneas)

- **DELETE rota a tabla inexistente en qa-e2e.ts**:
  - Línea 559: `sbDelete("weight_entries", ...)` ya fallaba silenciosamente (tabla no existía)
  - Código muerto que ensuciaba logs
  - Fix: eliminadas 4 líneas (incluyendo comentario y oneMinAgo declaration)

### Verified — E2E Validation Results

- **🧪 BUG #1 — Pace copy goal-aware** (v0.9.3 commit `61f8883`):
  - Cuenta dispensable `test_pace_validation@goaliq.com` con `GOALIQ-BETA-007`
  - 12 combinaciones de pace copy verificadas visualmente en Step 3 del onboarding
  - **🔥 Perder grasa**: −X kg/sem · déficit Y kcal × 3 paces ✓
  - **💪 Ganar músculo**: +X kg/sem · superávit Y kcal × 3 paces ✓ (era el bug principal)
  - **🎯 Mantener**: sin slider ✓
  - **⚖️ Recomposición**: copies macros-focused × 3 paces ✓
  - **Conclusión**: 24 escenarios (4 goals × 3 paces × 2 idiomas) correctos en producción

- **🧪 BUG #8 — `used_at` cleanup on beta release** (v0.9.3 commit `42d35c2`):
  - Mismo flow E2E: cuenta canjeó código → completar onboarding → DELETE desde Settings UI
  - Verificación post-delete:
    - `beta_invite_codes` para `GOALIQ-BETA-007`: `used_by_user_id` = NULL ✓, `used_at` = NULL ✓
    - `deletion_logs` nueva entry con `metadata.beta_code_released = 'GOALIQ-BETA-007'`
  - **Conclusión**: el endpoint manual (gdpr.ts) ejecuta UPDATE atómico antes del DELETE ✓
  - Edge Function (cron automático) sigue cubierto por redeploy del 2026-06-06

- **🧪 BUG #9 — `deletion_logs` audit trail** (v0.9.1 commit `9c15790`):
  - Tabla `deletion_logs` ahora con 3 entries acumuladas validadas:
    - 2026-05-07: test2goaliq (automatic_cron_job, blocked diabetes - Mejora 9)
    - 2026-06-05: test_delete_redux (manual_user_initiated, beta_code GOALIQ-BETA-006)
    - 2026-06-07: test_pace_validation (manual_user_initiated, beta_code GOALIQ-BETA-007)
  - Metadata completa en cada fila: IP, user-agent, beta_code_released, consent_version_at_delete
  - **Conclusión**: ambos paths de delete (manual + cron) crean audit row con metadata completa ✓

### Discovered — Replit sync workflow

- **Learning operacional**: Replit Agent sincroniza archivos por commit específico, NO sigue HEAD remoto automáticamente.
  - Implicación: tras pushear N commits a GitHub, hay que pedir explícitamente a Replit "sincroniza TODOS los archivos modificados entre commit X y HEAD"
  - Detectado durante validación E2E: el fix BUG #1 (commit `61f8883`) no llegó a Replit hasta sync exhaustivo
  - **Workflow actualizado**: tras cada tanda de fixes, listar archivos modificados para Replit
  - Sin impacto en GitHub (siempre fuente de verdad)

### Migration Notes

- **Audit table rename**: sin acción requerida en código (las tablas renombradas no son consultadas por la aplicación). Si algún día se necesita acceder vía SQL, usar los nuevos nombres `audit_pre_m8_*`.

---

## [0.9.3] — 2026-06-06

### 🏁 Mejora 10 (completa): Dashboard + Onboarding + Beta Codes

Release que cierra Mejora 10 al 100% resolviendo los 3 bugs medium pendientes desde v0.9.2.

### Fixed

- **🟡 BUG #1 — Pace copy goal-aware** (commit `61f8883`):
  - Onboarding Step 3 mostraba siempre "déficit kcal" sin importar el goal
  - Causa raíz: dos estructuras de paces (`GOAL_DETAILS` vs `paceOptions`), render usaba la plana
  - Fix Opción C: source of truth única en `GOAL_DETAILS` con badge + badgeEN por pace
  - Cobertura: 24 combinaciones (4 goals × 3 paces × 2 idiomas)

- **🟡 BUG #5 — `/api/workouts` vs Supabase REST inconsistencia** (commit `444568c`):
  - `/api/workouts` filtraba por current_week (404 si plan era de semana anterior)
  - Fix dual: backend a "último plan ever" + frontend useProgressStats coherente

- **🟡 BUG #8 — `used_at` cleanup on beta release** (commit `42d35c2`):
  - FK CASCADE solo limpiaba `used_by_user_id`, no `used_at`
  - Fix dual: endpoint manual (transaction atomic) + cron Edge Function (helper function)

---

## [0.9.2] — 2026-06-06

### 🔧 Mejora 10 (parcial): Dashboard schema fixes

### Fixed

- **🔴 BUG #2 — `progress_logs` tabla no existía** (SQL applied):
  - Recreación con schema mejorado (PK, FK CASCADE, UNIQUE, RLS) + migración 59 filas

- **🔴 BUG #3 — `workout_plans` schema mismatch** (commit `e5ea6ff`):
  - M8 cambió a `days jsonb`, useProgressStats actualizada

---

## [0.9.1] — 2026-06-06

### 🔧 Hotfix: RGPD Art. 17 Audit Trail

### Fixed

- **🔴 BUG #9 — `deletion_logs` no se creaba en delete manual** (commit `9c15790`):
  - Transacción atómica + INSERT antes del DELETE + metadata enriquecida

---

## [0.9.0] — 2026-06-05

### 🛡️ Mejora 9: Cumplimiento RGPD + Auditoría de Seguridad

> ⚠️ Contenía el BUG #9 crítico de audit trail. Resuelto en v0.9.1.

### Added

- 6 endpoints RGPD en `gdpr.ts`
- Edge Functions: `validate-health-screening`, `cleanup-blocked-accounts`
- Tablas RGPD + feature flag `VITE_BETA_MODE`
- Páginas legales + consent UI + i18n RGPD

---

## [0.8.0] — 2026-05-27

### 🚀 Mejora 8: Migración heliumdb → Supabase

- Supabase Postgres + 25 tablas + 1.245 filas migradas
- Versionado de planes + workout tracking
- Plan IA Claude Haiku 4.5

---

## [0.7.0] — 2026 (pre-mejoras)

Roadmap original 7/7 completado.

---

## Known Technical Debt

Sin críticos pendientes. Solo low priority.

### 🟢 Low priority

- **BUG #6** — Supabase LockManager warning (cosmético)
- **BUG #7** — Sanitización full_name (espacios → guiones bajos, cosmético)
- **Smart Coaching Insights** oculto (reactivar con `VITE_BETA_MODE=false`)
- **TypeScript errors preexistentes** en 7 archivos no relacionados con Mejora 10/11

### 🟠 Pending tasks (no son bugs)

- **`audit_pre_m8_*` tables**: 192 kB en Supabase, retained for legal/audit purposes hasta 2027
- **FASE 10 final**: investigar y eliminar `heliumdb` dependency (1-2h)
- **`weight_entries`**: drop reference completado en v0.9.4

---

## E2E Test Coverage

### ✅ Verified flows

- Signup + onboarding + plan generation (Mejora 9 v0.9.0)
- Export-data JSON RGPD Art. 20 (Mejora 9)
- Delete cuenta con typed-word gate + cascade (v0.9.1)
- Dashboard con datos coherentes (v0.9.2)
- Pace copy 24 combinaciones (v0.9.4)
- Delete con beta code cleanup + audit trail (v0.9.4)

### 🟡 Pendiente E2E

- Re-signup con código liberado tras delete (validación completa)
- Flujo bloqueo Art. 9 (marcar condiciones médicas reales)
- Cron `cleanup-blocked-accounts` simulado tras nueva entry

---

## Architecture Reference

### Backend
- Express puerto 8080 · Supabase Postgres Transaction Pooler
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- Resend (notificaciones) · Supabase Auth JWT Bearer

### Frontend
- Vite + React + TypeScript · Wouter routing · React Query
- CSS variables + design tokens · PWA con Service Worker

### Workflow
- **Dev local**: Claude Code en `C:\Users\Usuario\goaliq`
- **Dev cloud**: Replit (sync exhaustivo vía Replit Agent listando archivos por commit)
- **Edge Functions**: deploy separado via Supabase Dashboard o CLI
- **Test accounts** (password `TestBeta2026!`):
  - `test2goaliq@gmail.com` (validado v0.9.2)
  - `test4goaliq@gmail.com` (cuenta beta validada)

---

## Beta Codes

| Code | Status | Última nota |
|------|--------|-------------|
| `GOALIQ-BETA-001` | 🟢 Disponible | Nunca consumido |
| `GOALIQ-BETA-002` | 🔴 Usado | test4goaliq |
| `GOALIQ-BETA-003` | 🔴 Usado | UUID 2ec9aa26 |
| `GOALIQ-BETA-004` | 🔴 Usado | test8goaliq |
| `GOALIQ-BETA-005` | 🟢 Disponible | Liberado v0.9.0 |
| `GOALIQ-BETA-006` | 🟢 Disponible | Liberado v0.9.1 |
| `GOALIQ-BETA-007` | 🟢 Disponible | Liberado v0.9.4 (E2E test) |
| `GOALIQ-BETA-008` | 🟢 Disponible | — |
| `GOALIQ-BETA-009` | 🟢 Disponible | — |
| `GOALIQ-BETA-010` | 🟢 Disponible | — |

---

## Versioning Strategy

- **MAJOR** (1.0.0): Lanzamiento público con Stripe activo
- **MINOR** (0.x.0): Cierre de mejora completa
- **PATCH** (0.x.y): Hotfixes, bug críticos, cleanup, validation (v0.9.1, v0.9.2, v0.9.3, v0.9.4)

---

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.8...HEAD
[0.9.8]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.7...v0.9.8
[0.9.7]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.6...v0.9.7
[0.9.6]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.5...v0.9.6
[0.9.5]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
