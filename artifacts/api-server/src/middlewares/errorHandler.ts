import { type Request, type Response, type NextFunction } from "express";

/**
 * Se usa el logger de la PETICIÓN (`req.log`, que pone pino-http) en vez de
 * importar el global. Dos ventajas: cada línea sale con el id de su petición,
 * y este módulo queda sin dependencias, así que se puede probar en aislamiento.
 * Si por lo que sea no hubiera `req.log`, se cae a consola en vez de perder el
 * error.
 */
function logDe(req: Request) {
  const log = (req as Request & { log?: unknown }).log as
    | { warn: (o: unknown, m: string) => void; error: (o: unknown, m: string) => void }
    | undefined;
  return (
    log ?? {
      warn: (o: unknown, m: string) => console.warn(m, o),
      error: (o: unknown, m: string) => console.error(m, o),
    }
  );
}

/**
 * Manejador de errores global. Va SIEMPRE el último de la cadena.
 *
 * Por qué existe: hasta el 20/08/2026 no había ninguno. Cualquier error no
 * capturado en una ruta salía como un 500 seco de Express, sin registro y sin
 * explicación. Eso ocultó durante meses que `POST /api/meals/replace-ingredient`
 * fallaba en el 100 % de las peticiones (ver ESTADO.md §3.1): el usuario veía
 * "inténtalo de nuevo" y nadie sabía por qué.
 *
 * Express 5 encamina aquí también los rechazos de manejadores `async`.
 */

/**
 * Detecta un error de validación de Zod POR SU FORMA, no importando la clase.
 * Así no depende de que api-server y api-zod resuelvan exactamente la misma
 * copia de zod (con dos copias, `instanceof ZodError` daría false y el usuario
 * recibiría un 500 en vez de un 400).
 */
export function isZodError(
  err: unknown,
): err is { name: string; issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/** Convierte los problemas de Zod en algo legible para quien llama a la API. */
export function zodIssuesToDetails(
  issues: Array<{ path: (string | number)[]; message: string }>,
): Array<{ field: string; message: string }> {
  return issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Si la respuesta ya salió, no se puede hacer nada: solo dejar constancia.
  if (res.headersSent) {
    logDe(req).error({ err, url: req.url }, "Error después de enviar la respuesta");
    return;
  }

  if (isZodError(err)) {
    logDe(req).warn({ issues: err.issues, url: req.url }, "Validación fallida");
    res.status(400).json({
      error: "Cuerpo de la petición inválido",
      details: zodIssuesToDetails(err.issues),
    });
    return;
  }

  // Cualquier otra cosa es un fallo nuestro: se registra ENTERO en el servidor
  // y al cliente le llega un mensaje genérico, nunca detalles internos.
  logDe(req).error({ err, url: req.url, method: req.method }, "Error no manejado");
  res.status(500).json({ error: "Error interno del servidor" });
}
