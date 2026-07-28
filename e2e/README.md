# E2E — tests de humo (Playwright)

Recorridos de usuario que abren un navegador real contra el entorno de **STAGING**.

## Reglas (de CLAUDE.md)
- **Solo contra STAGING**, NUNCA producción. La config aborta si `E2E_BASE_URL`
  apunta al dominio de producción.
- **Prohibido** poner credenciales del Supabase de producción en `e2e/.env`.

## Puesta en marcha
1. `cp e2e/.env.example e2e/.env` y rellena con datos de **staging** (José).
2. Instala navegadores una vez: `corepack pnpm --filter @workspace/e2e run install-browsers`.
3. Ejecuta: `corepack pnpm --filter @workspace/e2e test`.

Sin `E2E_BASE_URL` configurada, los recorridos se marcan **pendientes** (skip)
y no se ejecutan — es el estado por defecto hoy (staging aún sin base de datos
de prueba lista).

## Recorridos
1. `01-registro` — registro con código beta.
2. `02-login` — login de cuenta existente.
3. `03-plan-del-dia` — ver comidas del día en /vision.
4. `04-marcar-comida` — marcar una comida como completada.
5. `05-borrar-cuenta` — borrado RGPD (bloqueado hasta arreglar el 500 del endpoint).

Los selectores son la primera aproximación; confírmalos contra staging la primera
vez que se ejecuten de verdad.
