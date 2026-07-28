import { test, expect } from "@playwright/test";
import { requiereStaging } from "./helpers";

// Recorrido 4 — MARCAR una comida como completada en /vision (COMIDAS).
// El estado de check es efímero hoy (FLUJO_DIARIO pendiente), así que la
// aserción comprueba el cambio visual del botón, no persistencia.
test.describe("Marcar comida", () => {
  requiereStaging();

  test("marcar una comida cambia el botón a 'hecha'", async ({ page }) => {
    test.skip(!process.env.E2E_LOGIN_EMAIL, "Necesita cuenta con plan (E2E_LOGIN_* en e2e/.env).");
    // TODO(staging): iniciar sesión antes de navegar.

    await page.goto("/vision");
    await page.getByRole("button", { name: /comidas/i }).click();

    const marcar = page.getByRole("button", { name: /marcar como comida/i });
    await expect(marcar).toBeVisible({ timeout: 15000 });
    await marcar.click();

    // Tras marcar, el botón pasa a estado "hecha"
    await expect(page.getByRole("button", { name: /comida hecha/i })).toBeVisible();
  });
});
