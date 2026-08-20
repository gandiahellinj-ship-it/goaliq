// Tope DIARIO de generaciones de imagen de plato, por usuario.
//
// Por qué no basta con un limitador de peticiones: `POST /api/dish-image`
// responde desde caché compartida la mayoría de las veces, y eso cuesta 0 €
// (una SELECT). Solo el fallo de caché llama a Gemini y cuesta ~0,036 €. Un
// limitador de peticiones o bien es tan flojo que no protege (el caso anterior:
// 100/min), o bien es tan estricto que rompe la pantalla de comidas (un plan
// semanal pinta ~35 platos de golpe, casi todos aciertos de caché).
//
// Lo que hay que topar son las GENERACIONES reales. 40/día cubre el peor caso
// legítimo (el primer usuario que abre un plan nuevo entero: 35 platos) y deja
// el gasto máximo por usuario y día en ~1,44 €.
//
// LIMITACIÓN CONOCIDA: el contador vive en memoria del proceso. Se reinicia al
// reiniciar el servidor y no se comparte entre instancias — igual que el
// almacén por defecto de express-rate-limit, que ya usa el resto del servidor.
// Si algún día hay varias instancias, esto pasa a la base de datos.

const MAX_GENERATIONS_PER_DAY = 40;
const MAX_TRACKED_USERS = 5000; // cota de memoria; al superarla se barren los días viejos

interface Entry {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

const counters = new Map<string, Entry>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Barre las entradas de días anteriores (evita que el mapa crezca sin fin). */
function sweep(day: string): void {
  for (const [userId, entry] of counters) {
    if (entry.day !== day) counters.delete(userId);
  }
}

function entryFor(userId: string): Entry {
  const day = todayKey();
  const existing = counters.get(userId);
  if (existing && existing.day === day) return existing;

  if (counters.size >= MAX_TRACKED_USERS) sweep(day);

  const fresh: Entry = { day, count: 0 };
  counters.set(userId, fresh);
  return fresh;
}

/** ¿Le queda cupo hoy a este usuario para generar una imagen nueva? */
export function canGenerateDishImage(userId: string): boolean {
  return entryFor(userId).count < MAX_GENERATIONS_PER_DAY;
}

/** Apunta una generación REAL (solo se llama cuando Gemini se ha usado). */
export function noteDishImageGenerated(userId: string): void {
  entryFor(userId).count += 1;
}

/** Cuántas generaciones le quedan hoy (para diagnóstico y cabeceras). */
export function remainingDishImageGenerations(userId: string): number {
  return Math.max(0, MAX_GENERATIONS_PER_DAY - entryFor(userId).count);
}

export { MAX_GENERATIONS_PER_DAY };
