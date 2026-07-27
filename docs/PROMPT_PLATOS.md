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

## Sólidos (VIGENTE — sin recorte, se muestra como TARJETA)
Professional food photography, perfect top-down overhead view,
[PLATO], served on a simple white plate, photorealistic, soft even
studio lighting, appetizing, high detail, neutral light studio
background, no table, no props, no cutlery, no text, nothing else in
frame, centered, square 1:1, ultra high resolution

## Bebidas (VIGENTE — sin recorte)
Igual que Sólidos pero sustituyendo el plato por: [BEBIDA] in a clear glass
seen from directly above, creamy frothy surface.

## Aprendido en la Fase 0 (por qué el prompt es así)
- **Recipiente FIJO = plato llano blanco.** Gemini devolvía plato llano aunque
  se le pidiera bol; se fija plato para consistencia.
- **NO perseguir un hex de fondo exacto ni «no vignette».** Gemini ignora
  ambos: devuelve un fondo beige verdoso (~#DDDCD5) con viñeteado en las
  esquinas. Por eso la foto se muestra como TARJETA (esquinas redondeadas,
  foto a sangre), donde el viñeteado se lee como luz de estudio y el color
  de fondo deja de importar. El diseño NO debe depender del color exacto.

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
