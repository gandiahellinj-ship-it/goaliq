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
// POR QUÉ EN LA BASE DE DATOS Y NO EN MEMORIA: un contador en memoria se
// reinicia con cada despliegue (y aquí se despliega a menudo) y se multiplica
// por el número de instancias en autoscale — o sea, no sería un tope real.
// La reserva se hace con UN SOLO UPDATE condicional, que en PostgreSQL es
// atómico: ni las ~35 peticiones simultáneas de la pantalla de comidas ni
// varias instancias a la vez pueden saltárselo.
import pg from "pg";
import { logger } from "./logger";

const MAX_GENERATIONS_PER_DAY = 40;

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

/**
 * Reserva UNA generación por adelantado, de forma ATÓMICA.
 * Devuelve false si al usuario no le queda cupo hoy.
 *
 * Se reserva ANTES de llamar a Gemini, no se cuenta después: si se contara al
 * terminar, las ~35 peticiones simultáneas de la pantalla de comidas pasarían
 * todas la comprobación antes de que ninguna acabase y el tope no serviría.
 *
 * Quien reserve y NO acabe generando (acierto de caché, veto anti-bucle) debe
 * devolver la reserva con `refundDishImageGeneration`.
 *
 * Si la base de datos falla, devuelve FALSE (no se genera). Es un guardián de
 * gasto: ante la duda, no gastar. El frontend ya sabe pintar el círculo de
 * iniciales cuando no hay foto, así que el usuario no ve nada roto.
 */
export async function tryReserveDishImageGeneration(userId: string): Promise<boolean> {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO public.dish_image_quota (user_id, day, count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, day) DO UPDATE
         SET count = public.dish_image_quota.count + 1
         WHERE public.dish_image_quota.count < $2
       RETURNING count`,
      [userId, MAX_GENERATIONS_PER_DAY],
    );
    return rows.length > 0; // 0 filas = el WHERE del UPDATE no pasó = sin cupo
  } catch (err) {
    logger.error({ err, userId }, "[dish-image-quota] no se pudo reservar cupo — no se genera");
    return false;
  }
}

/** Devuelve una reserva que al final no gastó nada (acierto de caché, veto). */
export async function refundDishImageGeneration(userId: string): Promise<void> {
  try {
    await getPool().query(
      `UPDATE public.dish_image_quota
       SET count = GREATEST(count - 1, 0)
       WHERE user_id = $1 AND day = CURRENT_DATE`,
      [userId],
    );
  } catch (err) {
    // No es crítico: como mucho el usuario se queda con una generación de menos hoy.
    logger.warn({ err, userId }, "[dish-image-quota] no se pudo devolver la reserva");
  }
}

/** Cuántas generaciones le quedan hoy (informativo, para el frontend y el log). */
export async function remainingDishImageGenerations(userId: string): Promise<number> {
  try {
    const { rows } = await getPool().query(
      "SELECT count FROM public.dish_image_quota WHERE user_id = $1 AND day = CURRENT_DATE",
      [userId],
    );
    const used = rows[0]?.count ?? 0;
    return Math.max(0, MAX_GENERATIONS_PER_DAY - used);
  } catch {
    return 0; // coherente con el fallo cerrado de la reserva
  }
}

export { MAX_GENERATIONS_PER_DAY };
