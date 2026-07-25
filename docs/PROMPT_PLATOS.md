# Prompt maestro — imágenes de plato (producción y mock)

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
