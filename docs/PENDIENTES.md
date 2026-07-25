# GoalIQ — Pendientes y hoja de ruta

**PRÓXIMA SESIÓN:** Implementar la pipeline COMPLETA de imágenes de plato en producción (Fase 0 ya aprobada): bucket `dish-images` + tabla índice `dish_images` + función `getOrCreateDishImage` + endpoint bajo demanda + hook `useDishImage` con fade-in. Ver detalle en el punto 4 de la hoja de ruta. Empezar confirmando/creando el bucket de Storage y la tabla.

## Hoja de ruta hacia la meta (fijada por José el 23/07/2026)
1. [x] **Restilar el modal de login a beige** — HECHO Y EN PRODUCCIÓN (23/07/2026). Solo clases de color (tokens reales de index.css, clase goaliq-vision en el panel para que resuelvan), estados verificados en local por José y firma del modal confirmada en el JS publicado. Commit `334d761`.
2. [x] **Cablear /vision con datos reales** — COMPLETO Y VERIFICADO EN LOCAL (24/07/2026). Falta solo PUBLICAR (ver PRÓXIMA SESIÓN). Fases A COMIDAS (`d85ccda`), B ENTRENOS (`5bbf599`), C HOME (`868f32f`) y D PROGRESO (`5e6442c`) hechas y verificadas por José en local contra producción (proxy API_PROXY_TARGET). VisionApp ya no importa la maqueta (data.ts huérfano). ENTRENOS con ejercicios VERIFICADO en /vision el 24/07 (plan regenerado durante la prueba de estados vacíos). SIN PUBLICAR aún (decisión: publicar cuando convenga, /vision oculta).
3. [x] **Restilar el ONBOARDING a beige** — HECHO Y EN PRODUCCIÓN (25/07/2026, commit `21c06cf`). Restilado completo a la paleta /vision + token ámbar acotado para avisos de salud + iconos lucide (cero emojis) + arreglos de contraste + ritmo en 3 tarjetas. Verificado por José en producción. Pendiente menor: el overlay global "Creando tu plan…" (GenerationOverlay) sigue oscuro por ser compartido con la app antigua — se resuelve en el cambio de puerta.
   - [ ] **Rediseñar paso 5 del onboarding (modalidad de entreno)** — TAREA FUNCIONAL (requiere plan de punta a punta antes de implementar: toca perfil en Supabase, prompt de generación de la IA y usuarios YA existentes). Sustituir "¿dónde entrenas?" por: (a) "¿cómo te gusta entrenar?" con SELECCIÓN MÚLTIPLE (Pesas / Calistenia / Funcional-HIIT / Cardio + opción "Sorpréndeme"); (b) "¿qué equipamiento tienes?" (gimnasio / mancuernas-bandas / solo cuerpo). La generación con IA combina objetivo + modalidad + equipamiento, PRIORIZANDO el objetivo y explicando el porqué al usuario.
4. [~] **Generación de imágenes de platos** — EN CURSO. **Fase 0 COMPLETADA Y APROBADA (25/07/2026)**: estilo + recorte validados por José con 6 imágenes de prueba (~0,24 €). Gana el prompt de fondo GRIS CÁLIDO con plato blanco (recorte limpio de espárragos/eneldo/borde); prompt maestro actualizado en PROMPT_PLATOS.md. Decisiones cerradas: recorte con librería Node `@imgly/background-removal-node` (sin Python); generación BAJO DEMANDA al ver el plato con caché compartida; variable `GOOGLE_GEMINI_API_KEY`; prepago Google Cloud 10 € sin recarga automática = límite duro de gasto. Scripts de prueba `dish-preview*.mjs` (borrar tras implementar).
   - [ ] **PRÓXIMA: implementar la pipeline de producción** según el plan aprobado: bucket Supabase Storage `dish-images` (lectura pública) + tabla índice `dish_images` (clave/url/created_at, para medir acierto de caché) + función backend `getOrCreateDishImage(meal)` (normaliza nombre + hash → caché o genera con Gemini + recorte Node + sube + registra; construye descripcion_imagen desde `visual_ref` de los ingredientes) + endpoint bajo demanda + hook frontend `useDishImage` con fundido suave (iniciales mientras genera, sin spinner agresivo). Fallback siempre = círculo de iniciales.
5. [ ] **Cambio de puerta**: /vision pasa a ser la app raíz y la antigua (dashboard oscuro) se retira.

(Los puntos 4 y 5 de la auditoría — dependencias y limpieza — se intercalan cuando convenga; ya no están bloqueados.)

> Lo que está abierto, en orden. Sacar de aquí y pasar a DECISIONES.md cuando se cierre.

## Auditoría 22/07/2026 (informe completo: [`docs/AUDITORIA.md`](AUDITORIA.md))
- [x] Punto 1 — Endpoints de IA cerrados: sesión obligatoria + límite 3/min y 10/hora (probado en local: 401 sin sesión, paso con sesión, 429 en ráfaga; usuario temporal de prueba borrado). Commit `6f721c9`.
- [x] Punto 2 — `docs/` traído de la rama a `main` + CLAUDE.md corregido (regla "el código manda", estado de ramas, colores beige reales). Commits `a15d119` y `5626bba`.
- [x] Punto 3 — Instalación en Linux VERIFICADA Y CORREGIDA (22/07/2026): eliminados los ~80 vetos de binarios de `pnpm-workspace.yaml` (config heredada de Replit que solo permitía linux-x64), quitados los 3 parches win32 de nutricoach, fijado `packageManager` pnpm@10.33.2. Chequeo automático de GitHub Actions (`.github/workflows/linux-check.yml`) en TODAS las ramas, para siempre. Ambas ramas en verde 🟢. Commits `9ede2e6` + `1ad6756` (main), `c154c20` + `f7ca904` (rama). La fusión queda desbloqueada.
- [ ] Punto 4 — Actualizar dependencias con avisos de seguridad (8 avisos, 3 altos). Rápido. **Tras la fusión.**
- [ ] Punto 5 — Limpieza de peso muerto (paquetes sin usar, ~40 componentes UI, logos 404, motor 3D en el paquete principal, contraseña de prueba en `scripts/e2e-test.js`). Medio día. **Tras la fusión.**
- Deuda mayor (tras la beta): duplicación en el servidor y doble camino de acceso a datos (RLS). Varios días, gradual.

## Riesgos descubiertos (a revisar)
- **Auto-regeneración de plan en la app antigua (24/07/2026).** `Workouts.tsx:205` tiene un `useEffect` que regenera el plan de entrenos con IA AUTOMÁTICAMENTE al abrir la pestaña si falta el plan o si algún ejercicio no tiene `exercise_id`. Un usuario real puede gastar una llamada de IA sin pedirlo, solo con navegar. **Choca con la decisión del 07/07 (tope de regeneraciones obligatorio).** Revisar antes de la beta: ¿respeta el tope esta vía automática? Nota: `/vision` NO regenera (solo lee), así que el riesgo es exclusivo de la app antigua — se extingue con el cambio de puerta, salvo que el onboarding restilado herede el patrón.

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
- [x] **Fusionar feature/layout-3-zonas a main — HECHO Y EN PRODUCCIÓN (23/07/2026)**. Fusión limpia (4 conflictos solo en docs, resueltos a favor de main), verificada en Windows + CI Linux + checklist visual de José en producción: https://nutrition-tracker-pwa.replit.app (/vision con las 5 pestañas publicada). Migración visual COMPLETADA.

## Siguiente gran fase (tras la migración) — Bucle diario / registro real
- Especificación completa: [`docs/FLUJO_DIARIO.md`](FLUJO_DIARIO.md) (definida por José 08/07/2026; diseño del cierre del bucle DEFINITIVO desde el 24/07/2026 — §4: crédito parcial en progreso, racha estricta con "Registrar día", ventana de gracia hasta las 12:00). Registro de comidas por foto (Claude Vision), registro de ejercicios (fuerza/cardio), persistencia real en Supabase (fin de checks efímeros).

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
