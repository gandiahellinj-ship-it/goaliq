// ─────────────────────────────────────────────────────────────────────────
//  Runner de SQL para STAGING — aplica un archivo .sql directo a la base de
//  datos de staging, sin copiar-pegar en el editor web.
//
//  Uso:  node scripts/apply-staging-sql.mjs [ruta-al-.sql]
//        (por defecto usa ../../staging-setup.sql en la raíz del repo)
//
//  Requisitos:
//    - artifacts/api-server/.env.staging  con la línea:
//        STAGING_DATABASE_URL=postgresql://...   (cadena de conexión de staging)
//      (ese archivo está en .gitignore: la clave NUNCA se sube a GitHub)
//
//  Seguridad:
//    - CERROJO ANTI-PRODUCCIÓN: si la cadena de staging apunta al MISMO
//      proyecto que producción (ref sacada de nutricoach/.env.local), ABORTA.
//    - Nunca imprime la contraseña; solo muestra host + proyecto de destino.
//    - Todo el .sql corre como UNA transacción: si algo falla, no queda nada
//      a medias (se deshace entero).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const apiServerRoot = resolve(__dirname, "..");

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

// --- 1. Leer la cadena de conexión de staging (de .env.staging) --------------
const envStagingPath = resolve(apiServerRoot, ".env.staging");
if (!existsSync(envStagingPath)) {
  fail(
    `No encuentro el archivo:\n   ${envStagingPath}\n` +
      `Créalo y pon dentro:  STAGING_DATABASE_URL=postgresql://...`,
  );
}
function readEnvVar(filePath, name) {
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    if (t.slice(0, eq).trim() !== name) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val;
  }
  return null;
}

const conn = readEnvVar(envStagingPath, "STAGING_DATABASE_URL");
if (!conn) {
  fail(
    `El archivo .env.staging existe pero no tiene la línea STAGING_DATABASE_URL=...\n` +
      `Ábrelo y pega la cadena de conexión de staging.`,
  );
}

// --- 2. Cerrojo anti-producción ---------------------------------------------
// La "ref" de un proyecto Supabase es el trozo aleatorio del host
// (https://<ref>.supabase.co). Sacamos la de PRODUCCIÓN del env local del
// frontend y comprobamos que la cadena de staging NO la contenga.
function extractProdRef() {
  const prodEnvPath = resolve(repoRoot, "artifacts/nutricoach/.env.local");
  if (!existsSync(prodEnvPath)) return null;
  const url = readEnvVar(prodEnvPath, "VITE_SUPABASE_URL");
  if (!url) return null;
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}
const prodRef = extractProdRef();
if (prodRef && conn.includes(prodRef)) {
  fail(
    `CERROJO ANTI-PRODUCCIÓN activado.\n` +
      `   La cadena de STAGING_DATABASE_URL apunta al proyecto de PRODUCCIÓN (${prodRef}).\n` +
      `   Este runner es SOLO para staging. Revisa .env.staging.`,
  );
}

// --- 3. Mostrar destino (sin contraseña) ------------------------------------
let host = "?";
let db = "?";
let targetRef = "?";
try {
  const u = new URL(conn);
  host = u.hostname;
  db = u.pathname.replace(/^\//, "") || "postgres";
  const hostRef = host.match(/^db\.([a-z0-9]+)\.supabase\.co/i);
  const userRef = decodeURIComponent(u.username).match(/\.([a-z0-9]{16,})$/);
  targetRef = hostRef ? hostRef[1] : userRef ? userRef[1] : "(no detectada)";
} catch {
  // cadena no-URL: seguimos, pg intentará conectar igualmente
}

// --- 4. Cargar el .sql -------------------------------------------------------
const sqlArg = process.argv[2];
const sqlPath = sqlArg
  ? resolve(process.cwd(), sqlArg)
  : resolve(repoRoot, "staging-setup.sql");
if (!existsSync(sqlPath)) fail(`No encuentro el archivo SQL:\n   ${sqlPath}`);
const sql = readFileSync(sqlPath, "utf8");

console.log("─────────────────────────────────────────────");
console.log("  Runner de SQL para STAGING");
console.log("─────────────────────────────────────────────");
console.log(`  Archivo SQL : ${sqlPath}`);
console.log(`  Host destino: ${host}`);
console.log(`  Base datos  : ${db}`);
console.log(`  Proyecto    : ${targetRef}`);
if (prodRef) console.log(`  (producción es ${prodRef} — confirmado que NO es este)`);
console.log("─────────────────────────────────────────────\n");

// --- 5. Ejecutar (todo en una transacción atómica) --------------------------
// TLS cifrado Y verificado (no desactivamos la comprobación del certificado:
// eso permitiría un ataque "man-in-the-middle" y filtraría la contraseña).
// Supabase usa su propia CA, que no está en el almacén por defecto de Node, así
// que le damos su certificado oficial (descargado del panel) para verificar.
const caPath = resolve(apiServerRoot, "supabase-ca.crt");
if (!existsSync(caPath)) {
  fail(
    `Falta el certificado oficial de Supabase para verificar la conexión:\n` +
      `   ${caPath}\n\n` +
      `   Descárgalo en el panel de staging:\n` +
      `     Project Settings → Database → "SSL Configuration" → Download certificate\n` +
      `   y guárdalo (o dímelo y yo lo coloco) con ese nombre exacto.`,
  );
}
const client = new pg.Client({
  connectionString: conn,
  ssl: { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.log("✅ Conectado. Aplicando el SQL…\n");
  await client.query(sql);
  console.log("✅ Listo: el SQL se aplicó correctamente en staging.");
} catch (err) {
  fail(`La base de datos rechazó el SQL:\n   ${err.message}`);
} finally {
  await client.end().catch(() => {});
}
