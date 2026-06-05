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
- Landing Page producción con stack creativo (Nano Banana + Kling 3.0 + GSAP)
- Restaurar tablas faltantes: `weight_entries` y `progress_logs` (perdidas en migración M8)

---

## [0.9.0] — 2026-06-05

### 🛡️ Mejora 9: Cumplimiento RGPD + Auditoría de Seguridad

Release que cierra la fase de compliance previa al lanzamiento de beta privada. GoalIQ ahora cumple con los derechos del RGPD (Art. 9, 15, 17, 20) para gestión de datos de salud, y oculta la capa de monetización Stripe mediante feature flag.

### Added

#### Backend
- **6 endpoints RGPD** en `artifacts/api-server/src/routes/gdpr.ts`:
  - `POST /api/validate-health-screening` — validación de cuestionario médico (Art. 9)
  - `GET /api/export-data` — exportación completa de datos del usuario (Art. 20)
  - `DELETE /api/delete-account` — eliminación de cuenta con doble confirmación (Art. 17)
  - `GET /api/consents-history` — historial de consentimientos otorgados
  - `POST /api/consent` — registro de nuevo consentimiento
  - `GET /api/health-validation-logs` — auditoría de validaciones médicas
- **Edge Functions Supabase**:
  - `validate-health-screening` (commit `a65ddb3`) — validación server-side cuestionario salud
  - `cleanup-blocked-accounts` con cron diario a las 3 AM — hard delete tras 90 días + notificación Resend
- **Tablas RGPD en Supabase**:
  - `consents_history` — registro auditable de consentimientos
  - `deletion_logs` (11 columnas) — auditoría de eliminaciones GDPR
  - `health_validation_logs` — auditoría de validaciones médicas
  - `health_screenings` — datos sensibles Art. 9 con RLS estricto
  - `beta_codes` — gestión códigos invitación beta privada
- **Feature flag `VITE_BETA_MODE`** (default: `true`):
  - Oculta toda la UI de Stripe (`TrialGate`, `UpgradeBanner`, `Billing`, paywall)
  - Mantiene código intacto para reactivación futura sin cambios
  - Backend Stripe preservado para v2 comercial

#### Frontend
- **Páginas legales**: `/privacy` y `/terms` con contenido RGPD compliant
- **AuthModal** rediseñado:
  - Campo código beta obligatorio en signup
  - 2 checkboxes de consentimiento (términos + política privacidad)
  - Validación bidireccional ES/EN
- **Onboarding ampliado**:
  - Consentimiento médico explícito (Art. 9 RGPD)
  - AlertDialog informando sobre uso de IA en planificación
  - Banner Art. 9 sobre tratamiento de datos sensibles
- **Settings con sección "🛡️ Privacidad y datos"**:
  - Botón exportar datos (descarga JSON completo)
  - Botón eliminar cuenta con typed-word gate ("ELIMINAR" ES / "DELETE" EN)
  - Links a `/privacy` y `/terms` (target="_blank")
  - Doble confirmación AlertDialog para borrado
- **i18n RGPD**: 27 nuevas keys × 2 idiomas (ES/EN) en `language.tsx`

#### Testing & Development
- **TypeScript bot `goaliq-test-bot`** para validación combinatoria de lógica de dietas:
  - Modos pairwise y edge-case
  - Cleanup automático en Supabase
  - Reporting HTML/JSON
- **SQL queries** documentadas para testing:
  - Reset cuenta de prueba (preserva `auth.users`)
  - Verificación estado de cuenta
  - Cuenta principal: `test2goaliq@gmail.com`

### Changed

- **Architecture**: api-server conecta a Supabase vía Transaction Pooler
  - Host: `aws-1-eu-central-1.pooler.supabase.com:6543`
  - User: `postgres.bftggzsbovbjulbzyldj`
  - `sslmode=no-verify` (desarrollo)
- **RLS + FK CASCADE** habilitado en todas las tablas de usuario
- **Navegación condicional** según `VITE_BETA_MODE`:
  - `AppLayout.tsx`: `isLocked = item.gated && !hasAccess && !isBetaMode()`
  - `Profile.tsx`: badge PRO/FREE oculto en beta
  - `UserProfile.tsx`: back-arrow href condicional (`/profile` vs `/billing`)
  - `Dashboard.tsx`: `TrialStatusCard` y `Smart Coaching Insights` ocultos
- **Privacy & Terms links** ahora abren en nueva pestaña (`target="_blank"`)

### Fixed

- **Crítico**: `/api/export-data` devolvía 500 para todos los usuarios
  - **Causa**: 2 tablas referenciadas en query no existen en Supabase (`weight_entries`, `progress_logs`)
  - **Solución 3 capas** (commit `3d89802`):
    - `safeQuery` wrapper que retorna `{rows:[]}` ante error `[42P01]`
    - Eliminadas 2 queries obsoletas (17 → 15 tablas)
    - Comentario explicativo añadido
  - **Verificación E2E**: cuenta `test4goaliq@gmail.com` (id `2ec9aa26-...`) exporta JSON 30KB+ con 15 keys correctas
- **Bug Wouter `<Link>`**: dejaba `<a>` interno conflictivo en Settings → migrado a `<a target="_blank">` puro (commit `68dfac3`)
- **AlertDialog asChild**: añadido en `AlertDialogDescription` para evitar warning React
- **CSS var**: `--giq-bg-card-hover` corregido (era `--giq-bg-page` incorrecto)

### Security

- **RLS estricto** en tablas con datos sensibles (`health_screenings`, `meal_plans`, `workout_plans`)
- **FK CASCADE** garantiza limpieza al borrar cuenta
- **`deletion_logs`** registra auditablemente cada eliminación (no se borra con la cuenta)
- **JWT Bearer** auth en todos los endpoints RGPD
- **Body validation**: delete-account requiere body `{confirmation:"DELETE_MY_ACCOUNT"}` literal

### Deprecated

- `heliumdb` (rollback de Mejora 8) — pendiente de eliminación en cleanup FASE 10
- Backups Supabase: `backup_progress_logs_legacy` (59 filas) + otros 3 backups (135+18+2 filas) pendientes de purga

---

## [0.8.0] — 2026-05-27

### 🚀 Mejora 8: Migración heliumdb → Supabase

Release que migra la persistencia de datos desde heliumdb (in-memory) a Supabase Postgres, habilitando escalabilidad real y multi-device.

### Added

- **Supabase como BBDD principal**:
  - Connection vía Transaction Pooler EU Central 1
  - 25 tablas en schema `public`
  - 1.245 filas migradas con éxito
- **Sistema de versionado de planes**:
  - `meal_plan_versions` — histórico de planes nutricionales
  - `workout_plan_versions` — histórico de planes entrenamiento
  - `profile_change_events` — auditoría de cambios de perfil
- **Edge Functions setup base** preparado para Mejora 9
- **Calendario integrado**: `calendar_events` (7 días) + `flex_days`
- **Workout tracking**: `workout_history` + `strength_logs`

### Changed

- `db.ts` ahora usa cliente `pg` con pooler de Supabase
- `api-server` migrado completamente, heliumdb queda como fallback solo en desarrollo
- M7 (Plan IA con Claude Haiku 4.5) verificado funcionando en producción

### Fixed

- Inconsistencias de tipos entre heliumdb y Postgres resueltas
- Foreign keys configuradas con `ON DELETE CASCADE`

### Deprecated

- heliumdb dejará de usarse en cleanup FASE 10 (~2 días post-release)

### Known Issues

- ⚠️ Tablas `weight_entries` y `progress_logs` no migradas (existían solo en schema Drizzle huérfano)
  - Solo `backup_progress_logs_legacy` queda como evidencia
  - **Impact**: endpoint `/api/export-data` rompía hasta hotfix en v0.9.0
  - **Pendiente**: decidir si recrear tablas o migrar datos a `profiles` / `calendar_events`

---

## [0.7.0] — 2026 (pre-mejoras)

### 🎯 Roadmap original completado (7 milestones)

Estado funcional base de GoalIQ antes de iniciar fase de compliance y migración.

### Features

- **Comidas**: planificación semanal con 5 momentos del día
- **Entrenos**: planes adaptados por objetivo (volumen, definición, mantenimiento)
- **Lista de la compra**: generación automática desde plan de comidas
- **Progreso**: tracking de peso + medidas + macros
- **Perfil**: gestión de objetivos, alergias, preferencias alimentarias
- **Plan IA con Claude Haiku 4.5**: generación completa de plan 7 días
- **Stripe integration**: tested con cards de prueba estándar
- **Sistema de temas**: Lima Noir, Rosa Suave, Grafito Lima (tokens CSS variables)

---

## Known Technical Debt

### 🔴 Critical (resolver en próxima sesión)

1. **Tablas faltantes en Supabase**:
   - `weight_entries` — definida en schema Drizzle pero nunca materializada
   - `progress_logs` — definida en `supabase-schema.sql` pero perdida en migración M8
   - **Impact**: endpoint `/progress` podría fallar silenciosamente
   - **Verificación pendiente**: comprobar runtime de `/progress` y decidir estrategia (recrear vs migrar a existentes)

2. **TypeScript errors preexistentes** en:
   - `ExerciseAnimation.tsx`
   - `GenerationOverlay.tsx`
   - `Meals.tsx`
   - `ShareWorkoutCard.tsx`
   - `stripe.ts`
   - `aiGenerators.ts`
   - `workoutx-cache.ts`

### 🟡 Medium

3. **Warning**: Duplicate key `"core"` en `strength.ts:67-68`
4. **Cleanup pendiente FASE 10 Mejora 8**:
   - Eliminar `heliumdb` activo
   - Purgar backups Supabase: 135+18+59+2 filas obsoletas

### 🟢 Low

5. Smart Coaching Insights queda oculto (no acabado) — reactivar con `VITE_BETA_MODE=false`

---

## Architecture Reference

### Backend
- **Server**: Express en puerto 8080
- **DB**: Supabase Postgres vía Transaction Pooler
- **AI**: Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Email**: Resend (notificaciones cleanup-blocked-accounts)
- **Auth**: Supabase Auth con JWT Bearer
- **Payments**: Stripe (preservado pero oculto vía `VITE_BETA_MODE`)

### Frontend
- **Framework**: Vite + React + TypeScript
- **Routing**: Wouter
- **State**: React Query (cachea `useSubscription`)
- **Styling**: CSS variables + design tokens
- **PWA**: Service Worker + manifest configurado

### Themes (sistema aprobado)
- **Lima Noir**: `#000` + `#AAFF45`
- **Rosa Suave**: `#1a1416` + `#FF9DB8`
- **Grafito Lima**: `#2e3133` + `#9AEE35`

### Animation Philosophy
"Alive, not ambient" — reactive over decorative:
- Staggered reveals on load
- One-time scan-line on hero panels
- Animated progress rings
- Microinteractions on hover/tap only

### Workflow
- **Dev local**: Claude Code en `C:\Users\Usuario\goaliq`
- **Dev cloud**: Replit (sincronizado vía GitHub API, NO `git pull`/`git stash`)
- **Repo**: `gandiahellinj-ship-it/goaliq`
- **Test account principal**: `test2goaliq@gmail.com`

---

## Beta Codes

| Code | Status | Assigned to |
|------|--------|-------------|
| `GOALIQ-BETA-001` | ✅ Used | `test1goaliq` |
| `GOALIQ-BETA-002` | ✅ Used | `test4goaliq` |
| `GOALIQ-BETA-003` | ✅ Used | `test7goaliq` |
| `GOALIQ-BETA-004` | ✅ Used | `test8goaliq` |
| `GOALIQ-BETA-005` | 🟢 Available | — |
| `GOALIQ-BETA-006` | 🟢 Available | — |
| `GOALIQ-BETA-007` | 🟢 Available | — |
| `GOALIQ-BETA-008` | 🟢 Available | — |
| `GOALIQ-BETA-009` | 🟢 Available | — |
| `GOALIQ-BETA-010` | 🟢 Available | — |

---

## Versioning Strategy

- **MAJOR** (1.0.0): Lanzamiento público con Stripe activo
- **MINOR** (0.x.0): Cierre de mejora completa (M8 = 0.8.0, M9 = 0.9.0...)
- **PATCH** (0.x.y): Hotfixes, bug críticos, ajustes menores

---

[Unreleased]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/gandiahellinj-ship-it/goaliq/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/gandiahellinj-ship-it/goaliq/releases/tag/v0.7.0
