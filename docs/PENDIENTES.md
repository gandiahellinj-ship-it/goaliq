# GoalIQ — Pendientes y hoja de ruta

**PRÓXIMA SESIÓN:** Punto 3 de la auditoría — verificar que el repositorio instala limpio en Linux (la configuración de pnpm está clavada a Windows y Replit es Linux). Es el requisito previo para poder fusionar `feature/layout-3-zonas` a `main`.

> Lo que está abierto, en orden. Sacar de aquí y pasar a DECISIONES.md cuando se cierre.

## Auditoría 22/07/2026 (informe completo: [`docs/AUDITORIA.md`](AUDITORIA.md))
- [x] Punto 1 — Endpoints de IA cerrados: sesión obligatoria + límite 3/min y 10/hora (probado en local: 401 sin sesión, paso con sesión, 429 en ráfaga; usuario temporal de prueba borrado). Commit `6f721c9`.
- [x] Punto 2 — `docs/` traído de la rama a `main` + CLAUDE.md corregido (regla "el código manda", estado de ramas, colores beige reales). Commits `a15d119` y `5626bba`.
- [ ] Punto 3 — Verificar instalación en Linux (requisito de la fusión). ← PRÓXIMA SESIÓN
- [ ] Punto 4 — Actualizar dependencias con avisos de seguridad (8 avisos, 3 altos). Rápido.
- [ ] Punto 5 — Limpieza de peso muerto (paquetes sin usar, ~40 componentes UI, logos 404, motor 3D en el paquete principal, contraseña de prueba en `scripts/e2e-test.js`). Medio día.
- Deuda mayor (tras la beta): duplicación en el servidor y doble camino de acceso a datos (RLS). Varios días, gradual.

## En curso — Migración visual /vision (rama feature/layout-3-zonas)
- [x] Fase 1 — HOME (aprobada, con filas de suplemento compactas)
- [x] Fase 2 — COMIDAS versión inicial (barra calorías + 3 macros + bloque educativo + lista togglable)
- [x] Fase 3 — ENTRENOS (rutina + 3 stats + lista; contextual: indicadores numerados + botón "Entreno completado")
- [x] Fase 2b — COMIDAS rediseño: plato protagonista (imagen + ingredientes + preparación + educativo + botón marcar) + franja fina única kcal/macros + carrusel horizontal scroll-snap. 4 fotos recortadas con rembg (sin sombra) + optimizadas → `public/images/dishes/`. Verificado a 390×844 con el caso peor (Cena 8 ingr + 4 pasos), sin scroll.
- [x] Fase 3b — ENTRENOS rediseño: ejercicio protagonista (clip + series×reps + tip + botón) + franja fina + carrusel horizontal (mismo patrón que 2b). Clips = placeholder animado (sin assets reales aún). Verificado a 390×844 sin scroll.
- [x] Fase 4 — PROGRESO (gráfica peso + meta + 4 métricas; contextual: distancia a meta + variación semanal)
- [x] Fase 5 — AJUSTES (perfil/idioma/tema/enlaces/logout REALES reestilados, logout rojo tokenizado; contextual: versión + privacidad)
- [x] Fase 4b v2 — PROGRESO «paisaje muscular» DEFINITIVO: tarjeta blanca + selector de chips + selección resalta montaña y actualiza la contextual con análisis por subgrupos (barras + consejo del entrenador). Verificado Piernas (4 subgrupos) y Hombros (consejo largo) sin scroll. Sin verde, sin tarjeta oscura.
- [x] Fix — páginas legales (Privacidad/Términos) legibles en tema claro y oscuro (prose mapeado al tema)
- [x] Fase 6 — Limpieza: borrados los 5 `Floor*.tsx` sin uso (tsc + build de producción OK); revisión escritorio: en ≥640px la app se muestra como columna centrada con marco redondeado + sombra sobre lienzo neutro (#E4DFD6); móvil sin cambios.
- [ ] **Fusionar feature/layout-3-zonas a main** (= publicar en Replit), PREVIA verificación del problema Windows/Linux detectado en el punto 3 de la auditoría del 22/07/2026 (`docs/AUDITORIA.md`): la configuración de pnpm anula los binarios de Linux y la instalación en Replit puede fallar. Probar instalación limpia en entorno Linux antes de fusionar.

## Siguiente gran fase (tras la migración) — Bucle diario / registro real
- Especificación completa: [`docs/FLUJO_DIARIO.md`](FLUJO_DIARIO.md) (definida por José 08/07/2026). Registro de comidas por foto (Claude Vision), registro de ejercicios (fuerza/cardio), "Registrar día" (cierre del bucle), persistencia real en Supabase (fin de checks efímeros). **No empezar hasta cerrar la Fase 6 de la migración.** Incluye una decisión de producto abierta: "Registrar día" estricto puro vs. con crédito parcial (%).

## Después — Prioridad marcada: camino a validación
1. **Fase 3 del producto: verificación de comidas por foto** (Claude Vision, match ≥75%) — es el diferencial + lo que valida el producto.
2. **Beta con usuarios reales y precio fundador** — única fuente de verdad sobre precio y demanda.
3. Cableado de datos reales al /vision (proyecto separado, tras validar).

## Hosting (decidido el criterio, sin ejecutar)
- Seguir en Replit hasta señal de dolor real (primera factura anómala o límites). Configurar límite de gasto en el panel de Replit — tarea de 2 min, pendiente de confirmar.
- Si toca migrar: destino **Render** (plan Starter ~7 $/mes, servidor Frankfurt/UE) — precio fijo, panel simple, compatible con el stack sin cambios. Descartados: Railway (cobra por uso), Fly.io (línea de comandos), AWS directo.
- Si GoalIQ escala mucho: subir de plan DENTRO de Render primero; AWS/Google Cloud solo con cientos de miles de usuarios, y esa migración la decidirá el perfil técnico que se contrate entonces. Los cuellos de botella llegarán antes por Supabase y límites de las APIs de IA que por el hosting.

## Decisiones abiertas (no bloqueantes hoy)
- Fuente definitiva de clips de ejercicios sin decidir — opciones: pack con licencia comercial, wger CC-BY-SA (exige atribución), ExerciseDB (revisar licencia). Decidir antes de la fase de datos reales.
- Lógica de SIGUIENTE en HOME: ¿primera tarea pendiente o próxima por hora? (fase datos reales)
- Dónde viven en las 5 pestañas las secciones de la app antigua: Mi comida (foto), Compra, Calendario.
- Fórmula del % de Cumplimiento para objetivo "perder grasa" (solo está definida para ganar músculo).
- Plan anual: fijar precio exacto (~99-119 €) y precio fundador de la beta.
- Mecanismo de "regenerar imagen" cuando una foto de plato salga mal.
- Microtexto legal "imagen orientativa" junto a las fotos de platos.
- App antigua (dashboard verde oscuro) — decidir su futuro cuando /vision esté completo.

## Cinemática
- Todo lo cinematográfico (escenas, assets, desajuste visual intro↔app, copia de seguridad) se movió a [`docs/ARCHIVO_IDEAS.md`](ARCHIVO_IDEAS.md) el 22/07/2026. Aparcado, no borrado.
