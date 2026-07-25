/**
 * FASE 0 (2ª tanda) — Solo el plato DIFÍCIL, con 2 variantes de prompt para
 * resolver el recorte del borde del plato (blanco sobre blanco no se distingue).
 *
 *   A) Fondo neutro claramente distinto del plato blanco (gris cálido medio).
 *   B) Plato de cerámica crema/gris perla sobre fondo blanco.
 *
 * Genera y recorta ambas para comparar cuál da el recorte más limpio en los
 * elementos finos (espárragos, eneldo). NO toca producción.
 *
 * Uso (Shell de Replit):
 *   cd artifacts/api-server
 *   node dish-preview-2.mjs
 * Salida en dish-preview-output/ (ronda2-*).  Coste: 2 imágenes (~0,08 €).
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GOOGLE_GEMINI_API_KEY no está en el entorno. Ejecuta esto en la Shell de Replit.");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const OUT_DIR = path.resolve(process.cwd(), "dish-preview-output");

// Mismo plato difícil que la 1ª tanda (elementos finos = prueba de recorte).
const DESC = "baked salmon fillet with thin green asparagus spears, brussels sprouts and broccoli, garnished with loose fresh dill sprigs and lemon slices";

// Variante A — fondo gris cálido medio (contraste claro con el plato blanco).
const PROMPT_A =
  `Professional food photography, perfect top-down overhead view, ${DESC}, ` +
  `served in a simple white ceramic bowl, photorealistic, soft even studio lighting, ` +
  `appetizing, high detail, completely isolated on a plain seamless medium warm grey ` +
  `background clearly distinct from the white bowl, no table, no props, no cutlery, ` +
  `no text, no shadows outside the bowl, flat even lighting with no contact shadow ` +
  `beneath the bowl, nothing else in frame, centered, square 1:1, ultra high resolution`;

// Variante B — plato crema/gris perla sobre fondo blanco (contraste al revés).
const PROMPT_B =
  `Professional food photography, perfect top-down overhead view, ${DESC}, ` +
  `served in a cream and pearl-grey ceramic bowl with a clearly defined rim, ` +
  `photorealistic, soft even studio lighting, appetizing, high detail, completely ` +
  `isolated on a plain pure white background, no table, no props, no cutlery, no text, ` +
  `no shadows outside the bowl, flat even lighting with no contact shadow beneath the ` +
  `bowl, nothing else in frame, centered, square 1:1, ultra high resolution`;

const VARIANTS = [
  { id: "ronda2-A-fondo-gris", prompt: PROMPT_A },
  { id: "ronda2-B-plato-crema", prompt: PROMPT_B },
];

async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData ?? p.inline_data);
  const d = inline?.inlineData ?? inline?.inline_data;
  if (!d?.data) throw new Error(`Sin imagen. ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(d.data, "base64");
}

async function cropTransparent(rawBuffer) {
  const { removeBackground } = await import("@imgly/background-removal-node");
  const input = new Blob([rawBuffer], { type: "image/png" }); // la versión Node NO acepta data-URLs
  const blob = await removeBackground(input, { output: { format: "image/png" } });
  return Buffer.from(await blob.arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\n🍽️  Fase 0 · 2ª tanda — plato difícil, 2 variantes → ${OUT_DIR}\n`);
  for (const v of VARIANTS) {
    try {
      console.log(`→ ${v.id} …`);
      const raw = await generateImage(v.prompt);
      await writeFile(path.join(OUT_DIR, `${v.id}-original.png`), raw);
      console.log(`   ✓ original`);
      try {
        const cut = await cropTransparent(raw);
        await writeFile(path.join(OUT_DIR, `${v.id}-recortado.png`), cut);
        console.log(`   ✓ recortado`);
      } catch (e) {
        console.log(`   ⚠ recorte falló (${e.message}) — se guardó solo el original`);
      }
    } catch (e) {
      console.log(`   ❌ ${v.id}: ${e.message}`);
    }
  }
  console.log(`\n✅ Compara ronda2-A-* vs ronda2-B-*: ¿cuál conserva mejor los espárragos y el eneldo al recortar?\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
