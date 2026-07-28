import { test, expect } from "@playwright/test";
import { requiereStaging, emailDePrueba, PASSWORD_DE_PRUEBA } from "./helpers";

// Recorrido 1 — REGISTRO de una cuenta nueva (con código beta de staging).
// NOTA: selectores por confirmar contra staging real la primera vez que se ejecute.
test.describe("Registro", () => {
  requiereStaging();

  test("un usuario nuevo puede registrarse con código beta", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /iniciar sesión/i }).first().click();

    // Cambiar a la pestaña de registro dentro del modal
    await page.getByRole("button", { name: /registrarse|regístrate/i }).first().click();

    await page.getByPlaceholder(/tu nombre/i).fill("Tester");
    await page.getByPlaceholder(/tu@email\.com/i).fill(emailDePrueba("registro"));
    await page.getByPlaceholder(/mínimo 6|contraseña/i).first().fill(PASSWORD_DE_PRUEBA);
    await page.getByPlaceholder(/GOALIQ-BETA|código/i).fill(process.env.E2E_BETA_CODE ?? "");

    // Aceptar RGPD y crear cuenta
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    // Tras el registro debe entrar al onboarding o al dashboard
    await expect(page).toHaveURL(/onboarding|dashboard|vision/i, { timeout: 15000 });
  });
});
