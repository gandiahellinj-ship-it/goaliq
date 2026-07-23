# GoalIQ — Instrucciones permanentes para Claude Code

Este archivo se lee AUTOMÁTICAMENTE al inicio de cada sesión. No esperes a que José lo pida.

## Regla suprema: el código manda

El código implementado manda sobre cualquier documento (incluido este). Si un
documento contradice lo que hay en el código, se corrige EL DOCUMENTO, no el
código. Antes de afirmar cómo funciona algo, verifícalo en el código.

## Protocolo de INICIO de sesión (obligatorio, sin que José lo pida)

1. Lee estos archivos en este orden:
   - `docs/PENDIENTES.md`
   - `docs/DECISIONES.md`
   - `docs/FLUJO_DIARIO.md`
   - `docs/ECONOMIA.md` (solo si la tarea del día toca precios o costes)
2. Muestra a José un resumen en 3 bloques, en español sencillo y sin jerga:
   - **HECHO**: lo último completado y verificado.
   - **HOY**: la tarea recomendada para hoy (UNA sola), con una frase de justificación.
   - **BLOQUEOS**: decisiones que solo José puede tomar antes de avanzar.
3. Espera confirmación de José antes de tocar código.

## MODO COPILOTO — Ritmo de trabajo obligatorio durante toda la sesión

José quiere que TÚ ejecutes las acciones (arrancar el servidor, instalar, editar, commit) y él solo apruebe y supervise. El ciclo es SIEMPRE este, sin excepción:

1. **Propón UNA acción concreta** en una frase, en español sencillo (qué vas a hacer y para qué).
2. **Espera su visto bueno.** Nunca ejecutes nada sin aprobación explícita.
3. **Ejecuta la acción tú mismo.** Ejemplos:
   - Arrancar el servidor: hazlo tú en segundo plano y dile la URL (http://localhost:5173) para que lo vea en su navegador. No le pidas que escriba comandos.
   - Instalar librerías, editar archivos, git: siempre lo haces tú.
4. **Al terminar, confirma el resultado** en 1-2 frases: "✅ Hecho: [qué]. Puedes verlo en [dónde]."
5. **Propón inmediatamente la SIGUIENTE acción** con una frase de justificación, y vuelve al paso 2.

Nunca dejes la conversación sin una propuesta de siguiente paso. Nunca encadenes varias acciones sin aprobación entre ellas (excepto micro-pasos inseparables de una misma acción aprobada). Si una acción falla, explica en llano qué pasó y propón la solución — no muestres errores técnicos sin traducción. Nunca pidas a José pegar claves o contraseñas en el chat: si una prueba las necesita, propón una alternativa que no las exponga.

## Protocolo de CIERRE de sesión (obligatorio)

Cuando José escriba `/cierre` o diga que termina:
1. Actualiza `docs/PENDIENTES.md` (marca lo hecho, añade lo nuevo que quedó).
2. Actualiza `docs/DECISIONES.md` si hoy se tomó alguna decisión.
3. Haz commit con mensaje descriptivo en español y push a la rama en la que se esté trabajando (nunca fusionar ramas en un /cierre; la fusión es una tarea aparte que decide José).
4. Confirma a José en una frase qué se guardó.

## Estado de las ramas y despliegue (verificado el 23/07/2026)

- **`main`** = TODO el proyecto, fusionado y EN PRODUCCIÓN
  (https://nutrition-tracker-pwa.replit.app): portada beige, interfaz
  `/vision` beige de 3 zonas (la DIRECCIÓN VISUAL DEFINITIVA, con datos de
  muestra salvo suplementos/ajustes), app antigua aún viva en /dashboard
  (se retirará en el paso 3 de la hoja de ruta), backend, y experimentos 3D
  (rutas /test-*).
- **`feature/layout-3-zonas`**: fusionada el 23/07/2026. Histórica — no
  trabajar en ella; no borrarla sin que José lo pida.
- **Despliegue REAL**: GitHub `main` → en la Shell de Replit
  `git fetch github && git reset --hard github/main` → Republish (panel
  Publishing). NUNCA `git pull` en Replit: cada publicación crea allí un
  commit vacío "Published your App" que hace chocar el siguiente pull; el
  fetch+reset lo descarta de serie (seguro, porque en Replit NO se edita
  código NUNCA y el Agente de Replit NO se usa: Replit es solo hosting).
  Su rama interna `master` es una reliquia de seguridad.

## Reglas técnicas fijas (no negociables)

- Gestor de paquetes: SIEMPRE `corepack pnpm`. NUNCA npm ni yarn.
- Si se añaden librerías nuevas: ejecutar `pnpm install` antes de probar.
- Servidor de desarrollo:
  `$env:PORT='5173'; $env:BASE_PATH='/'; corepack pnpm --filter @workspace/nutricoach dev`
- Repo: `D:\goaliq`, rama `main`. Publicar = push a GitHub + `git fetch github && git reset --hard github/main` en la Shell de Replit + Republish (ver "Estado de las ramas y despliegue").
- Dirección visual definitiva (la de `/vision`, tokens reales en `index.css` de la rama):
  fondo #F4F4F4, tarjetas #FAFAFA, acento beige cálido #BA9D79
  (`--color-brand-accent`), relleno beige claro #EFE8DC, texto #1A1A1A,
  bordes #E5E5E5, rojo #E5484D solo para acciones destructivas. Lienzo de
  escritorio #E4DFD6. Tipografías: Barlow Condensed (titulares) + Plus
  Jakarta Sans (cuerpo). El VERDE está prohibido en /vision. No inventar
  colores nuevos: los tokens del `index.css` son la fuente de verdad.
- Proveedores de IA: Claude (Anthropic) para texto y visión; Gemini SOLO para
  generar imágenes de platos (ver DECISIONES 07/07/2026).
- José no es programador: explica cada cambio en lenguaje llano antes de aplicarlo y define cualquier término técnico.
- Una tarea por sesión. No abrir frentes nuevos sin que José lo apruebe.
- Ideas aparcadas (cinemática, etc.): `docs/ARCHIVO_IDEAS.md` — no borrar, no retomar sin que José lo pida.
