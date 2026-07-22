Ejecuta el protocolo de inicio de día de GoalIQ. Sigue las 4 fases EN ORDEN y no toques código en ninguna de ellas.

## FASE 1 — Contexto (docs + git)
1. Lee `docs/PENDIENTES.md`, `docs/DECISIONES.md` y `docs/FLUJO_DIARIO.md`.
2. Ejecuta `git log --oneline -10` y `git status` para ver los últimos cambios reales y si quedó algo sin guardar.
3. Si los docs y los commits se contradicen, avísame antes de seguir.

## FASE 2 — Análisis rápido del código (qué hay realmente)
1. Revisa la estructura del proyecto (carpetas y archivos principales, sin leer todo).
2. Lee por encima los componentes clave que hayan cambiado en los últimos commits.
3. Resume en español llano, máximo 8 líneas: QUÉ HAY — cómo está organizada la app, qué pantallas/funciones existen y funcionan, y qué está a medias o solo especificado. Marca cualquier cosa rara que veas (código duplicado, archivos sueltos, cosas sin usar).

## FASE 3 — Arrancar el servidor y revisión visual
1. Arranca tú el servidor en segundo plano:
   `$env:PORT='5173'; $env:BASE_PATH='/'; corepack pnpm --filter @workspace/nutricoach dev`
2. Confirma que arrancó sin errores. Si falla, explica en llano qué pasó y propón la solución antes de nada más.
3. Dime: "✅ Servidor corriendo — abre http://localhost:5173" y dame una MINI GUÍA VISUAL de 3-4 puntos concretos que debo mirar hoy con mis ojos (ej. "1. Entra en Comidas y comprueba que los macros suman bien. 2. Cambia a tema oscuro en Ajustes..."). Elige los puntos según lo que cambió recientemente o lo que esté pendiente de validar.
4. Espera a que te confirme qué he visto (todo bien / algo raro).

## FASE 4 — Decidir el rumbo
Con los docs (Fase 1) + el código real (Fase 2) + lo que yo vi en pantalla (Fase 3), muéstrame:
- **HECHO**: qué está completado y verificado (máx. 5 líneas).
- **HOY**: la UNA tarea que recomiendas y por qué (2 frases).
- **BLOQUEOS**: decisiones que me tocan a mí.
Pregúntame si apruebo la tarea o quiero otra. NO empieces a implementar hasta que confirme.
