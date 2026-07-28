import { test } from "@playwright/test";

/**
 * Todos los recorridos tocan base de datos → SOLO se ejecutan contra un entorno
 * de STAGING con base de datos de prueba. Si E2E_BASE_URL no está configurada,
 * se marcan como PENDIENTES (skip), nunca se ejecutan contra producción.
 */
export function requiereStaging() {
  test.skip(
    !process.env.E2E_BASE_URL,
    "Pendiente de entorno STAGING — configura e2e/.env (ver e2e/README.md).",
  );
}

/** Email único por ejecución para no colisionar entre recorridos. */
export function emailDePrueba(prefijo = "e2e"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefijo}-${Date.now()}-${rand}@staging.goaliq.test`;
}

export const PASSWORD_DE_PRUEBA = "Staging-E2E-2026-x9";
