import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// ── Stripe webhook MUST come before express.json() ──────────────────────────
// Stripe needs the raw Buffer body for signature verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing failed" });
    }
  },
);

// ── Standard middleware (after webhook) ──────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
// ALLOWED_ORIGINS: comma-separated list of trusted origins
// Example: ALLOWED_ORIGINS=https://goaliq.app,http://localhost:5173
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check exact match in allowlist
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow Replit preview domains in development only. These are shared,
      // multi-tenant domains, so allowing them in production would let any
      // Replit-hosted site make authenticated cross-origin requests.
      if (!isProduction && (origin.endsWith(".replit.dev") || origin.endsWith(".repl.co"))) {
        return callback(null, true);
      }

      // Reject everything else
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
