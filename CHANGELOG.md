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

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.4...HEAD
[0.9.4]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
