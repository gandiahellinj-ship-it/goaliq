/**
 * FASE 0 — Vista previa del estilo de imágenes de plato (NO toca producción).
 *
 * Genera 4 platos de prueba con Gemini (gemini-2.5-flash-image) usando el
 * prompt maestro de docs/PROMPT_PLATOS.md, y les aplica el recorte a PNG
 * transparente con la librería Node (@imgly/background-removal-node). Guarda
 * el ORIGINAL y el RECORTADO de cada uno en ./dish-preview-output/ para que
 * José apruebe el estilo (y la calidad del recorte en el plato difícil).
 *
 * Uso (en la Shell de Replit, donde vive GEMINI_API_KEY):
 *   cd artifacts/api-server
 *   corepack pnpm install        # instala la librería de recorte
 *   node dish-preview.mjs
 * Luego abre artifacts/api-server/dish-preview-output/ en el visor de Replit.
 *
 * No usa la caché ni el Storage de producción. No crea planes. Coste: 4 imágenes
 * (~0,16 €). Borrar la carpeta de salida y este script tras aprobar el estilo.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY no está en el entorno. Ejecuta esto en la Shell de Replit.");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const OUT_DIR = path.resolve(process.cwd(), "dish-preview-output");

// ── Prompts maestros (VERBATIM de docs/PROMPT_PLATOS.md — no traducir/modificar) ──
const PROMPT_SOLIDOS = (plato) =>
  `Professional food photography, perfect top-down overhead view, ${plato}, ` +
  `served in a simple ceramic bowl, photorealistic, soft even studio lighting, ` +
  `appetizing, high detail, completely isolated on a plain pure white background, ` +
  `no table, no props, no cutlery, no text, no shadows outside the bowl, flat even ` +
  `lighting with no contact shadow beneath the bowl, nothing else in frame, ` +
  `centered, square 1:1, ultra high resolution`;

const PROMPT_BEBIDAS = (bebida) =>
  `Professional food photography, perfect top-down overhead view, ${bebida} in a ` +
  `clear glass seen from directly above, creamy frothy surface, photorealistic, ` +
  `soft even studio lighting, appetizing, high detail, completely isolated on a ` +
  `plain pure white background, no table, no props, no cutlery, no text, no shadows ` +
  `outside the glass, flat even lighting with no contact shadow beneath the glass, ` +
  `nothing else in frame, centered, square 1:1, ultra high resolution`;

// ── 4 platos de prueba: fácil · medio · DIFÍCIL (elementos finos) · bebida ──
const DISHES = [
  {
    id: "1-desayuno-facil",
    kind: "solido",
    // descripcion_imagen = ingredientes VISIBLES en inglés (regla PROMPT_PLATOS)
    desc: "Greek yogurt topped with raspberries, blueberries, chopped walnuts, rolled oats and honey",
  },
  {
    id: "2-comida-media",
    kind: "solido",
    desc: "grilled chicken breast with white rice and steamed broccoli",
  },
  {
    id: "3-cena-DIFICIL-recorte",
    kind: "solido",
    // Elementos finos a propósito: espárragos verdes + eneldo suelto → prueba de recorte
    desc: "baked salmon fillet with thin green asparagus spears, brussels sprouts and broccoli, garnished with loose fresh dill sprigs and lemon slices",
  },
  {
    id: "4-bebida-vaso",
    kind: "bebida",
    desc: "chocolate protein shake with banana",
  },
];

async function generateImage(dish) {
  const prompt = dish.kind === "bebida" ? PROMPT_BEBIDAS(dish.desc) : PROMPT_SOLIDOS(dish.desc);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": API_KEY }, // header, no query string
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  if (!resp.ok) {
    throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData ?? p.inline_data);
  const inline = img?.inlineData ?? img?.inline_data;
  if (!inline?.data) {
    throw new Error(`Sin imagen. Respuesta: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return Buffer.from(inline.data, "base64");
}

async function cropTransparent(rawBuffer) {
  // Import perezoso para que un fallo de la librería no impida ver los originales.
  const { removeBackground } = await import("@imgly/background-removal-node");
  // La versión Node NO acepta data-URLs: hay que pasar un Blob/Buffer directo.
  const input = new Blob([rawBuffer], { type: "image/png" });
  const blob = await removeBackground(input, { output: { format: "image/png" } });
  return Buffer.from(await blob.arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\n🍽️  Fase 0 — generando ${DISHES.length} platos de prueba en ${OUT_DIR}\n`);

  for (const dish of DISHES) {
    try {
      console.log(`→ ${dish.id} …`);
      const raw = await generateImage(dish);
      await writeFile(path.join(OUT_DIR, `${dish.id}-original.png`), raw);
      console.log(`   ✓ original guardado`);
      try {
        const cut = await cropTransparent(raw);
        await writeFile(path.join(OUT_DIR, `${dish.id}-recortado.png`), cut);
        console.log(`   ✓ recortado (PNG transparente) guardado`);
      } catch (cropErr) {
        console.log(`   ⚠ recorte falló (${cropErr.message}). Se guardó solo el original — revisamos el recorte aparte.`);
      }
    } catch (err) {
      console.log(`   ❌ ${dish.id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Listo. Abre la carpeta dish-preview-output/ en el visor de Replit.`);
  console.log(`   Compara cada *-original.png con su *-recortado.png (mira el plato 3, el difícil).`);
  console.log(`   Cuando apruebes el estilo, avisa a Claude Code para implementar la pipeline.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
