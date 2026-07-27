/**
 * DISH INSPECT PLAN — imprime, para cada plato del plan de un usuario, la
 * descripcion_imagen y el prompt final que se envían a Gemini, la clave de caché,
 * si hay visual_ref, y DETECTA colisiones de clave (misma clave para platos
 * distintos = fotos cruzadas). Diagnóstico del bug de fotos incorrectas.
 *
 * Uso (Shell de Replit, tiene DATABASE_URL):
 *   cd artifacts/api-server && node dish-inspect-plan.mjs TU-EMAIL
 *
 * Lógica idéntica a src/lib/dishImages.ts (copiada para poder ejecutar sin build).
 */
import crypto from "node:crypto";
import pg from "pg";

const email = process.argv[2];
if (!email) { console.error("Uso: node dish-inspect-plan.mjs <email>"); process.exit(1); }

const HIDDEN = /\b(sal|salt|aceite|oil|pimienta|pepper|ajo|garlic|vinagre|vinegar|especias?|spices?|agua|water)\b/i;
function visibleIngredients(ings) {
  const withRef = (ings ?? []).filter((i) => i?.visual_ref?.trim()).map((i) => i.visual_ref.trim());
  if (withRef.length) return withRef;
  return (ings ?? []).map((i) => i?.name?.trim()).filter((n) => n && !HIDDEN.test(n));
}
function normalizeName(name) {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plato";
}
function cacheKey(name, ings) {
  const visible = visibleIngredients(ings).map((s) => s.toLowerCase()).sort();
  const hash = crypto.createHash("sha256").update(visible.join("|")).digest("hex").slice(0, 12);
  return `${normalizeName(name)}--${hash}`;
}
function descripcion(name, ings) {
  return visibleIngredients(ings).join(", ") || name;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows: users } = await pool.query("SELECT id FROM auth.users WHERE email = $1", [email]);
if (!users.length) { console.error(`No existe usuario ${email}`); process.exit(1); }
const { rows } = await pool.query(
  "SELECT days FROM public.meal_plans WHERE user_id = $1 ORDER BY generated_at DESC NULLS LAST LIMIT 1",
  [users[0].id],
);
if (!rows.length) { console.error("El usuario no tiene plan."); process.exit(1); }

const days = Array.isArray(rows[0].days) ? rows[0].days : [];
const byKey = new Map();
const seenName = new Set();
console.log(`\n=== Plan de ${email} — inspección de imágenes ===\n`);
for (const day of days) {
  for (const m of day?.meals ?? []) {
    const name = m?.meal_name ?? m?.name ?? "";
    if (seenName.has(name)) continue; // un ejemplo por plato distinto
    seenName.add(name);
    const ings = m?.ingredients ?? [];
    const key = cacheKey(name, ings);
    byKey.set(key, (byKey.get(key) ?? new Set()).add(name));
    console.log(`PLATO: ${name}`);
    console.log(`  visual_ref presente: ${ings.some((i) => i?.visual_ref?.trim()) ? "sí" : "NO (cae a nombres)"}`);
    console.log(`  ingredientes: ${ings.map((i) => `${i?.name}${i?.visual_ref ? ` [ref: ${i.visual_ref}]` : ""}`).join(" · ")}`);
    console.log(`  descripcion_imagen: "${descripcion(name, ings)}"`);
    console.log(`  cache_key: ${key}`);
    console.log("");
  }
}
const collisions = [...byKey.entries()].filter(([, n]) => n.size > 1);
console.log(collisions.length
  ? `❌ COLISIONES DE CLAVE (fotos cruzadas):\n${collisions.map(([k, n]) => `  ${k} ← ${[...n].join(" | ")}`).join("\n")}`
  : "✅ Sin colisiones de clave (cada plato tiene clave única).");
console.log("");
await pool.end();
