/**
 * DISH DOCTOR — diagnóstico por etapas de la pipeline de imágenes de plato.
 * Herramienta PERMANENTE. Prueba cada pieza AISLADA y dice cuál falla, con el
 * motivo. Se ejecuta con las mismas credenciales que usa el servidor (Secrets
 * compartidos entre workspace y deployment).
 *
 * Uso (Shell de Replit):
 *   cd artifacts/api-server
 *   node dish-doctor.mjs
 *
 * Etapas: (a) Gemini genera 1 imagen · (b) @imgly carga y recorta un PNG ·
 * (c) subir+borrar un archivo dummy en el bucket con service_role ·
 * (d) INSERT+SELECT+DELETE en dish_images (revela esquema incompatible).
 * Coste: 1 imagen de Gemini (~0,036 €). No deja basura (borra lo que crea).
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "dish-images";
const GEMINI_MODEL = "gemini-2.5-flash-image";
const results = [];
function ok(stage, detail = "") { results.push({ stage, ok: true, detail }); console.log(`✅ ${stage} ${detail}`); }
function ko(stage, err) { results.push({ stage, ok: false, detail: String(err?.message ?? err) }); console.log(`❌ ${stage}: ${err?.message ?? err}`); }

console.log("\n🩺 DISH DOCTOR — diagnóstico por etapas\n");

// Presencia de variables (sí/no, nunca el valor)
const env = {
  GOOGLE_GEMINI_API_KEY: Boolean(process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
  DATABASE_URL: Boolean(process.env.DATABASE_URL),
};
console.log("Variables presentes:", env, "\n");

// ── (a) Gemini: generar 1 imagen ─────────────────────────────────────────────
let rawPng = null;
try {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY ausente");
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "a single red apple, top-down, plain grey background, square 1:1" }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = (parts.find((p) => p.inlineData ?? p.inline_data) ?? {});
  const d = inline.inlineData ?? inline.inline_data;
  if (!d?.data) throw new Error(`sin imagen (¿facturación de Gemini activa?): ${JSON.stringify(data).slice(0, 200)}`);
  rawPng = Buffer.from(d.data, "base64");
  ok("(a) Gemini genera imagen", `(${rawPng.length} bytes)`);
} catch (e) { ko("(a) Gemini genera imagen", e); }

// ── (b) @imgly: cargar y recortar un PNG 10×10 ───────────────────────────────
try {
  const testPng = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } }).png().toBuffer();
  const { removeBackground } = await import("@imgly/background-removal-node");
  const cut = await removeBackground(new Blob([new Uint8Array(testPng)], { type: "image/png" }), { output: { format: "image/png" } });
  const out = Buffer.from(await cut.arrayBuffer());
  if (!out.length) throw new Error("recorte vacío");
  ok("(b) @imgly carga y recorta", `(${out.length} bytes)`);
} catch (e) { ko("(b) @imgly carga y recorta", e); }

// ── (c) Storage: subir + borrar dummy con service_role ───────────────────────
try {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const path = "_doctor-test.png";
  const dummy = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, dummy, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  await sb.storage.from(BUCKET).remove([path]);
  ok("(c) Storage subir+borrar (service_role)");
} catch (e) { ko("(c) Storage subir+borrar (service_role)", e); }

// ── (d) BD: INSERT + SELECT + DELETE en dish_images ──────────────────────────
try {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const k = "_doctor--test";
  await pool.query(
    `INSERT INTO public.dish_images (cache_key, url, meal_name, status, cost_eur, updated_at)
     VALUES ($1,$2,$3,'ready',$4,now())
     ON CONFLICT (cache_key) DO UPDATE SET url=$2, updated_at=now()`,
    [k, "https://example/x.png", "doctor test", 0],
  );
  const { rows } = await pool.query("SELECT cache_key, status, fail_count, cost_eur FROM public.dish_images WHERE cache_key=$1", [k]);
  await pool.query("DELETE FROM public.dish_images WHERE cache_key=$1", [k]);
  await pool.end();
  if (!rows.length) throw new Error("no se pudo releer la fila insertada");
  ok("(d) BD insert/select/delete", `(columnas OK: ${Object.keys(rows[0]).join(", ")})`);
} catch (e) { ko("(d) BD insert/select/delete", e); }

// ── Veredicto ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? "✅ TODAS LAS ETAPAS OK" : `❌ FALLAN ${failed.length}: ${failed.map((f) => f.stage).join(", ")}`}\n`);
process.exit(failed.length === 0 ? 0 : 1);
