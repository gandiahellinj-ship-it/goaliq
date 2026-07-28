import { test, expect } from "@playwright/test";
import { requiereStaging, PASSWORD_DE_PRUEBA } from "./helpers";

// Recorrido 2 — LOGIN de una cuenta existente en staging.
// Usa E2E_LOGIN_EMAIL/PASSWORD si están; si no, se marca pendiente.
test.describe("Login", () => {
  requiereStaging();

  test("un usuario existente puede iniciar sesión", async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    test.skip(!email, "Configura E2E_LOGIN_EMAIL/PASSWORD en e2e/.env para este recorrido.");
    const password = process.env.E2E_LOGIN_PASSWORD ?? PASSWORD_DE_PRUEBA;

    await page.goto("/");
    await page.getByRole("button", { name: /iniciar sesión/i }).first().click();

    await page.getByPlaceholder(/tu@email\.com/i).fill(email!);
    await page.getByPlaceholder(/tu contraseña|contraseña/i).first().fill(password);
    await page.getByRole("button", { name: /iniciar sesión/i }).last().click();

    // El modal se cierra y entra a la app
    await expect(page).toHaveURL(/dashboard|vision|onboarding/i, { timeout: 15000 });
  });
});
