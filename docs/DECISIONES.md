# GoalIQ — Decisiones cerradas

> Fuente de verdad del proyecto. Una decisión no está tomada hasta que está aquí.
> Regla de mantenimiento: al cerrar cada fase o decisión, añadir UNA línea con fecha.
> Claude Code: lee este archivo al inicio de cada sesión y actualízalo al cerrar trabajo.

## Identidad y diseño (interfaz /vision)
- **2026-07-05** — Dirección visual de la app interna: paleta beige/dorada sobre fondo crema (la identidad cian queda para la intro cinematográfica; el desajuste intro↔app sigue abierto, ver PENDIENTES).
- **2026-07-05** — Layout: viewport fijo de 3 zonas (65% contenido / nav 5 botones circulares / ~26% panel contextual). Sin scroll vertical en ninguna zona. Sustituye a los "5 pisos" con flechas.
- **2026-07-06** — Tipografía: Barlow Condensed (titulares) + Plus Jakarta Sans (cuerpo). No añadir fuentes nuevas.
- **2026-07-06** — Tokens de color: los valores existentes en `index.css` son la fuente de verdad (#F4F4F4, #FAFAFA, #BA9D79, #888888, #E5E5E5, #1A1A1A). Añadidos: `--color-brand-accent-soft` #EFE8DC y `--color-brand-red` #E5484D. Renombrado `--color-brand-cyan` → `--color-brand-accent` (sin cambio de valor).
- **2026-07-06** — HOME: itinerario del día tipo checklist con línea de progreso; filas de SUPLEMENTO compactas (media altura, una línea). Zona contextual: SIGUIENTE tarea + contador.
- **2026-07-07** — COMIDAS (rediseño aprobado sobre la Fase 2): zona superior = plato seleccionado protagonista (imagen + ingredientes + preparación + bloque educativo + botón marcar); franja fina única de kcal+macros. Zona inferior = carrusel horizontal de platos, seleccionado más grande, sincronizado con la zona superior.
- **2026-07-07** — Estilo estándar de imagen de plato: fotografía cenital fotorrealista, luz de estudio suave, generada sobre fondo blanco puro, 1:1, recortada a PNG transparente por código. Miniaturas del mismo estilo en el carrusel.
- **2026-07-07** — Prompt maestro de imágenes de plato fijado en [`docs/PROMPT_PLATOS.md`](PROMPT_PLATOS.md): fuente de verdad. En producción se copia al servidor; cualquier cambio del prompt se hace AHÍ primero.
- **2026-07-07** — Regla de bebidas: para bebidas se sustituye la frase del bol por el recipiente propio (vaso), según la variante «Bebidas» del prompt maestro.
- **2026-07-07** — El plan genera por plato un campo `descripcion_imagen` en inglés (ingredientes visibles + cocinado) que rellena `[PLATO]`/`[BEBIDA]`; el nombre en español es para la UI y clave de caché.
- **2026-07-08** — Recorte de imágenes de plato con **rembg** (segmentación IA), no flood-fill por color: elimina también la sombra de contacto que el generador pinta bajo el bol. La sombra de profundidad la pone la app por CSS (`drop-shadow`); las imágenes llegan sin sombra. El prompt maestro lo refuerza («flat even lighting with no contact shadow»).

## Producto y datos
- **2026-07-06** — Migración visual y cableado de datos son proyectos SEPARADOS. La migración usa datos mock (src/data.ts); solo suplementos y ajustes son reales.
- **2026-07-06** — Chips de HOME (fase de datos reales): Cumplimiento hoy % + Proteína hoy (g) + Volumen semanal (series). Se eliminan Movimiento/Pasos/Agua (inviables en PWA). Fórmula inicial del % (objetivo ganar músculo): proteína 40 / entreno 30 / comidas 20 / suplementos 10 — a calibrar.
- **2026-07-07** — Imágenes de platos en producción: se generan con IA tras crear el plan, en segundo plano (nunca bloquean la generación), con caché por nombre de plato NORMALIZADO en Supabase Storage, compartida entre usuarios. Fallback: círculo con iniciales.
- **2026-07-07** — Proveedores de IA: Claude (Anthropic) en exclusiva para texto y visión. EXCEPCIÓN única: generación de imágenes con Gemini 2.5 Flash Image / Nano Banana (~$0,039/imagen), porque la API de Anthropic no genera imágenes. NO usar Imagen 4 (se apaga el 17/08/2026).
- **2026-06 (heredadas, vigentes)** — Lenguaje legal "orientativo", nunca "personalizado" ni promesas de resultados. Comidas del plan = ingredientes + preparación generados por Claude Haiku en el onboarding (paso 7/7 → /api/consent → /api/plan/generate).

## Precio y negocio
- **2026-07-07** — Precio mensual: 19,90 €/mes (techo del mercado; no subir). Añadir plan anual ~99-119 €/año como ancla de compra. Precio fundador para la beta (p. ej. 9,90 €/mes o anual 79 € primeros 100).
- **2026-07-07** — Tope de regeneraciones de plan por usuario obligatorio (evita coste de IA descontrolado). Regeneraciones no urgentes → Batch API (50% dto., hasta 24 h).

## Flujo de trabajo
- **2026-07-06** — Pauta permanente con Claude Code: commit + push a origin al cerrar CADA fase. Nunca acumular trabajo sin subir.
- **2026-07-06** — Trabajar siempre en rama (actual: feature/layout-3-zonas). No fusionar a main hasta que las 5 pestañas estén aprobadas. Main = lo que Replit publica.
