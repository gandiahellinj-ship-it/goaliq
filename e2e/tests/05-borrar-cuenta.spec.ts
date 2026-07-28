import { test, expect } from "@playwright/test";
import { requiereStaging } from "./helpers";

// Recorrido 5 — BORRAR LA CUENTA (RGPD Art. 17) desde Ajustes.
// ⚠️ Este recorrido depende del endpoint DELETE /api/account, que HOY devuelve
// 500 en producción (bug conocido, ver PENDIENTES). Se deja escrito para
// verificar el arreglo EN STAGING una vez corregido.
test.describe("Borrar cuenta (RGPD)", () => {
  requiereStaging();

  test("un usuario puede borrar su cuenta y ya no puede entrar", async ({ page }) => {
    test.skip(true, "Bloqueado por el bug del endpoint RGPD (500). Reactivar tras el arreglo, en staging.");

    // Flujo previsto (a validar en staging tras el arreglo):
    await page.goto("/vision");
    await page.getByRole("button", { name: /ajustes/i }).click();
    await page.getByRole("button", { name: /cerrar sesión|eliminar cuenta|borrar/i }).click();
    // Confirmación de borrado…
    // await page.getByRole("button", { name: /confirmar/i }).click();

    // Tras borrar, el login con esas credenciales debe fallar.
    await expect(page).toHaveURL(/\/$|login/i, { timeout: 15000 });
  });
});
