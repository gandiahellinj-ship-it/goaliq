import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// Trust proxy (Replit pone X-Forwarded-For) — necesario para rate limiting por IP correcto
app.set("trust proxy", 1);

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
const isProduction = process.env.NODE_ENV === "production";

// Helmet first: set security headers on every response.
app.use(
  helmet({
    // CSP disabled: this server returns JSON, not HTML.
    // The PWA carries its own CSP on the server that serves it.
    contentSecurityPolicy: false,
    // HSTS only in production; local HTTP dev must not be forced to HTTPS.
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),
);
app.disable("x-powered-by");

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

// ── GET /api/recipes/random ──────────────────────────────────────────────────
// Proxies Spoonacular's random recipe endpoint. Defined before the main router
// so it resolves regardless of the modular routes mounted below.
app.get("/api/recipes/random", async (_req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    logger.error("SPOONACULAR_API_KEY not set");
    res.status(500).json({ error: "Recipe service not configured" });
    return;
  }

  const params = new URLSearchParams({
    apiKey,
    addRecipeInformation: "true",
    includeNutrition: "true",
    number: "1",
  });

  try {
    const upstream = await fetch(
      `https://api.spoonacular.com/recipes/random?${params}`,
    );
    if (!upstream.ok) {
      logger.error(
        { status: upstream.status },
        "Spoonacular random recipe request failed",
      );
      res.status(500).json({ error: "Failed to fetch recipe" });
      return;
    }

    const data = (await upstream.json()) as { recipes?: unknown[] };
    const recipe = data.recipes?.[0];
    if (!recipe) {
      res.status(500).json({ error: "No recipe returned" });
      return;
    }

    res.json(recipe);
  } catch (err) {
    logger.error({ err }, "Spoonacular random recipe error");
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
});

app.use("/api", router);

// ── IA endpoints: dietas + validación de comidas ─────────────────────────────
// fetch nativo (Node 24), sin SDKs. Claude vía Messages API; Gemini para imagen.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-opus-4-8";

/**
 * Llama a Claude (Messages API) con structured outputs y devuelve el objeto JSON
 * ya validado contra `schema`. Lanza si la API falla o rehúsa la petición.
 */
async function callClaude(opts: {
  system?: string;
  content: unknown; // string o array de content blocks (texto + imagen)
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      ...(opts.system ? { system: opts.system } : {}),
      output_config: { format: { type: "json_schema", schema: opts.schema } },
      messages: [{ role: "user", content: opts.content }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errText}`);
  }

  const data: any = await resp.json();

  // Los clasificadores de seguridad pueden rehusar (HTTP 200, stop_reason "refusal").
  if (data.stop_reason === "refusal") {
    throw new Error("Claude rechazó la petición (refusal)");
  }

  // Con structured outputs el JSON llega en un bloque de texto.
  const textBlock = (data.content ?? []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude no devolvió contenido");
  return JSON.parse(textBlock.text);
}

// 1) POST /api/diets/generate — genera una semana de comidas a partir del perfil.
app.post("/api/diets/generate", async (req, res) => {
  try {
    const profile = req.body?.user_profile ?? req.body;
    if (!profile || typeof profile !== "object") {
      return res.status(400).json({ error: "Falta user_profile" });
    }
    const weekNumber = Number(req.body?.week_number ?? profile.week_number ?? 1);

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["week_number", "meals_array"],
      properties: {
        week_number: { type: "integer" },
        meals_array: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "day",
              "meal_type",
              "name",
              "ingredients",
              "calories",
              "protein_g",
              "carbs_g",
              "fat_g",
            ],
            properties: {
              day: { type: "string" },
              meal_type: {
                type: "string",
                enum: ["desayuno", "almuerzo", "comida", "merienda", "cena", "snack"],
              },
              name: { type: "string" },
              ingredients: { type: "array", items: { type: "string" } },
              calories: { type: "integer" },
              protein_g: { type: "number" },
              carbs_g: { type: "number" },
              fat_g: { type: "number" },
            },
          },
        },
      },
    };

    const system =
      "Eres un nutricionista experto. Genera un plan de comidas semanal " +
      "personalizado (7 días) adaptado al perfil del usuario: edad, objetivo, " +
      "tipo de dieta, preferencias, alergias y restricciones. Respeta calorías y " +
      "macros coherentes con el objetivo. Devuelve cantidades realistas.";

    const result = await callClaude({
      system,
      content:
        `Genera el plan de la semana ${weekNumber} para este perfil:\n` +
        JSON.stringify(profile, null, 2),
      schema,
    });

    // Garantiza que el número de semana solicitado se refleja en la respuesta.
    result.week_number = weekNumber;
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error({ err }, "diets/generate error");
    return res.status(502).json({ error: "No se pudo generar la dieta" });
  }
});

// 2) POST /api/diets/visualize — genera una imagen 9:16 del plato con Gemini.
app.post("/api/diets/visualize", async (req, res) => {
  try {
    const mealName: string = req.body?.meal_name;
    const ingredients: unknown = req.body?.ingredients;
    if (!mealName) return res.status(400).json({ error: "Falta meal_name" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

    const ingredientList = Array.isArray(ingredients)
      ? ingredients.join(", ")
      : String(ingredients ?? "");

    const prompt =
      `Fotografía de producto profesional de "${mealName}". ` +
      (ingredientList ? `Ingredientes: ${ingredientList}. ` : "") +
      "Fondo blanco sólido y limpio. Luz profesional cenital. " +
      "Solo el plato visible, sin contexto, sin cubiertos, sin accesorios. " +
      "Composición vertical 9:16 (retrato), el plato centrado y destacado.";

    const model = "gemini-2.5-flash-image";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "9:16" },
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API ${resp.status}: ${errText}`);
    }

    const data: any = await resp.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData ?? p.inline_data);
    const inline = imagePart?.inlineData ?? imagePart?.inline_data;
    if (!inline?.data) throw new Error("Gemini no devolvió imagen");

    const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
    const imageUrl = `data:${mime};base64,${inline.data}`;

    return res.status(200).json({ image_url: imageUrl, meal_name: mealName });
  } catch (err: any) {
    logger.error({ err }, "diets/visualize error");
    return res.status(502).json({ error: "No se pudo generar la imagen" });
  }
});

// 3) POST /api/meals/validate — compara la foto del usuario con la comida esperada.
app.post("/api/meals/validate", async (req, res) => {
  try {
    const photoBase64: string = req.body?.photo_base64;
    const expectedMeal: string = req.body?.expected_meal;
    const expectedIngredients: unknown = req.body?.expected_ingredients;
    if (!photoBase64) return res.status(400).json({ error: "Falta photo_base64" });
    if (!expectedMeal) return res.status(400).json({ error: "Falta expected_meal" });

    // Acepta data URL ("data:image/jpeg;base64,...") o base64 puro.
    let mediaType = "image/jpeg";
    let rawBase64 = photoBase64;
    const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(photoBase64);
    if (dataUrlMatch) {
      mediaType = dataUrlMatch[1];
      rawBase64 = dataUrlMatch[2];
    }

    const expectedList = Array.isArray(expectedIngredients)
      ? expectedIngredients.join(", ")
      : String(expectedIngredients ?? "");

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["match_percentage", "status", "detected_ingredients", "feedback"],
      properties: {
        match_percentage: { type: "integer" },
        status: { type: "string", enum: ["match", "partial", "mismatch"] },
        detected_ingredients: { type: "array", items: { type: "string" } },
        feedback: { type: "string" },
      },
    };

    const system =
      "Eres un validador de comidas con visión. Analiza la foto y compárala con " +
      "la comida e ingredientes esperados. Estima un porcentaje de coincidencia " +
      "(0-100), un estado (match >=80, partial 40-79, mismatch <40), la lista de " +
      "ingredientes que detectas en la imagen y un feedback breve en español.";

    const result = await callClaude({
      system,
      maxTokens: 2048,
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: rawBase64 },
        },
        {
          type: "text",
          text:
            `Comida esperada: ${expectedMeal}\n` +
            (expectedList ? `Ingredientes esperados: ${expectedList}\n` : "") +
            "Valida si la foto corresponde a esta comida.",
        },
      ],
      schema,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error({ err }, "meals/validate error");
    return res.status(502).json({ error: "No se pudo validar la comida" });
  }
});

export default app;
