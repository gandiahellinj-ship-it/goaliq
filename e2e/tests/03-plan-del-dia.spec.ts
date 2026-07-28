import { test, expect } from "@playwright/test";
import { requiereStaging } from "./helpers";

// Recorrido 3 — VER EL PLAN DEL DÍA en /vision (COMIDAS).
// Requiere una cuenta de staging que YA tenga plan generado (login previo).
test.describe("Ver plan del día", () => {
  requiereStaging();

  test("las comidas del día se muestran en /vision", async ({ page }) => {
    test.skip(!process.env.E2E_LOGIN_EMAIL, "Necesita cuenta con plan (E2E_LOGIN_* en e2e/.env).");
    // TODO(staging): iniciar sesión reutilizando el helper de login antes de navegar.

    await page.goto("/vision");
    // Ir a la pestaña COMIDAS
    await page.getByRole("button", { name: /comidas/i }).click();

    // Debe verse el nombre de al menos un plato y la franja de kcal
    await expect(page.getByText(/kcal/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/marcar como comida/i)).toBeVisible();
  });
});
