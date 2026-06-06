# Changelog

All notable changes to GoalIQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mejora 10: Analytics + Feedback widget (Plausible/PostHog + in-app feedback)
- Mejora 11: Regenerador inteligente de planes IA (post beta validation)
- Mejora 12: Activar Stripe + lanzamiento público con pricing
- Landing Page producción con stack creativo (Claude prompts → Nano Banana → Kling 3.0 → GSAP)
- Restaurar tablas faltantes: `weight_entries` y `progress_logs` (perdidas en migración M8)
- Resolver 7 bugs no-críticos documentados en Known Technical Debt

---

## [0.9.1] — 2026-06-06

### 🔧 Hotfix: RGPD Art. 17 Audit Trail

Patch crítico que cierra una vulnerabilidad de compliance RGPD descubierta durante el test E2E de borrado de cuentas. Sin este fix, los borrados voluntarios de usuarios (Art. 17) no quedaban auditados en `deletion_logs`, violando los requisitos de trazabilidad de la AEPD.

### Fixed

- **🔴 BUG #9 CRÍTICO — `deletion_logs` no se creaba en delete manual** (commit `9c15790`):
  - **Síntoma**: endpoint `DELETE /api/account` borraba la cuenta correctamente vía cascada FK, PERO no insertaba la fila de auditoría en `deletion_logs`. Solo el cron automático `cleanup-blocked-accounts` escribía en esa tabla.
  - **Impacto RGPD**: violación Art. 17.2 (sin pruebas auditables de borrado voluntario, vulnerable a sanciones AEPD)
  - **Causa raíz**: el endpoint manual nunca implementó el INSERT de auditoría
  - **Fix aplicado** en `artifacts/api-server/src/routes/gdpr.ts`:
    - Wrap en transacción atómica `pool.connect()` + `BEGIN/COMMIT/ROLLBACK`
    - INSERT en `deletion_logs` **antes** del DELETE de `auth.users` (mismo patrón que el cron, evita pérdida de FK references)
    - Captura `beta_code_used` y `consent_version` ANTES del cascade
    - Metadata enriquecida: `{ version, ip_address, user_agent, beta_code_released, consent_version_at_delete }`
    - `deletion_reason: 'rgpd_art_17_user_request'` (literal, no usa default sesgado al cron)
    - `deletion_method: 'manual_user_initiated'` (literal, no usa default sesgado al cron)
  - **Verificación E2E** (2026-06-05, cuenta `test_delete_redux@goaliq.com` con código `GOALIQ-BETA-006`):
    - Cascada FK perfecta en 12 tablas
    - `auth.users` y `profiles` borrados
    - Código beta liberado (`used_by_user_id = NULL`)
    - `deletion_logs` con fila correcta + metadata completa ✓

### Discovered During Testing

8 bugs adicionales detectados durante el test E2E del 2026-06-05. Documentados en Known Technical Debt para resolución progresiva (no bloqueantes para beta privada con usuarios técnicos, sí prioritarios antes de launch público).

---

## [0.9.0] — 2026-06-05

### 🛡️ Mejora 9: Cumplimiento RGPD + Auditoría de Seguridad

Release que cierra la fase de compliance previa al lanzamiento de beta privada. GoalIQ ahora cumple con los derechos del RGPD (Art. 9, 15, 17, 20) para gestión de datos de salud, y oculta la capa de monetización Stripe mediante feature flag.

> ⚠️ **Nota retrospectiva**: Esta release contenía el BUG #9 crítico de RGPD audit trail. Resuelto en v0.9.1 (hotfix del 2026-06-06).

### Added

#### Backend
- **6 endpoints RGPD** en `artifacts/api-server/src/routes/gdpr.ts`:
  - `POST /api/validate-health-screening` — validación de cuestionario médico (Art. 9)
  - `GET /api/export-data` — exportación completa de datos del usuario (Art. 20)
  - `DELETE /api/account` — eliminación de cuenta con doble confirmación (Art. 17)
  - `GET /api/consents-history` — historial de consentimientos otorgados
  - `POST /api/consent` — registro de nuevo consentimiento
  - `GET /api/health-validation-logs` — auditoría de validaciones médicas
- **Edge Functions Supabase**:
  - `validate-health-screening` (commit `a65ddb3`) — validación server-side cuestionario salud
  - `cleanup-blocked-accounts` con cron diario a las 3 AM — hard delete tras 90 días + notificación Resend
- **Tablas RGPD en Supabase** (nombres reales verificados):
  - `consent_log` — registro auditable de consentimientos (no `consents_history` como se documentó originalmente)
  - `deletion_logs` (11 columnas) — auditoría de eliminaciones GDPR
  - `health_validation_logs` — auditoría de validaciones médicas
  - `health_screenings` — datos sensibles Art. 9 con RLS estricto
  - `beta_invite_codes` — gestión códigos invitación beta privada (no `beta_codes`)
- **Columnas RGPD en `profiles`** (snapshot de consentimientos):
  - `terms_accepted_at`, `privacy_accepted_at`, `medical_consent_at`, `ai_disclosure_acknowledged_at`
  - `beta_code_used`, `consent_version`
- **Feature flag `VITE_BETA_MODE`** (default: `true`):
  - Oculta toda la UI de Stripe (`TrialGate`, `UpgradeBanner`, `Billing`, paywall)
  - Mantiene código intacto para reactivación futura sin cambios
  - Backend Stripe preservado para v2 comercial

#### Frontend
- **Páginas legales**: `/privacy` y `/terms` con contenido RGPD compliant
- **AuthModal** rediseñado: campo código beta + checkbox RGPD unificado
- **Onboarding ampliado**: consent médico Art. 9 + AlertDialog IA + banner Art. 9
- **Settings con sección "🛡️ Privacidad y datos"**:
  - Botón exportar datos (descarga JSON completo)
  - Botón eliminar cuenta con typed-word gate ("ELIMINAR" ES / "DELETE" EN)
  - Links a `/privacy` y `/terms` (target="_blank")
- **i18n RGPD**: 27 nuevas keys × 2 idiomas (ES/EN)

#### Testing
- **TypeScript bot `goaliq-test-bot`** para validación combinatoria de lógica de dietas
- **SQL queries** documentadas (cuenta principal: `test2goaliq@gmail.com`)

### Changed

- **Architecture**: api-server vía Transaction Pooler (`aws-1-eu-central-1.pooler.supabase.com:6543`)
- **RLS + FK CASCADE** habilitado en todas las tablas de usuario
- **Navegación condicional** según `VITE_BETA_MODE`
- **Privacy & Terms links** abren en nueva pestaña

### Fixed

- **Crítico**: `/api/export-data` devolvía 500 (commit `3d89802`):
  - `safeQuery` wrapper + eliminadas 2 queries obsoletas (17 → 15 tablas)
  - Verificación E2E: cuenta `test4goaliq@gmail.com` exporta JSON 30KB+ ✓
- **Bug Wouter `<Link>`**: migrado a `<a target="_blank">` (commit `68dfac3`)
- **AlertDialog asChild** + CSS var `--giq-bg-card-hover` corregidos

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

- ⚠️ `weight_entries` y `progress_logs` no migradas (impact: rompe Dashboard, ver BUG #2)

---

## [0.7.0] — 2026 (pre-mejoras)

Roadmap original 7/7 completado:
- Comidas + entrenos + lista compra + progreso + perfil
- Plan IA con Claude Haiku 4.5
- Stripe integration tested
- 3 temas: Lima Noir, Rosa Suave, Grafito Lima

---

## Known Technical Debt

Bugs y debt descubiertos. Priorizados para Mejora 10.

### 🔴 Critical (resolver próxima sesión)

#### Tablas faltantes en Supabase
- `weight_entries` y `progress_logs` — perdidas en migración M8
- Solo queda `backup_progress_logs_legacy` (59 filas)
- **Decidir**: recrear vs migrar a `profiles` / `calendar_events`

#### BUG #2 — `progress_logs` 404 rompe el Dashboard
- 2 queries del Dashboard fallan con 404
- Frontend pide tabla inexistente
- **Fix**: crear tabla O safeQuery wrapper en frontend

#### BUG #3 — `workout_plans` query con error 400
- `GET /rest/v1/workout_plans?select=day_name&week_start=eq.2026-05-31 → 400`
- Hipótesis: cálculo incorrecto de semana O columna `day_name` inexistente

#### BUG #4 — `/api/meals` endpoint no existe (404)
- Frontend llama pero api-server retorna 404
- **Investigar**: ¿se renombró? ¿código antiguo en frontend?

#### BUG #5 — `/api/workouts` endpoint no existe (404)
- Mismo origen probable que BUG #4

### 🟡 Medium

#### BUG #1 — Pace copy no se adapta al objetivo
- "Ganar músculo" muestra "déficit 1000 kcal" (copy de pérdida)
- **Fix**: switch por `goal` en `getPaceLabel(goal, pace)`
- **Tiempo**: 30-45 min

#### BUG #8 — `used_at` no se limpia al liberar código beta
- `used_by_user_id` vuelve a NULL pero `used_at` mantiene timestamp
- **Fix**: añadir `used_at = NULL` al UPDATE en endpoint DELETE

#### Warning duplicate key `"core"` en `strength.ts:67-68`

#### Cleanup pendiente FASE 10 Mejora 8
- Eliminar `heliumdb` + purgar 4 backups (135+18+59+2 filas)

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

### 🟡 Pendiente E2E

- Re-signup con código liberado
- Flujo bloqueo Art. 9 (marcar condiciones médicas)
- Cron `cleanup-blocked-accounts` simulado
- Múltiples consents (detectar BUG con 6x ai_disclosure de `test4goaliq`)

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
- **Test account principal**: `test2goaliq@gmail.com`

---

## Beta Codes

| Code | Status | Notas |
|------|--------|-------|
| `GOALIQ-BETA-001` | 🟢 Disponible | Nunca consumido |
| `GOALIQ-BETA-002` | 🔴 Usado | test4goaliq |
| `GOALIQ-BETA-003` | 🔴 Usado | UUID 2ec9aa26 |
| `GOALIQ-BETA-004` | 🔴 Usado | test8goaliq |
| `GOALIQ-BETA-005` | 🟢 Disponible | Liberado tras E2E |
| `GOALIQ-BETA-006` | 🟢 Disponible | Liberado tras E2E v0.9.1 |
| `GOALIQ-BETA-007` | 🟢 Disponible | — |
| `GOALIQ-BETA-008` | 🟢 Disponible | — |
| `GOALIQ-BETA-009` | 🟢 Disponible | — |
| `GOALIQ-BETA-010` | 🟢 Disponible | — |

---

## Versioning Strategy

- **MAJOR** (1.0.0): Lanzamiento público con Stripe activo
- **MINOR** (0.x.0): Cierre de mejora completa (M8 = 0.8.0, M9 = 0.9.0)
- **PATCH** (0.x.y): Hotfixes, bug críticos, ajustes menores

---

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
