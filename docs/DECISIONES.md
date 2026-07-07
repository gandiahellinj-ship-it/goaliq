# Decisiones

Registro de decisiones cerradas del proyecto GoalIQ. Se lee al inicio de cada
sesión y se actualiza al cerrar trabajo.

## 2026-07-07

- **Prompt maestro de imágenes de plato** fijado en [`docs/PROMPT_PLATOS.md`](PROMPT_PLATOS.md).
  Es la fuente de verdad; en producción se copia al servidor y cualquier cambio
  del prompt se hace primero AHÍ.
- **Regla de bebidas**: para bebidas se sustituye la frase del bol por el
  recipiente propio (vaso), según la variante "Bebidas" del prompt maestro.
- **Campo `descripcion_imagen`**: el plan generará, por plato, un campo
  `descripcion_imagen` en **inglés** (ingredientes visibles + cocinado) que
  rellena `[PLATO]`/`[BEBIDA]`. El **nombre en español** es para la UI y sirve
  como **clave de caché** de la imagen.
- **Migración de layout `/vision` a 3 zonas** (rama `feature/layout-3-zonas`):
  viewport fijo 3 zonas sin scroll vertical, 5 tabs circulares. Solo layout;
  datos mock salvo suplementos (reales) y ajustes. Fuentes actuales conservadas
  (Barlow Condensed + Plus Jakarta Sans). Tokens: valores sin cambiar; añadidos
  `--color-brand-accent-soft` (#EFE8DC) y `--color-brand-red` (#E5484D);
  `--color-brand-cyan` renombrado a `--color-brand-accent` (sin cambio de valor).
