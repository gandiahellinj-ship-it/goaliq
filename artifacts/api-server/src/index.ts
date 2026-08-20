import { ensureStripeUsersTable } from "./stripeStorage";
import { ensureFlexDaysTable } from "./routes/flex-days";
import { ensureWorkoutHistoryTable } from "./routes/workout-history";
import { ensureSupabaseTablesReady } from "./db-migrations";
import app from "./app";
import { logger } from "./lib/logger";
import { loadWorkoutXCache } from "./lib/workoutx-cache";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  // Contexto del entorno — se registra SIEMPRE. Sin esto no hay forma de saber
  // por qué Stripe no arranca en un despliegue al que no puedes entrar.
  // Solo booleanos y nombres: nunca el valor de un secreto.
  const stripeEnv = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    stripeSecretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    replitDeployment: process.env.REPLIT_DEPLOYMENT ?? null,
    replitConnectors: Boolean(process.env.REPLIT_CONNECTORS_HOSTNAME),
    replitDomains: process.env.REPLIT_DOMAINS ?? null,
  };
  logger.info({ stripeEnv }, "[stripe] arrancando — contexto del entorno");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error(
      { stripeEnv },
      "[stripe] NO ARRANCA: falta DATABASE_URL. Sin base de datos no hay cobro, " +
        "ni webhook, ni sincronización. Todo lo relacionado con pagos queda inactivo.",
    );
    return;
  }

  // Always ensure our local stripe_users table exists
  try {
    await ensureStripeUsersTable();
    logger.info("stripe_users table ready");
  } catch (err) {
    logger.warn({ err }, "Could not create stripe_users table — continuing");
  }

  // Only run full Stripe sync if credentials are available
  try {
    const { getStripeSync } = await import("./stripeClient");
    const { runMigrations } = await import("stripe-replit-sync");

    logger.info("Running Stripe DB migrations...");
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      logger.info({ webhookUrl }, "[stripe] registrando webhook…");
      try {
        const hook = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
        logger.info({ webhookUrl, webhookId: hook?.id }, "[stripe] webhook REGISTRADO");
      } catch (err) {
        logger.error(
          { err, webhookUrl },
          "[stripe] el registro del webhook FALLÓ. Stripe no podrá avisar de pagos, " +
            "altas ni bajas en este entorno.",
        );
      }
    } else {
      // Antes esto se saltaba EN SILENCIO: sin dominio no se registraba el
      // webhook y no quedaba ni una línea en el log. Fue justo lo que impidió
      // diagnosticar el incidente del 20/08/2026.
      logger.error(
        { stripeEnv },
        "[stripe] NO se registra el webhook: falta REPLIT_DOMAINS, así que no se " +
          "puede construir su URL pública. Stripe no podrá avisar de pagos ni bajas.",
      );
    }

    logger.info("[stripe] lanzando sincronización en segundo plano…");
    stripeSync.syncBackfill().catch((err: unknown) => {
      logger.error({ err }, "[stripe] la sincronización falló");
    });

    logger.info("[stripe] inicializado correctamente");
  } catch (err) {
    // Antes esto decía siempre "credentials not available yet", fuera cual fuera
    // el error, y en nivel `warn`. Eso ocultó durante meses que producción NUNCA
    // ha podido hablar con Stripe (incidente 20/08/2026). Ahora: nivel `error`,
    // el error REAL incluido, y sin presuponer la causa.
    logger.error(
      { err, stripeEnv },
      "[stripe] NO SE HA INICIALIZADO. Ni webhook ni sincronización: el cobro no " +
        "funciona en este entorno. La causa real va en el campo `err`. " +
        "Sospechosos habituales: no hay conexión de Stripe para este entorno " +
        "(el conector de Replit distingue development y production, ver " +
        "stripeClient.ts), o falta STRIPE_SECRET_KEY.",
    );
  }
}

await initStripe();

try {
  await ensureFlexDaysTable();
  logger.info("flex_days table ready");
} catch (err) {
  logger.warn({ err }, "Could not create flex_days table — continuing");
}

try {
  await ensureWorkoutHistoryTable();
  logger.info("workout_history table ready");
} catch (err) {
  logger.warn({ err }, "Could not create workout_history table — continuing");
}

try {
  await ensureSupabaseTablesReady();
  logger.info("supabase tables ready (meal_plans, calendar_events, workout_plans patched)");
} catch (err) {
  logger.warn({ err }, "Could not patch supabase tables — continuing");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

loadWorkoutXCache().catch(err => console.error("[workoutx-cache] Load failed:", err));
