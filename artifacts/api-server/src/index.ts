import { ensureStripeUsersTable } from "./stripeStorage";
import { ensureFlexDaysTable } from "./routes/flex-days";
import { ensureWorkoutHistoryTable } from "./routes/workout-history";
import { ensureSupabaseTablesReady } from "./db-migrations";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — Stripe will be disabled.");
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
      logger.info({ webhookUrl }, "Registering Stripe webhook...");
      try {
        await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      } catch (err) {
        logger.warn({ err }, "Webhook registration failed — continuing");
      }
    }

    logger.info("Starting Stripe backfill in background...");
    stripeSync.syncBackfill().catch((err: unknown) => {
      logger.error({ err }, "Stripe backfill error");
    });

    logger.info("Stripe initialized successfully");
  } catch (err) {
    logger.warn({ err }, "Stripe init skipped — credentials not available yet");
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
