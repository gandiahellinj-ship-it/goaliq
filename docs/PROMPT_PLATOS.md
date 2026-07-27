# Prompt maestro — imágenes de plato (producción y mock)

> ⚠️ CAMBIO DE ENFOQUE 27/07/2026 (José): SE ELIMINA EL RECORTE. En vez de
> recortar el fondo con @imgly (que dio ENOENT en el Deployment de Replit —
> le faltaban los archivos de modelo — y era ML nativo pesado y frágil), se
> pide a Gemini que genere la imagen con el fondo YA del color de la tarjeta
> de /vision: `--color-brand-bg` = **#F4F4F4** (verificado en index.css:413).
> Así la foto se sirve tal cual, sin recorte, sin @imgly/onnxruntime/sharp, y
> la generación vuelve a ser ligera y en el servidor (~5 s). La desviación de
> color de Gemini y sus degradados de luz se toleran por CSS (fundido de
> bordes con mask-image radial) o mostrando la foto como tarjeta redondeada.
> El bloque de "fondo gris + recorte" de abajo queda OBSOLETO (histórico).

## Sólidos (VIGENTE — fondo claro #F4F4F4, sin recorte)
Professional food photography, perfect top-down overhead view,
[PLATO], served in a simple white ceramic bowl, photorealistic, soft
even studio lighting, appetizing, high detail, on a plain seamless
very light warm grey background, background color approximately #F4F4F4,
flat uniform background with minimal gradient and no vignette, no table,
no props, no cutlery, no text, soft diffuse shadows only, nothing else
in frame, centered, square 1:1, ultra high resolution

## Bebidas (VIGENTE — fondo claro #F4F4F4, sin recorte)
Igual que Sólidos pero sustituyendo el bol por: [BEBIDA] in a clear glass
seen from directly above, creamy frothy surface.

---
## (OBSOLETO desde 27/07/2026) Enfoque anterior: fondo gris + recorte @imgly

> Fondo GRIS CÁLIDO MEDIO (no blanco) — decidido en la Fase 0 (25/07/2026):
> el plato de cerámica blanca sobre fondo blanco no tenía contraste y el
> recortador Node (@imgly) se comía el borde del plato y los elementos finos
> (espárragos, eneldo). Con fondo gris distinto del plato, el recorte sale
> limpio. El fondo se elimina igualmente → la foto final queda transparente.

## Sólidos
Professional food photography, perfect top-down overhead view,
[PLATO], served in a simple white ceramic bowl, photorealistic, soft
even studio lighting, appetizing, high detail, completely
isolated on a plain seamless medium warm grey background clearly
distinct from the white bowl, no table, no props,
no cutlery, no text, no shadows outside the bowl, flat even
lighting with no contact shadow beneath the bowl, nothing else
in frame, centered, square 1:1, ultra high resolution

## Bebidas
Professional food photography, perfect top-down overhead view,
[BEBIDA] in a clear glass seen from directly above, creamy
frothy surface, photorealistic, soft even studio lighting,
appetizing, high detail, completely isolated on a plain seamless
medium warm grey background clearly distinct from the glass,
no table, no props, no cutlery, no text,
no shadows outside the glass, flat even lighting with no contact
shadow beneath the glass, nothing else in frame, centered,
square 1:1, ultra high resolution

## Reglas
- [PLATO]/[BEBIDA] = campo descripcion_imagen en inglés que
  genera el plan (ingredientes visibles + cocinado).
- El bloque de estilo nunca se traduce ni se modifica.
- El fondo es gris cálido medio (contraste para el recorte), NO blanco.
  Lo elimina el recortador Node (@imgly/background-removal-node) → PNG
  transparente. Validado en Fase 0: variante A (fondo gris) recorte limpio.
- En producción este archivo es la fuente que se copia al
  servidor. Si el prompt cambia, se cambia AQUÍ primero.
- La sombra de profundidad NO va en la imagen: la pone la app por
  CSS (drop-shadow). Las imágenes deben llegar sin sombra.
- `descripcion_imagen` se construye DESDE la lista de ingredientes
  del plato: todos los ingredientes VISIBLES en el resultado final
  deben aparecer en la descripción (ej.: yogur con nueces y avena →
  "Greek yogurt topped with raspberries, blueberries, chopped
  walnuts, rolled oats and honey"). Se omiten condimentos e
  ingredientes no visibles tras cocinar (sal, aceite, ajo disuelto).
- Clave de caché en producción: nombre normalizado + hash de los
  ingredientes visibles. Recetas distintas con el mismo nombre →
  fotos distintas; misma receta → foto compartida.
