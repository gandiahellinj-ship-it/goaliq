import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// Config de los E2E de humo. Lee la URL del entorno de STAGING de e2e/.env.
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

const BASE_URL = process.env.E2E_BASE_URL ?? "";

// GUARDIA DE SEGURIDAD: NUNCA ejecutar contra producción (regla de José).
if (BASE_URL.includes("nutrition-tracker-pwa.replit.app")) {
  throw new Error(
    "❌ E2E_BASE_URL apunta a PRODUCCIÓN. Los tests de humo solo se ejecutan contra STAGING. Aborta.",
  );
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // los recorridos crean/borran cuentas: en serie para no pisarse
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
