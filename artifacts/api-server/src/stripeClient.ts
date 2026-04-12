// Stripe credentials — prefers explicit env vars, falls back to Replit Connector
import Stripe from "stripe";

async function getCredentials(): Promise<{
  publishableKey: string;
  secretKey: string;
}> {
  // If explicit keys are set in env vars, use them directly
  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envPublic = process.env.STRIPE_PUBLIC_KEY ?? "";
  if (envSecret) {
    return { publishableKey: envPublic, secretKey: envSecret };
  }

  // Fall back to Replit Connector (used when no explicit keys are set)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Stripe not configured: set STRIPE_SECRET_KEY or connect Stripe via the Integrations panel.",
    );
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = await response.json();
  const conn = data.items?.[0];

  if (!conn?.settings?.secret) {
    throw new Error(
      `Stripe ${targetEnvironment} connection not found. Set STRIPE_SECRET_KEY or connect Stripe via the Integrations panel.`,
    );
  }

  return {
    publishableKey: conn.settings.publishable ?? "",
    secretKey: conn.settings.secret,
  };
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

export async function getStripePublicKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

// WARNING: Never cache this client — always call fresh.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" as any });
}

let _stripeSyncInstance: any = null;

export async function getStripeSync() {
  if (_stripeSyncInstance) return _stripeSyncInstance;

  const { StripeSync } = await import("stripe-replit-sync");
  const secretKey = await getStripeSecretKey();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  _stripeSyncInstance = new StripeSync({
    poolConfig: { connectionString: databaseUrl, max: 2 },
    stripeSecretKey: secretKey,
  });

  return _stripeSyncInstance;
}

export function resetStripeSyncInstance() {
  _stripeSyncInstance = null;
}
