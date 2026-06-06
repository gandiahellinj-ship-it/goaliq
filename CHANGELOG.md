# Changelog

All notable changes to GoalIQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mejora 10 continuación: resolver BUG #5 (inconsistencia `/api/workouts` vs Supabase REST), BUG #1 (pace copy), BUG #8 (used_at no se limpia)
- Mejora 11: Regenerador inteligente de planes IA (post beta validation)
- Mejora 12: Activar Stripe + lanzamiento público con pricing
- Landing Page producción con stack creativo (Claude prompts → Nano Banana → Kling 3.0 → GSAP)
- FASE 10 cleanup: eliminar `heliumdb` + purgar 4 backups Supabase obsoletos (incluyendo `backup_progress_logs_legacy` ya migrado)

---

## [0.9.2] — 2026-06-06

### 🔧 Mejora 10 (parcial): Dashboard schema fixes

Patch que restaura la funcionalidad del Dashboard rota desde la migración M8. Descubrimiento durante test E2E reveló 2 bugs críticos heredados que rompían el cálculo de progreso, adherencia y streak.

### Fixed

- **🔴 BUG #2 CRÍTICO — Tabla `progress_logs` no existía** (SQL applied 2026-06-06):
  - **Síntoma**: 8 sitios del frontend (Dashboard, Profile, useHealthCheck, useLogWeight, useToggleWorkoutComplete) llamaban a una tabla inexistente vía Supabase REST → 404 PGRST205
  - **Causa raíz**: tabla perdida durante migración M8 (heliumdb → Supabase). Solo quedaba `backup_progress_logs_legacy` como evidencia (59 filas, 3 usuarios)
  - **Impacto runtime**: Dashboard sin métricas, log de peso fallaba silenciosamente, Profile vacío, calendario sin checkmarks
  - **Fix aplicado** (Estrategia A — recrear tabla):
    - `CREATE TABLE public.progress_logs` con schema mejorado:
      - PRIMARY KEY en `id` (antes era nullable sin PK)
      - `user_id NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (antes nullable sin FK)
      - `UNIQUE (user_id, log_date)` constraint para prevenir duplicados
      - `DEFAULT now()` en `created_at`
      - 2 índices: `(user_id)` y `(user_id, log_date DESC)`
    - RLS habilitado con 4 policies (SELECT/INSERT/UPDATE/DELETE) restringidas a `auth.uid() = user_id`
    - Migración de 59 filas desde `backup_progress_logs_legacy` con `ON CONFLICT DO NOTHING` y `COALESCE` para defaults
    - 3 usuarios con datos preservados: `gandiahellinj@gmail.com` (53 logs), `blckbtz96@gmail.com` (5 logs), `test2goaliq@gmail.com` (1 log)
    - Frontend NO modificado (8 sitios siguen funcionando con la tabla recreada)
  - **Verificación E2E**: login con `test2goaliq@gmail.com` → Network tab muestra `progress_logs?select=*&order=log_date.asc` → 200 OK

- **🔴 BUG #3 CRÍTICO — Schema mismatch en `workout_plans`** (commit `e5ea6ff`):
  - **Síntoma**: `GET /rest/v1/workout_plans?select=day_name&week_start=eq.2026-05-31` → 400 Bad Request
  - **Causa raíz**: M8 cambió el schema de `workout_plans` de "una fila por día con `day_name text`" a "una fila por semana con `days jsonb`". El frontend (`useProgressStats`) seguía usando el schema viejo
  - **Impacto runtime**: cálculo de `weeklyAdherence`, `streak` y `todayIsTrainingDay` roto en Dashboard
  - **Fix aplicado** en `artifacts/nutricoach/src/lib/supabase-queries.ts` (+5/-4 líneas, solo en `useProgressStats`):
    - Query cambiada de `.select("day_name").eq(...)` a `.select("days").eq(...).maybeSingle()`
    - Nueva línea derivando array de JSONB: `const workoutDays = ((workouts as any)?.days ?? []) as Array<{ day_name: string }>`
    - `trainingDaySet` ahora se construye desde el JSONB en lugar de filas separadas
    - `totalWorkoutsThisWeek = trainingDaySet.size` (set count en vez de array length)
  - **Risk**: mínimo. Solo afecta `useProgressStats`. `useWorkoutPlan` no se toca (ya usa `/api/workouts` endpoint correctamente)
  - **Verificación E2E**: Network tab muestra `workout_plans?select=days&week_start=eq.2026-06-01` → 200 OK con `days` jsonb

### Changed

- **Schema improvement** de `progress_logs` (versus original):
  - Nuevas constraints NOT NULL en `user_id` y `log_date`
  - PRIMARY KEY explícito en `id`
  - FK con `ON DELETE CASCADE` a `auth.users`
  - UNIQUE constraint en `(user_id, log_date)` 
  - DEFAULT `now()` en `created_at`
  - Defaults `false` en `workout_completed` y `meals_followed`

### Known Issues Discovered

- **🟡 BUG #5 menor — Inconsistencia `/api/workouts` vs Supabase REST**:
  - `/api/workouts` filtra por `week_start = current_week` → 404 si plan es de semana anterior
  - `workout_plans?week_start=eq.X` (Supabase REST) devuelve plan si la fecha coincide
  - **Resultado paradójico**: Dashboard ve "tienes plan" pero CTA "Generate plan" aparece
  - **Severity**: 🟡 Medium UX, no bloquea funcionalidad
  - **Documentado para próxima sesión Mejora 10**

### Migration Data

- **Datos preservados de progress_logs** (post-migración):
  - Total: 59 filas migradas
  - Usuarios: 3 distintos
  - Rango temporal: 2026-02-02 → 2026-05-15
  - Logs con peso registrado: ~12
  - Backup `backup_progress_logs_legacy` mantenido como redundancia (pendiente eliminar en FASE 10)

---

## [0.9.1] — 2026-06-06

### 🔧 Hotfix: RGPD Art. 17 Audit Trail

Patch crítico que cierra una vulnerabilidad de compliance RGPD descubierta durante el test E2E de borrado de cuentas.

### Fixed

- **🔴 BUG #9 CRÍTICO — `deletion_logs` no se creaba en delete manual** (commit `9c15790`):
  - Endpoint `DELETE /api/account` borraba la cuenta pero no insertaba auditoría
  - Solo el cron automático escribía en `deletion_logs`
  - Fix: wrap en transacción atómica `pool.connect()` + `BEGIN/COMMIT/ROLLBACK`, INSERT antes del DELETE, metadata enriquecida (IP, user-agent, beta_code, consent_version)
  - Verificación E2E con `test_delete_redux@goaliq.com` + `GOALIQ-BETA-006` ✓

---

## [0.9.0] — 2026-06-05

### 🛡️ Mejora 9: Cumplimiento RGPD + Auditoría de Seguridad

Release que cierra la fase de compliance previa al lanzamiento de beta privada.

> ⚠️ **Nota retrospectiva**: Contenía el BUG #9 crítico de RGPD audit trail. Resuelto en v0.9.1.

### Added

- **6 endpoints RGPD** en `artifacts/api-server/src/routes/gdpr.ts`
- **Edge Functions Supabase**: `validate-health-screening`, `cleanup-blocked-accounts`
- **Tablas RGPD**: `consent_log`, `deletion_logs`, `health_validation_logs`, `health_screenings`, `beta_invite_codes`
- **Feature flag `VITE_BETA_MODE`** (oculta Stripe UI)
- **Páginas legales** `/privacy` y `/terms`
- **AuthModal** con código beta + checkbox RGPD
- **Onboarding** con consent médico Art. 9 + AlertDialog IA
- **Settings** con sección "🛡️ Privacidad y datos" + typed-word gate
- **i18n RGPD**: 27 keys × 2 idiomas
- **TypeScript bot `goaliq-test-bot`**

### Fixed

- `/api/export-data` devolvía 500 (commit `3d89802`): `safeQuery` wrapper + eliminadas 2 queries obsoletas
- Bug Wouter `<Link>` → `<a target="_blank">` (commit `68dfac3`)

### Security

- RLS estricto + FK CASCADE + JWT Bearer + body validation literal

### Deprecated

- `heliumdb` (pendiente FASE 10) + 4 backups Supabase obsoletos

---

## [0.8.0] — 2026-05-27

### 🚀 Mejora 8: Migración heliumdb → Supabase

### Added

- **Supabase** vía Transaction Pooler EU Central 1, 25 tablas, 1.245 filas migradas
- **Versionado de planes**: `meal_plan_versions`, `workout_plan_versions`, `profile_change_events`
- **Calendario**: `calendar_events` (7 días) + `flex_days`
- **Workout tracking**: `workout_history` + `strength_logs`

### Changed

- `db.ts` usa cliente `pg` con pooler
- M7 (Plan IA con Claude Haiku 4.5) verificado en producción

### Fixed

- Inconsistencias tipos heliumdb ↔ Postgres + FK ON DELETE CASCADE

### Known Issues

- ⚠️ `weight_entries` y `progress_logs` no migradas
  - `progress_logs` recreada en v0.9.2 ✅
  - `weight_entries` sigue pendiente (puede que no sea necesaria)

---

## [0.7.0] — 2026 (pre-mejoras)

Roadmap original 7/7 completado:
- Comidas + entrenos + lista compra + progreso + perfil
- Plan IA con Claude Haiku 4.5
- Stripe integration tested
- 3 temas: Lima Noir, Rosa Suave, Grafito Lima

---

## Known Technical Debt

Bugs y debt descubiertos. Priorizados para continuación de Mejora 10.

### 🔴 Critical (resolver próxima sesión)

#### ~~BUG #2 — `progress_logs` 404 rompe el Dashboard~~ ✅ RESUELTO en v0.9.2

#### ~~BUG #3 — `workout_plans` query con error 400~~ ✅ RESUELTO en v0.9.2

#### Tabla faltante restante en Supabase
- `weight_entries` — definida en schema Drizzle pero nunca materializada
- **Decidir**: ¿realmente se necesita? Si nadie la llama, drop schema reference

### 🟡 Medium

#### BUG #5 — Inconsistencia `/api/workouts` vs Supabase REST
- **Descubierto**: 2026-06-06 (test E2E v0.9.2)
- `/api/workouts` filtra por week_start ACTUAL, Supabase REST devuelve cualquier semana
- **Resultado**: CTA "Generate plan" aparece cuando técnicamente sí hay plan
- **Fix propuesto**: alinear lógica de ambos endpoints (¿último plan ever vs current week?)
- **Tiempo**: 30-45 min

#### BUG #1 — Pace copy no se adapta al objetivo
- **Descubierto**: 2026-06-06 (test E2E)
- "Ganar músculo" muestra "déficit 1000 kcal" (copy de pérdida)
- **Fix**: switch por `goal` en `getPaceLabel(goal, pace)`
- **Tiempo**: 30-45 min

#### BUG #8 — `used_at` no se limpia al liberar código beta
- `used_by_user_id` vuelve a NULL pero `used_at` mantiene timestamp
- **Fix**: añadir `used_at = NULL` al UPDATE en endpoint DELETE
- **Tiempo**: 5 min

#### Warning duplicate key `"core"` en `strength.ts:67-68`

#### Cleanup pendiente FASE 10 Mejora 8
- Eliminar `heliumdb` + purgar 4 backups (incluyendo `backup_progress_logs_legacy` ya migrado)

### 🟢 Low

#### BUG #6 — Supabase LockManager warning
- Sin impact funcional, configurar storage option

#### BUG #7 — Sanitización full_name (espacios → guiones bajos)
- Cosmético

#### Smart Coaching Insights oculto
- Reactivar con `VITE_BETA_MODE=false`

#### TypeScript errors preexistentes
- 7 archivos: `ExerciseAnimation`, `GenerationOverlay`, `Meals`, `ShareWorkoutCard`, `stripe`, `aiGenerators`, `workoutx-cache`

---

## E2E Test Coverage

### ✅ Verified flows (manual, 2026-06-05 / 2026-06-06)

- Signup con código beta → onboarding 7 steps → consent Art. 9 → plan IA
- Export-data JSON 30KB con 15 keys (Art. 20)
- Delete cuenta con typed-word gate + transacción atómica:
  - Cascada FK perfecta en 12 tablas
  - Liberación de código beta
  - `deletion_logs` audit row con metadata completa (v0.9.1)
- Dashboard con cuenta beta `test2goaliq@gmail.com` (v0.9.2):
  - `progress_logs` queries → 200 OK
  - `workout_plans` queries → 200 OK con `.select("days")`
  - Sin errores Console
  - Network limpio (excepción documentada: BUG #5 menor)

### 🟡 Pendiente E2E

- Re-signup con código liberado
- Flujo bloqueo Art. 9 (marcar condiciones médicas)
- Cron `cleanup-blocked-accounts` simulado
- Múltiples consents (detectar bug con 6x ai_disclosure de `test4goaliq`)

---

## Architecture Reference

### Backend
- Express puerto 8080 · Supabase Postgres Transaction Pooler
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- Resend (notificaciones) · Supabase Auth JWT Bearer · Stripe (oculto)

### Frontend
- Vite + React + TypeScript · Wouter routing · React Query
- CSS variables + design tokens · PWA con Service Worker

### Workflow
- **Dev local**: Claude Code en `C:\Users\Usuario\goaliq`
- **Dev cloud**: Replit (sync vía Replit Agent solicitando pull, NO `git pull` directo)
- **Repo**: `gandiahellinj-ship-it/goaliq`
- **Test accounts** (con password `TestBeta2026!`):
  - `test2goaliq@gmail.com` (1 log, 1 meal_plan, 1 workout_plan)
  - `test4goaliq@gmail.com` (cuenta beta validada en M9)

---

## Beta Codes

| Code | Status | Notas |
|------|--------|-------|
| `GOALIQ-BETA-001` | 🟢 Disponible | Nunca consumido |
| `GOALIQ-BETA-002` | 🔴 Usado | test4goaliq |
| `GOALIQ-BETA-003` | 🔴 Usado | UUID 2ec9aa26 |
| `GOALIQ-BETA-004` | 🔴 Usado | test8goaliq |
| `GOALIQ-BETA-005` | 🟢 Disponible | Liberado tras E2E v0.9.0 |
| `GOALIQ-BETA-006` | 🟢 Disponible | Liberado tras E2E v0.9.1 |
| `GOALIQ-BETA-007` | 🟢 Disponible | — |
| `GOALIQ-BETA-008` | 🟢 Disponible | — |
| `GOALIQ-BETA-009` | 🟢 Disponible | — |
| `GOALIQ-BETA-010` | 🟢 Disponible | — |

---

## Versioning Strategy

- **MAJOR** (1.0.0): Lanzamiento público con Stripe activo
- **MINOR** (0.x.0): Cierre de mejora completa (M8 = 0.8.0, M9 = 0.9.0)
- **PATCH** (0.x.y): Hotfixes, bug críticos, ajustes menores (v0.9.1, v0.9.2)

---

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.2...HEAD
[0.9.2]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
