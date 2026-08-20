/**
 * Tests del manejador de errores global.
 *
 * QUÉ PROTEGEN. Hasta el 20/08/2026 el servidor NO tenía manejador de errores.
 * Un fallo de validación en una ruta salía como un 500 seco de Express, sin
 * registro y sin explicación. Eso es lo que hizo invisible durante meses que
 * «sustituir ingrediente» fallaba en todas las peticiones: el usuario veía
 * "inténtalo de nuevo" y no había forma de saber por qué.
 *
 * Regla que fijan estos tests:
 *   · error de validación (Zod) → 400 diciendo QUÉ campo falla
 *   · cualquier otro error      → 500 genérico, SIN filtrar detalles internos
 *
 * Se ejecutan con el runner incorporado de Node:
 *   node --test test/
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { errorHandler, isZodError, zodIssuesToDetails } from "../src/middlewares/errorHandler.ts";

/** Doble mínimo de la respuesta de Express: registra estado y cuerpo. */
function fakeRes() {
  const state = { status: 0, body: undefined as any, headersSent: false };
  return {
    state,
    get headersSent() {
      return state.headersSent;
    },
    status(code: number) {
      state.status = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  };
}

const fakeReq = { url: "/api/meals/replace-ingredient", method: "POST" };

/** Un ZodError real tiene name "ZodError" y un array `issues`. */
const errorDeValidacion = {
  name: "ZodError",
  issues: [
    { path: ["mealPlanId"], message: "Required" },
    { path: ["ingredientName"], message: "Required" },
  ],
};

describe("isZodError — detección por forma, no por clase", () => {
  test("reconoce un error de validación", () => {
    assert.equal(isZodError(errorDeValidacion), true);
  });

  test("no confunde un error normal con uno de validación", () => {
    assert.equal(isZodError(new Error("la base de datos se cayó")), false);
  });

  test("no revienta con null ni con tipos raros", () => {
    assert.equal(isZodError(null), false);
    assert.equal(isZodError(undefined), false);
    assert.equal(isZodError("ZodError"), false);
    assert.equal(isZodError(42), false);
  });

  test("exige que issues sea un array (no basta con el nombre)", () => {
    assert.equal(isZodError({ name: "ZodError" }), false);
    assert.equal(isZodError({ name: "ZodError", issues: "vaya" }), false);
  });
});

describe("errorHandler — qué responde", () => {
  test("un error de validación devuelve 400, NO 500", () => {
    const res = fakeRes();
    errorHandler(errorDeValidacion, fakeReq as any, res as any, () => {});
    assert.equal(res.state.status, 400, "debe ser 400: el cliente mandó algo mal, no falló el servidor");
  });

  test("el 400 dice QUÉ campos fallan", () => {
    const res = fakeRes();
    errorHandler(errorDeValidacion, fakeReq as any, res as any, () => {});
    const campos = res.state.body.details.map((d: any) => d.field);
    assert.deepEqual(campos, ["mealPlanId", "ingredientName"]);
  });

  test("cualquier otro error devuelve 500", () => {
    const res = fakeRes();
    errorHandler(new Error("connect ECONNREFUSED"), fakeReq as any, res as any, () => {});
    assert.equal(res.state.status, 500);
  });

  test("el 500 NO filtra detalles internos al cliente", () => {
    const res = fakeRes();
    const secreto = new Error("password=hunter2 en postgresql://user:pass@host/db");
    errorHandler(secreto, fakeReq as any, res as any, () => {});
    const cuerpo = JSON.stringify(res.state.body);
    assert.ok(!cuerpo.includes("hunter2"), "el mensaje interno no puede llegar al cliente");
    assert.ok(!cuerpo.includes("postgresql://"), "la cadena de conexión no puede llegar al cliente");
    assert.equal(res.state.body.error, "Error interno del servidor");
  });

  test("si la respuesta ya salió, no intenta responder otra vez", () => {
    const res = fakeRes();
    res.state.headersSent = true;
    errorHandler(new Error("tarde"), fakeReq as any, res as any, () => {});
    assert.equal(res.state.status, 0, "no debe tocar una respuesta ya enviada");
    assert.equal(res.state.body, undefined);
  });
});

describe("zodIssuesToDetails — formato legible", () => {
  test("aplana rutas anidadas con puntos", () => {
    const salida = zodIssuesToDetails([
      { path: ["chosenReplacement", "name"], message: "Required" },
    ]);
    assert.deepEqual(salida, [{ field: "chosenReplacement.name", message: "Required" }]);
  });

  test("una ruta vacía queda como campo vacío, sin romper", () => {
    const salida = zodIssuesToDetails([{ path: [], message: "Expected object" }]);
    assert.deepEqual(salida, [{ field: "", message: "Expected object" }]);
  });
});
