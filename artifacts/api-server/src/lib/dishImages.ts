// Imágenes de plato — pipeline de producción (Fase 0 aprobada 25/07/2026).
//
// Genera bajo demanda la foto de un plato, la recorta a PNG transparente, la
// sube a Supabase Storage (bucket "dish-images", público) y la cachea de forma
// COMPARTIDA entre todos los usuarios por clave = nombre_normalizado + hash de
// ingredientes visibles. Tabla índice: public.dish_images.
//
// Decisiones (docs/DECISIONES.md 25/07): fondo gris cálido + recorte @imgly
// (Node, sin Python); generación bajo demanda; secreto GOOGLE_GEMINI_API_KEY;
// fallback permanente = círculo de iniciales (lo pone el frontend si url = null).
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { logger } from "./logger";

const BUCKET = "dish-images";
const GEMINI_MODEL = "gemini-2.5-flash-image";
const COST_PER_IMAGE_EUR = 0.036; // Nano Banana ~$0.039 ≈ 0,036 €
const MAX_FAIL_ATTEMPTS = 3; // anti-bucle: tras 3 fallos, no se reintenta (ni se gasta)

// ── Conexión a BD (pool superusuario, como el resto del server) ──────────────
let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

// ── Cliente Storage con service_role (necesario para SUBIR al bucket) ────────
let _storageClient: ReturnType<typeof createClient> | null = null;
function getStorageClient() {
  if (_storageClient) return _storageClient;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas (necesarias para subir imágenes de plato)");
  }
  _storageClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _storageClient;
}

// ── Tipos mínimos del plato que llegan del frontend ──────────────────────────
export interface DishIngredient {
  name: string;
  amount?: string;
  category?: string;
  visual_ref?: string;
}
export interface DishInput {
  meal_name: string;
  ingredients: DishIngredient[];
  /** true si es bebida (usa la variante de prompt del vaso). */
  is_drink?: boolean;
}

// Condimentos no visibles tras cocinar (se omiten de la descripción/hash).
const HIDDEN = /\b(sal|salt|aceite|oil|pimienta|pepper|ajo|garlic|vinagre|vinegar|especias?|spices?|agua|water)\b/i;

/** Ingredientes VISIBLES para la foto: los NOMBRES de los alimentos, sin
 *  condimentos ocultos. NO se usa `visual_ref`: en los planes reales ese campo
 *  guarda la CANTIDAD ("un puñado", "2 tazas", "media rodaja"), no una
 *  descripción visual — llegaba a Gemini sin nombres de comida y generaba fotos
 *  arbitrarias (verificado con datos reales, 29/07/2026). Los nombres SÍ
 *  describen el alimento ("filete de salmón", "brócoli", "aguacate"). */
function visibleIngredients(ings: DishIngredient[]): string[] {
  return ings.map((i) => i.name?.trim()).filter((n): n is string => !!n && !HIDDEN.test(n));
}

/** Nombre normalizado: minúsculas, sin acentos, sin puntuación, guiones. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "plato";
}

/** Clave de caché COMPARTIDA = nombre normalizado + hash de ingredientes visibles. */
export function cacheKey(dish: DishInput): string {
  const visible = visibleIngredients(dish.ingredients).map((s) => s.toLowerCase()).sort();
  const hash = crypto.createHash("sha256").update(visible.join("|")).digest("hex").slice(0, 12);
  return `${normalizeName(dish.meal_name)}--${hash}`;
}

/** descripcion_imagen = nombre del plato + ingredientes visibles. El nombre del
 *  plato le da a Gemini el FORMATO ("Omelette de…", "Filete de…") y los nombres
 *  de ingredientes sus COMPONENTES. Si no quedan ingredientes visibles (todo
 *  condimento), basta con el nombre del plato, que ya es descriptivo. */
function descripcionImagen(dish: DishInput): string {
  const visible = visibleIngredients(dish.ingredients);
  const name = dish.meal_name?.trim();
  if (visible.length === 0) return name || "plato";
  return name ? `${name}: ${visible.join(", ")}` : visible.join(", ");
}

/** Diagnóstico: qué descripción, prompt y clave produce un plato (sin generar). */
export function inspectDish(dish: DishInput) {
  const visible = visibleIngredients(dish.ingredients);
  return {
    meal_name: dish.meal_name,
    descripcion_imagen: descripcionImagen(dish),
    prompt: buildPrompt(dish),
    cache_key: cacheKey(dish),
    visible_ingredients: visible,
    has_visual_ref: dish.ingredients.some((i) => i.visual_ref?.trim()),
  };
}

// ── Prompt maestro (docs/PROMPT_PLATOS.md — sin recorte; no traducir) ─────────
// Simplificado (27/07/2026): la foto se muestra como TARJETA (opción A), así que
// no perseguimos un hex de fondo exacto ni «no vignette» (Gemini los ignora).
// Recipiente FIJO = plato llano blanco (lo que Gemini devuelve bien y consistente).
function buildPrompt(dish: DishInput): string {
  const desc = descripcionImagen(dish);
  const vessel = dish.is_drink
    ? `the finished drink "${desc}" in a clear glass seen from directly above, creamy frothy surface`
    : `a single finished, cooked and plated dish of "${desc}", with all the ingredients cooked and combined together and served as ONE cohesive dish on a simple white plate (creams and liquids integrated as a sauce over the food, never in a separate bowl)`;
  return `Professional food photography, perfect top-down overhead view, ${vessel}, photorealistic, soft even studio lighting, appetizing, high detail, flat even lighting on a uniform seamless plain neutral light grey background, no gradient, no table, no props, no cutlery, no separate bowls or ramekins, no sauce on the side, no raw loose ingredients, no text, nothing else in frame, centered, square 1:1, ultra high resolution`;
}

// ── Generación + recorte ─────────────────────────────────────────────────────
async function generateWithGemini(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY no configurada");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
    },
  );
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data: any = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p: any) => p.inlineData ?? p.inline_data);
  const d = inline?.inlineData ?? inline?.inline_data;
  if (!d?.data) throw new Error("Gemini no devolvió imagen");
  return Buffer.from(d.data, "base64");
}

// (Sin recorte: la foto se sirve tal cual de Gemini. @imgly eliminado 27/07/2026.)

// ── Deduplicación de peticiones en vuelo (misma clave → una sola generación) ──
const inFlight = new Map<string, Promise<DishImageResult>>();

// ── Semáforo: máx. 3 generaciones simultáneas (evita ráfagas contra Gemini).
// Espera turno en vez de descartar → nunca deja un plato sin foto por concurrencia.
const MAX_CONCURRENT_GEN = 6;
let activeGen = 0;
const genWaiters: Array<() => void> = [];
async function acquireGenSlot(): Promise<void> {
  if (activeGen < MAX_CONCURRENT_GEN) { activeGen++; return; }
  await new Promise<void>((resolve) => genWaiters.push(resolve)); // hereda el hueco al despertar
}
function releaseGenSlot(): void {
  const next = genWaiters.shift();
  if (next) next(); // pasa el hueco al siguiente (activeGen no baja)
  else activeGen--; // no hay cola → libera el hueco
}

/** Resultado con MOTIVO explícito del fallo (no silencioso). */
export interface DishImageResult {
  url: string | null;
  /** null si OK; si no, categoría del fallo (para no quedar ciegos). */
  error: string | null;
}

/**
 * Devuelve la URL pública de la foto del plato, generándola si no está en caché.
 * Nunca lanza: si algo falla, devuelve { url: null, error: <motivo> } y lo
 * registra (anti-bucle). Caché compartida entre todos los usuarios.
 */
export async function getOrCreateDishImage(dish: DishInput): Promise<DishImageResult> {
  const key = cacheKey(dish);

  // 1) Caché: ¿ya existe (ready) o está vetado por fallos (anti-bucle)?
  try {
    const { rows } = await getPool().query(
      "SELECT url, status, fail_count FROM public.dish_images WHERE cache_key = $1",
      [key],
    );
    if (rows.length > 0) {
      const row = rows[0];
      if (row.status === "ready" && row.url) return { url: row.url, error: null }; // acierto → coste 0
      if (row.status === "failed" && row.fail_count >= MAX_FAIL_ATTEMPTS) {
        return { url: null, error: "vetado_por_fallos_previos" }; // anti-bucle
      }
    }
  } catch (err: any) {
    logger.error({ err, key }, "[dishImages] fallo leyendo caché (¿tabla dish_images existe?)");
    return { url: null, error: `db_read: ${err?.message ?? err}` };
  }

  // 2) Deduplicación: si ya se está generando esta misma clave, reutiliza la promesa.
  const existing = inFlight.get(key);
  if (existing) return existing;

  const p = generateAndStore(dish, key).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function generateAndStore(dish: DishInput, key: string): Promise<DishImageResult> {
  await acquireGenSlot();
  let stage = "gemini";
  try {
    const raw = await generateWithGemini(buildPrompt(dish)); // sin recorte: se sube tal cual
    stage = "storage_config";
    const storage = getStorageClient();
    stage = "upload";
    const path = `${key}.png`;
    const { error: upErr } = await storage.storage
      .from(BUCKET)
      .upload(path, raw, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
    const { data: pub } = storage.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    stage = "db_write";
    await getPool().query(
      `INSERT INTO public.dish_images (cache_key, url, meal_name, status, cost_eur, updated_at)
       VALUES ($1, $2, $3, 'ready', $4, now())
       ON CONFLICT (cache_key) DO UPDATE SET url = $2, status = 'ready', cost_eur = $4, updated_at = now()`,
      [key, url, dish.meal_name, COST_PER_IMAGE_EUR],
    );
    logger.info({ key }, "[dishImages] imagen generada y cacheada");
    return { url, error: null };
  } catch (err: any) {
    // Anti-bucle: registra el fallo e incrementa el contador; tras 3 no se reintenta.
    const reason = `${stage}: ${err?.message ?? err}`;
    logger.error({ err, key, stage }, "[dishImages] fallo generando imagen");
    try {
      await getPool().query(
        `INSERT INTO public.dish_images (cache_key, url, meal_name, status, fail_count, updated_at)
         VALUES ($1, NULL, $2, 'failed', 1, now())
         ON CONFLICT (cache_key) DO UPDATE SET status = 'failed', fail_count = public.dish_images.fail_count + 1, updated_at = now()`,
        [key, dish.meal_name],
      );
    } catch (dbErr) {
      logger.error({ dbErr, key }, "[dishImages] fallo registrando el fallo");
    }
    return { url: null, error: reason };
  } finally {
    releaseGenSlot();
  }
}

// ── Diagnóstico (lo ejecuta el servidor DESPLEGADO vía endpoint) ─────────────
const EXPECTED_COLUMNS = ["cache_key", "url", "meal_name", "status", "fail_count", "cost_eur", "created_at", "updated_at"];

/** Reporta presencia de variables (sí/no, nunca el valor), esquema real de la
 *  tabla y comparación con lo que el código espera, y conteo por estado. */
export async function diagnoseDishImages() {
  const env = {
    GOOGLE_GEMINI_API_KEY: Boolean(process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
  };
  let columns: string[] = [];
  let schemaError: string | null = null;
  try {
    const { rows } = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'dish_images' ORDER BY ordinal_position`,
    );
    columns = rows.map((r: any) => r.column_name);
  } catch (err: any) {
    schemaError = err?.message ?? String(err);
  }
  const missingColumns = EXPECTED_COLUMNS.filter((c) => !columns.includes(c));
  let counts: Record<string, number> = {};
  try {
    const { rows } = await getPool().query("SELECT status, count(*)::int AS n FROM public.dish_images GROUP BY status");
    counts = Object.fromEntries(rows.map((r: any) => [r.status, r.n]));
  } catch { /* tabla puede no existir */ }
  return {
    env,
    tableExists: columns.length > 0,
    columns,
    missingColumns, // si no está vacío → CAUSA probable (esquema no coincide)
    schemaError,
    counts,
  };
}

/** Borra las filas 'failed' de un plato (levanta el veto anti-bucle). Devuelve nº borradas. */
export async function resetFailedDish(dish: DishInput): Promise<number> {
  const key = cacheKey(dish);
  const { rowCount } = await getPool().query(
    "DELETE FROM public.dish_images WHERE cache_key = $1 AND status = 'failed'",
    [key],
  );
  return rowCount ?? 0;
}

/** Diagnóstico: inspecciona TODOS los platos del plan del usuario — descripción,
 *  prompt y clave de cada uno, y la fila de caché asociada (detecta claves
 *  colisionadas: misma clave para platos distintos = fotos cruzadas). */
export async function inspectUserPlan(userId: string) {
  const { rows } = await getPool().query(
    "SELECT days FROM public.meal_plans WHERE user_id = $1 ORDER BY generated_at DESC NULLS LAST LIMIT 1",
    [userId],
  );
  if (!rows.length) return { hasPlan: false, meals: [] as any[] };
  const days = Array.isArray(rows[0].days) ? rows[0].days : [];
  const out: any[] = [];
  for (const day of days) {
    for (const m of day?.meals ?? []) {
      const dish: DishInput = {
        meal_name: m?.meal_name ?? m?.name ?? "",
        ingredients: (m?.ingredients ?? []).map((i: any) => ({ name: i?.name, visual_ref: i?.visual_ref, category: i?.category })),
        is_drink: false,
      };
      const insp = inspectDish(dish);
      const { rows: r } = await getPool().query(
        "SELECT meal_name, status, url FROM public.dish_images WHERE cache_key = $1",
        [insp.cache_key],
      );
      out.push({
        day: day?.day,
        ...insp,
        // Ingredientes CRUDOS tal como están en el plan (nombre + visual_ref) →
        // ver si el plan guarda ingredientes que no corresponden al nombre.
        stored_ingredients: dish.ingredients.map((i) => ({ name: i.name, visual_ref: i.visual_ref ?? null })),
        cached_as: r[0]?.meal_name ?? null,
        cached_status: r[0]?.status ?? null,
        cached_url: r[0]?.url ?? null,
      });
    }
  }
  // Detecta claves usadas por más de un meal_name distinto (colisión).
  const byKey = new Map<string, Set<string>>();
  for (const x of out) {
    if (!byKey.has(x.cache_key)) byKey.set(x.cache_key, new Set());
    byKey.get(x.cache_key)!.add(x.meal_name);
  }
  const collisions = [...byKey.entries()].filter(([, names]) => names.size > 1).map(([k, names]) => ({ cache_key: k, meal_names: [...names] }));
  return { hasPlan: true, count: out.length, collisions, meals: out };
}
