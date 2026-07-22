# GoalIQ — Instrucciones permanentes para Claude Code

Este archivo se lee AUTOMÁTICAMENTE al inicio de cada sesión. No esperes a que José lo pida.

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

Nunca dejes la conversación sin una propuesta de siguiente paso. Nunca encadenes varias acciones sin aprobación entre ellas (excepto micro-pasos inseparables de una misma acción aprobada). Si una acción falla, explica en llano qué pasó y propón la solución — no muestres errores técnicos sin traducción.

## Protocolo de CIERRE de sesión (obligatorio)

Cuando José escriba `/cierre` o diga que termina:
1. Actualiza `docs/PENDIENTES.md` (marca lo hecho, añade lo nuevo que quedó).
2. Actualiza `docs/DECISIONES.md` si hoy se tomó alguna decisión.
3. Haz commit con mensaje descriptivo en español y push a `main`.
4. Confirma a José en una frase qué se guardó.

## Reglas técnicas fijas (no negociables)

- Gestor de paquetes: SIEMPRE `corepack pnpm`. NUNCA npm ni yarn.
- Si se añaden librerías nuevas: ejecutar `pnpm install` antes de probar.
- Servidor de desarrollo:
  `$env:PORT='5173'; $env:BASE_PATH='/'; corepack pnpm --filter @workspace/nutricoach dev`
- Repo: `D:\goaliq`, rama `main`, sincroniza con Replit vía GitHub (no git pull directo en Replit).
- Colores de marca: cian #50F0E4 (reposo) / #0AF7EE (energizado). Naranja #FF7A2F solo Entrenos. Verde ELIMINADO.
- UI actual real: navegación vertical por "pisos", paleta beige/dorado. El layout BALANZ 65/5/30 NO está implementado todavía.
- José no es programador: explica cada cambio en lenguaje llano antes de aplicarlo y define cualquier término técnico.
- Una tarea por sesión. No abrir frentes nuevos sin que José lo apruebe.
