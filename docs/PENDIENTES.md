# GoalIQ — Pendientes y hoja de ruta

> Lo que está abierto, en orden. Sacar de aquí y pasar a DECISIONES.md cuando se cierre.

## En curso — Migración visual /vision (rama feature/layout-3-zonas)
- [x] Fase 1 — HOME (aprobada, con filas de suplemento compactas)
- [x] Fase 2 — COMIDAS versión inicial (barra calorías + 3 macros + bloque educativo + lista togglable)
- [x] Fase 3 — ENTRENOS (rutina + 3 stats + lista; contextual: indicadores numerados + botón "Entreno completado")
- [ ] Fase 2b — COMIDAS rediseño: plato protagonista (imagen + ingredientes + preparación + educativo + botón marcar) + franja fina única kcal/macros + carrusel horizontal scroll-snap. Las 4 fotos YA están en `D:\goaliq\design\dishes\` (recorte a PNG transparente + optimización con Sharp pendiente). Espera OK de ENTRENOS.
- [ ] Fase 4 — PROGRESO
- [ ] Fase 5 — AJUSTES
- [ ] Fase 6 — Limpieza (borrar Floor*.tsx viejos) + revisión escritorio
- [ ] Al aprobar todo: fusionar a main (= publicar en Replit)

## Después — Prioridad marcada: camino a validación
1. **Fase 3 del producto: verificación de comidas por foto** (Claude Vision, match ≥75%) — es el diferencial + lo que valida el producto.
2. **Beta con usuarios reales y precio fundador** — única fuente de verdad sobre precio y demanda.
3. Cableado de datos reales al /vision (proyecto separado, tras validar).

## Hosting (decidido el criterio, sin ejecutar)
- Seguir en Replit hasta señal de dolor real (primera factura anómala o límites). Configurar límite de gasto en el panel de Replit — tarea de 2 min, pendiente de confirmar.
- Si toca migrar: destino **Render** (plan Starter ~7 $/mes, servidor Frankfurt/UE) — precio fijo, panel simple, compatible con el stack sin cambios. Descartados: Railway (cobra por uso), Fly.io (línea de comandos), AWS directo.
- Si GoalIQ escala mucho: subir de plan DENTRO de Render primero; AWS/Google Cloud solo con cientos de miles de usuarios, y esa migración la decidirá el perfil técnico que se contrate entonces. Los cuellos de botella llegarán antes por Supabase y límites de las APIs de IA que por el hosting.
- Copia de seguridad de D:\GoalIQ-Production (assets cinematográficos, solo existen en el disco D:): disco externo o Drive/Dropbox mensual con _SELECTED y _OPTIMIZED. Tarea de José, ~20 min.

## Decisiones abiertas (no bloqueantes hoy)
- Desajuste visual intro cinematográfica (cian, oscura) ↔ app interna (beige, clara). Sin resolver.
- Lógica de SIGUIENTE en HOME: ¿primera tarea pendiente o próxima por hora? (fase datos reales)
- Dónde viven en las 5 pestañas las secciones de la app antigua: Mi comida (foto), Compra, Calendario.
- Fórmula del % de Cumplimiento para objetivo "perder grasa" (solo está definida para ganar músculo).
- Plan anual: fijar precio exacto (~99-119 €) y precio fundador de la beta.
- Mecanismo de "regenerar imagen" cuando una foto de plato salga mal.
- Microtexto legal "imagen orientativa" junto a las fotos de platos.
- App antigua (dashboard verde oscuro) — decidir su futuro cuando /vision esté completo.

## Cinemática (aparcada, no borrar)
- Escenas pendientes: KF0 mapa-inicio, apertura bosque + dash, entrada al círculo, primer brote, wormhole cian.
- Variantes de cielo (amanecer/día/atardecer/noche) en Higgsfield.
- Versiones escritorio 16:9 — SOLO tras validar toda la secuencia vertical.
