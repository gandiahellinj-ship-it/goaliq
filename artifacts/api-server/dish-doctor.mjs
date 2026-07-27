/**
 * DISH DOCTOR — diagnóstico por etapas de la pipeline de imágenes de plato.
 * Herramienta PERMANENTE. Prueba cada pieza AISLADA y dice cuál falla, con el
 * motivo.
 *
 * ⚠️ IMPORTANTE: este script habla SOLO del entorno donde se ejecuta. Corrido
 * en la Shell del workspace, prueba las variables del WORKSPACE — que NO tienen
 * por qué coincidir con las del DEPLOYMENT (Replit permite secrets propios por
 * entorno). Para la verdad de PRODUCCIÓN usa GET /api/dish-image/diagnose, que
 * lo responde el servidor desplegado. Este doctor es complementario.
 *
 * Uso:
 *   cd artifacts/api-server
 *   node dish-doctor.mjs
 *
 * Etapas: (a) Gemini genera 1 imagen · (b) subir+borrar un archivo dummy en el
 * bucket con service_role · (c) INSERT+SELECT+DELETE en dish_images (revela
 * esquema incompatible). Coste: 1 imagen de Gemini (~0,036 €). No deja basura.
 * (Ya no hay etapa de recorte: se eliminó @imgly el 27/07/2026.)
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

// PNG transparente 2×2 mínimo (evita depender de sharp para el dummy).
const DUMMY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNkYPhfz0AEYBxVSFQGAGX/Af8Ksef4AAAAAElFTkSuQmCC",
  "base64",
);

const BUCKET = "dish-images";
const GEMINI_MODEL = "gemini-2.5-flash-image";
const results = [];
function ok(stage, detail = "") { results.push({ stage, ok: true, detail }); console.log(`✅ ${stage} ${detail}`); }
function ko(stage, err) { results.push({ stage, ok: false, detail: String(err?.message ?? err) }); console.log(`❌ ${stage}: ${err?.message ?? err}`); }

console.log("\n🩺 DISH DOCTOR — diagnóstico por etapas");
console.log("⚠️  Habla SOLO del entorno donde se ejecuta (aquí: donde corre esta Shell).");
console.log("    Para la verdad de PRODUCCIÓN: GET /api/dish-image/diagnose.\n");

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

// ── (b) Storage: subir + borrar dummy con service_role ───────────────────────
try {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const path = "_doctor-test.png";
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, DUMMY_PNG, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  await sb.storage.from(BUCKET).remove([path]);
  ok("(b) Storage subir+borrar (service_role)");
} catch (e) { ko("(b) Storage subir+borrar (service_role)", e); }

// ── (c) BD: INSERT + SELECT + DELETE en dish_images ──────────────────────────
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
  ok("(c) BD insert/select/delete", `(columnas OK: ${Object.keys(rows[0]).join(", ")})`);
} catch (e) { ko("(c) BD insert/select/delete", e); }

// ── Veredicto ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? "✅ TODAS LAS ETAPAS OK" : `❌ FALLAN ${failed.length}: ${failed.map((f) => f.stage).join(", ")}`}\n`);
process.exit(failed.length === 0 ? 0 : 1);
