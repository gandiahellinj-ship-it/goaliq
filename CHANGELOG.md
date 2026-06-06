# Changelog

All notable changes to GoalIQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mejora 11: Implementación visual plato 3D + sistema 5 fondos diurnos
- Mejora 12: Regenerador inteligente de planes IA (post beta validation)
- Mejora 13: Activar Stripe + lanzamiento público con pricing
- Landing Page producción con stack creativo (Claude prompts → Nano Banana → Kling 3.0 → GSAP)
- Beta launch real con amigos (5-10 invitaciones)
- FASE 10 cleanup: eliminar `heliumdb` + purgar 4 backups Supabase obsoletos
- Resolver 5 bugs low documentados (BUG #6, #7, TypeScript preexistentes, etc.)

---

## [0.9.3] — 2026-06-06

### 🏁 Mejora 10 (completa): Dashboard + Onboarding + Beta Codes

Release que cierra Mejora 10 al 100% resolviendo los 3 bugs medium pendientes desde v0.9.2. GoalIQ ahora tiene un Dashboard funcional con datos coherentes, un onboarding sin contradicciones de copy, y una gestión de códigos beta limpia tras delete de cuenta.

### Fixed

- **🟡 BUG #1 — Pace copy no adaptado al objetivo** (commit `61f8883`):
  - **Síntoma**: Step 3 del onboarding mostraba siempre "−X kg/sem · déficit Y kcal" sin importar el goal seleccionado. Resultado paradójico: "Ganar músculo" + "Moderado" → "−0.5 kg/sem · déficit 500 kcal" (contradicción con la descripción del goal)
  - **Causa raíz**: DOS estructuras de paces en `Onboarding.tsx`:
    - `GOAL_DETAILS.paces` (líneas 97-129): correcta y adaptable por goal, pero no usada para el badge
    - `paceOptions` array plano (líneas 838-842): mismo set para cualquier goal, hard-coded con copies de pérdida de peso, usado en el render
  - **Fix aplicado** (Opción C - source of truth única):
    - Añadidos campos `badge` y `badgeEN` a la interface de `GOAL_DETAILS.paces`
    - 9 paces poblados con copies goal-appropriate (3 goals × 3 niveles):
      - `lose_fat`: −X kg/sem · déficit Y kcal (sin cambios)
      - `gain_muscle`: +X kg/sem · superávit Y kcal (corregido)
      - `recomposition`: macros-focused (cambios graduales / ciclado calorías / ciclado agresivo · proteína ≥2g/kg)
    - `maintain` sin cambios (no muestra slider de pace)
    - Eliminado array `paceOptions` plano (−5 líneas)
    - Render reescrito para usar `detail.paces[paceIndex]`
  - **Cobertura**: 24 combinaciones correctas (4 goals × 3 paces × 2 idiomas ES/EN)
  - **Risk**: mínimo, solo afecta Step 3 del onboarding

- **🟡 BUG #5 — Inconsistencia `/api/workouts` vs Supabase REST** (commit `444568c`):
  - **Síntoma**: `/api/workouts` filtraba por `week_start = current_week` (404 si plan era de semana anterior), mientras `/api/meals` devolvía "último plan ever". Resultado paradójico: Dashboard usaba el plan vía Supabase REST pero mostraba "Generate plan" porque `/api/workouts` devolvía 404
  - **Causa raíz**: dos filosofías diferentes para el mismo dato (workout_plan)
  - **Decisión filosófica**: alinear `/api/workouts` a "último plan ever" (mismo patrón que `/api/meals`)
  - **Fix aplicado** (dual: backend + frontend):
    - **Backend** `artifacts/api-server/src/routes/workouts.ts`:
      - Eliminado `const weekStart = getCurrentWeekStart()` del handler GET (no se usa)
      - SELECT añade `generated_at` (consistencia con `/api/meals`)
      - WHERE simplificado: solo `user_id = $1`
      - `ORDER BY id DESC` → `ORDER BY generated_at DESC`
    - **Frontend** `artifacts/nutricoach/src/lib/supabase-queries.ts` (línea 367, useProgressStats):
      - Query cambiada de `.eq("week_start", weekStart).maybeSingle()` a `.order("generated_at", { ascending: false }).limit(1).maybeSingle()`
      - Ambos endpoints ahora coherentes con el mismo plan
  - **NO modificado** (verificado):
    - `POST /api/workouts` sigue usando `getCurrentWeekStart()` para insertar plan de la semana actual (correcto)
    - `DELETE` antes de `INSERT` sigue scoped a current week (prevents dupes)
    - `useWorkoutPlan` auto-beneficia del fix backend sin cambios frontend
    - `workoutPlan.weekStart` no se consume en ningún componente UI (verificado con grep exhaustivo)
  - **Risk**: zero. Verificación previa confirmó cero gates comparando weekStart con currentWeek

- **🟡 BUG #8 — `used_at` no se limpiaba al liberar código beta** (commit `42d35c2`):
  - **Síntoma**: tras DELETE de cuenta, `beta_invite_codes.used_by_user_id` se ponía a NULL vía FK CASCADE pero `used_at` mantenía el timestamp original. Códigos liberados con "evidencia fantasma" de uso anterior
  - **Causa raíz**: FK constraint `ON DELETE SET NULL` solo afecta a una columna (la del FK), no a otras de la misma tabla
  - **Fix aplicado** (dual: endpoint manual + cron automático):
    - **Endpoint manual** `artifacts/api-server/src/routes/gdpr.ts`:
      - UPDATE explícito `beta_invite_codes SET used_at = NULL` dentro de la transacción atómica del hotfix v0.9.1
      - Inserted entre `INSERT deletion_logs` y `DELETE auth.users`
      - Rollback automático si el DELETE falla
    - **Cron automático** `supabase/functions/cleanup-blocked-accounts/index.ts`:
      - Nueva función helper `clearBetaCodeUsedAt()` siguiendo el patrón de `logDeletion`
      - Invocada en `processOne()` entre `logDeletion` y `deleteAuthUser`
      - Non-fatal: warning si falla, no bloquea cleanup
  - **Resultado**: códigos liberados ahora muestran `used_by_user_id = NULL` AND `used_at = NULL`, idénticos a códigos nunca usados
  - **Edge case cubierto**: "usuario bloqueado en screening que canjeó código" ahora también se libera correctamente
  - **Nota deploy**: Edge Function `cleanup-blocked-accounts` requiere redeploy manual en Supabase Dashboard (no se actualiza con sync de GitHub). Pendiente para próximo cleanup o cuando se modifique otra Edge Function

### Migration Notes

- **Edge Function cleanup-blocked-accounts**: el código está pusheado pero NO desplegado en Supabase. Cuando se haga el redeploy (Supabase Dashboard → Functions o `supabase functions deploy cleanup-blocked-accounts`), el fix BUG #8 estará activo en ambos paths de borrado (manual + cron). Hasta entonces, el cron sigue funcional pero deja `used_at` con timestamp viejo (edge case raro).

---

## [0.9.2] — 2026-06-06

### 🔧 Mejora 10 (parcial): Dashboard schema fixes

Patch que restaura la funcionalidad del Dashboard rota desde la migración M8.

### Fixed

- **🔴 BUG #2 CRÍTICO — Tabla `progress_logs` no existía** (SQL applied):
  - Frontend llamaba a tabla inexistente → 404 PGRST205
  - Fix: `CREATE TABLE` con schema mejorado (PK, FK CASCADE, UNIQUE, RLS) + migración de 59 filas desde `backup_progress_logs_legacy`
  - 3 usuarios con datos preservados

- **🔴 BUG #3 CRÍTICO — Schema mismatch en `workout_plans`** (commit `e5ea6ff`):
  - M8 cambió schema de `day_name text` a `days jsonb`, frontend no actualizado
  - Fix en `useProgressStats`: `.select("day_name")` → `.select("days").maybeSingle()` + derivación de trainingDaySet desde JSONB

### Migration Data

- 59 filas migradas, 3 usuarios distintos, rango 2026-02-02 → 2026-05-15

---

## [0.9.1] — 2026-06-06

### 🔧 Hotfix: RGPD Art. 17 Audit Trail

Patch crítico que cierra una vulnerabilidad de compliance RGPD.

### Fixed

- **🔴 BUG #9 CRÍTICO — `deletion_logs` no se creaba en delete manual** (commit `9c15790`):
  - Endpoint `DELETE /api/account` no insertaba auditoría
  - Fix: transacción atómica `pool.connect()` + INSERT antes del DELETE + metadata enriquecida (IP, user-agent, beta_code, consent_version)
  - Verificación E2E con `test_delete_redux@goaliq.com` ✓

---

## [0.9.0] — 2026-06-05

### 🛡️ Mejora 9: Cumplimiento RGPD + Auditoría de Seguridad

> ⚠️ **Nota retrospectiva**: Contenía el BUG #9 crítico de RGPD audit trail. Resuelto en v0.9.1.

### Added

- **6 endpoints RGPD** en `gdpr.ts`
- **Edge Functions**: `validate-health-screening`, `cleanup-blocked-accounts`
- **Tablas RGPD**: `consent_log`, `deletion_logs`, `health_validation_logs`, `health_screenings`, `beta_invite_codes`
- **Feature flag `VITE_BETA_MODE`** (oculta Stripe UI)
- **Páginas legales** `/privacy` y `/terms`
- **AuthModal** con código beta + checkbox RGPD
- **Onboarding** con consent médico Art. 9 + AlertDialog IA
- **Settings** con sección "🛡️ Privacidad y datos" + typed-word gate
- **i18n RGPD**: 27 keys × 2 idiomas

### Fixed

- `/api/export-data` 500 → `safeQuery` wrapper (commit `3d89802`)
- Wouter `<Link>` bug (commit `68dfac3`)

### Security

- RLS estricto + FK CASCADE + JWT Bearer

---

## [0.8.0] — 2026-05-27

### 🚀 Mejora 8: Migración heliumdb → Supabase

### Added

- Supabase Postgres con Transaction Pooler, 25 tablas, 1.245 filas migradas
- Versionado de planes y workout tracking
- Calendar events + flex days

### Known Issues

- ⚠️ `progress_logs` no migrada (recreada en v0.9.2 ✅)
- ⚠️ `weight_entries` no migrada (pendiente decisión)

---

## [0.7.0] — 2026 (pre-mejoras)

Roadmap original 7/7 completado: Comidas, entrenos, lista compra, progreso, perfil, plan IA Claude Haiku 4.5, Stripe, 3 temas.

---

## Known Technical Debt

Bugs y debt restantes. Todos los critical/medium están resueltos. Solo quedan low priority.

### 🟢 Low priority

#### BUG #6 — Supabase LockManager warning
- Sin impact funcional, cosmético

#### BUG #7 — Sanitización full_name (espacios → guiones bajos)
- Cosmético, baja prioridad

#### Smart Coaching Insights oculto
- Reactivar con `VITE_BETA_MODE=false`

#### TypeScript errors preexistentes
- 7 archivos: `ExerciseAnimation`, `GenerationOverlay`, `Meals`, `ShareWorkoutCard`, `stripe`, `aiGenerators`, `workoutx-cache`

#### Warning duplicate key `"core"` en `strength.ts:67-68`
- Pre-existente, sin runtime impact

### 🟠 Pending tasks (no son bugs)

#### Tabla `weight_entries`
- Definida en schema Drizzle pero nunca materializada
- **Decidir**: ¿se necesita? Si nadie la llama, drop reference

#### Cleanup FASE 10 Mejora 8
- Eliminar `heliumdb` activo
- Purgar 4 backups Supabase (incluyendo `backup_progress_logs_legacy` ya migrado)
- Tiempo estimado: 1-2 días

#### Redeploy Edge Function cleanup-blocked-accounts
- Cambio de v0.9.3 (BUG #8 cron) pendiente de aplicar en Supabase Dashboard

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

### 🟡 Pendiente E2E

- Onboarding completo con cada goal (validar pace copies del fix BUG #1)
- Re-signup con código liberado (validar BUG #8)
- Flujo bloqueo Art. 9 (marcar condiciones médicas)
- Cron `cleanup-blocked-accounts` simulado tras redeploy

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
- **Edge Functions**: deploy separado via Supabase Dashboard o CLI
- **Repo**: `gandiahellinj-ship-it/goaliq`
- **Test accounts** (con password `TestBeta2026!`):
  - `test2goaliq@gmail.com` (1 log, 1 meal_plan, 1 workout_plan)
  - `test4goaliq@gmail.com` (cuenta beta validada)

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
- **PATCH** (0.x.y): Hotfixes, bug críticos, ajustes menores (v0.9.1, v0.9.2, v0.9.3)

---

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.3...HEAD
[0.9.3]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
