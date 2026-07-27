/**
 * FASE 0 (3ª tanda) — Nuevo enfoque SIN RECORTE: pedir a Gemini el fondo ya del
 * color de la tarjeta de /vision (#F4F4F4, muy claro), para eliminar @imgly.
 * Genera 2 platos y guarda el ORIGINAL tal cual (es lo que se servirá; no se
 * recorta nada). José juzga si el color/iluminación encaja con la tarjeta.
 *
 * Uso (Shell de Replit):
 *   cd artifacts/api-server && node dish-preview-3.mjs
 * Salida: dish-preview-output/ronda3-*  ·  Coste: 2 imágenes (~0,08 €).
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error("❌ GOOGLE_GEMINI_API_KEY ausente (ejecútalo en la Shell de Replit)."); process.exit(1); }

const MODEL = "gemini-2.5-flash-image";
const OUT_DIR = path.resolve(process.cwd(), "dish-preview-output");

// Prompt nuevo: fondo MUY CLARO (#F4F4F4) uniforme, sin recorte posterior.
function prompt(desc, isDrink) {
  const vessel = isDrink ? "in a clear glass seen from directly above, creamy frothy surface" : "served in a simple white ceramic bowl";
  return `Professional food photography, perfect top-down overhead view, ${desc}, ${vessel}, ` +
    `photorealistic, soft even studio lighting, appetizing, high detail, ` +
    `on a plain seamless very light warm grey background, background color approximately #F4F4F4, ` +
    `flat uniform background with minimal gradient and no vignette, no table, no props, no cutlery, ` +
    `no text, soft diffuse shadows only, nothing else in frame, centered, square 1:1, ultra high resolution`;
}

const DISHES = [
  { id: "ronda3-omelette", desc: "mushroom omelette with serrano ham, folded, garnished with parsley", isDrink: false },
  { id: "ronda3-salmon", desc: "baked salmon fillet with thin green asparagus spears, broccoli and lemon slices", isDrink: false },
];

async function gen(p) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: p }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  const inline = (parts.find((x) => x.inlineData ?? x.inline_data) ?? {});
  const img = inline.inlineData ?? inline.inline_data;
  if (!img?.data) throw new Error(`sin imagen: ${JSON.stringify(d).slice(0, 200)}`);
  return Buffer.from(img.data, "base64");
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`\n🍽️  Fase 0 · 3ª tanda (sin recorte, fondo #F4F4F4) → ${OUT_DIR}\n`);
for (const dish of DISHES) {
  try {
    console.log(`→ ${dish.id} …`);
    const raw = await gen(prompt(dish.desc, dish.isDrink));
    await writeFile(path.join(OUT_DIR, `${dish.id}.png`), raw);
    console.log(`   ✓ guardado (${raw.length} bytes)`);
  } catch (e) { console.log(`   ❌ ${dish.id}: ${e.message}`); }
}
console.log(`\n✅ Abre ronda3-*.png. ¿El fondo pega con la tarjeta (#F4F4F4)? ¿La iluminación deja el borde uniforme o hay degradado que habría que fundir por CSS?\n`);
