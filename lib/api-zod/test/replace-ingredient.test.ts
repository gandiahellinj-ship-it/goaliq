/**
 * Tests de regresión de «sustituir ingrediente» (Paso 2 del plan de ESTADO.md).
 *
 * QUÉ PROTEGEN. `POST /api/meals/replace-ingredient` falló el 100 % de las
 * peticiones desde que se escribió, por TRES errores encadenados en los
 * esquemas de este paquete:
 *   1. `ReplaceIngredientBody` exigía `mealId`, que el navegador nunca envía.
 *   2. Declaraba `mealPlanId` como número, cuando en Supabase es un UUID (texto).
 *   3. `ReplaceIngredientResponse` exigía campos inexistentes (`id`,
 *      `portionIdea`, `plateDistribution`) y no admitía `snack_morning` ni
 *      `snack_afternoon`, así que reventaba al responder aunque la petición
 *      fuese válida.
 *
 * Estos tests FALLABAN con los esquemas anteriores y PASAN con los corregidos.
 *
 * Se ejecutan con el runner incorporado de Node (sin dependencias nuevas):
 *   node --test lib/api-zod/test/
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ReplaceIngredientBody, ReplaceIngredientResponse } from "../src/generated/api.ts";

/**
 * El cuerpo EXACTO que envía el navegador hoy.
 * Fuente: nutricoach/src/lib/supabase-queries.ts → useSwapIngredient
 *         nutricoach/src/pages/Meals.tsx:571 → swapMutation.mutate({...})
 * Si alguien cambia el cliente, este objeto debe cambiar con él.
 */
const CUERPO_REAL_DEL_NAVEGADOR = {
  mealPlanId: "8f14e45f-ceea-467a-9575-3c2c1a1f9b21", // UUID de Supabase, NO un número
  dayOfWeek: "monday",
  mealType: "lunch",
  ingredientName: "Arroz cocido",
  lang: "es",
  chosenReplacement: { name: "Quinoa cocida", amount: "80 g" },
};

/**
 * Una comida REAL tal y como la guarda el plan.
 * Fuente: api-server/src/lib/aiGenerators.ts (objeto que se apila en `byDay`).
 * Ojo a lo que NO tiene: ni `id`, ni `portionIdea`, ni `plateDistribution`.
 */
const COMIDA_REAL_DEL_PLAN = {
  mealType: "snack_morning",
  name: "Yogur griego con nueces",
  ingredients: [
    { name: "Yogur griego natural", amount: "200 g", visual_ref: "un vaso", category: "dairy" },
    { name: "Nueces", amount: "20 g", visual_ref: "un puñado pequeño", category: "fats" },
  ],
  plate_distribution: { protein: 40, carbs: 30, fat: 30 },
  calories: 320,
  notes: "Tomar 2 h después del desayuno.",
};

describe("ReplaceIngredientBody — lo que envía el navegador", () => {
  test("acepta el cuerpo real del navegador (el bug original)", () => {
    const r = ReplaceIngredientBody.safeParse(CUERPO_REAL_DEL_NAVEGADOR);
    assert.equal(
      r.success,
      true,
      "El esquema rechaza el cuerpo que el navegador envía de verdad. " +
        "Esto es exactamente el fallo que hacía que sustituir un ingrediente " +
        "nunca funcionara. Problemas: " +
        (r.success ? "" : JSON.stringify(r.error.issues)),
    );
  });

  test("NO exige mealId (el campo fantasma que rompía todo)", () => {
    // El cliente nunca lo ha enviado. Si alguien lo vuelve a poner obligatorio,
    // este test cae.
    assert.equal(ReplaceIngredientBody.safeParse(CUERPO_REAL_DEL_NAVEGADOR).success, true);
  });

  test("acepta mealPlanId como UUID (texto), que es lo que hay en Supabase", () => {
    const r = ReplaceIngredientBody.safeParse({
      ...CUERPO_REAL_DEL_NAVEGADOR,
      mealPlanId: "8f14e45f-ceea-467a-9575-3c2c1a1f9b21",
    });
    assert.equal(r.success, true);
  });

  test("acepta también mealPlanId numérico (compatibilidad histórica)", () => {
    const r = ReplaceIngredientBody.safeParse({ ...CUERPO_REAL_DEL_NAVEGADOR, mealPlanId: 42 });
    assert.equal(r.success, true);
  });

  test("chosenReplacement es opcional: sin él, la alternativa la elige la IA", () => {
    const { chosenReplacement, ...sinEleccion } = CUERPO_REAL_DEL_NAVEGADOR;
    const r = ReplaceIngredientBody.safeParse(sinEleccion);
    assert.equal(r.success, true);
  });

  test("lang es opcional", () => {
    const { lang, ...sinIdioma } = CUERPO_REAL_DEL_NAVEGADOR;
    assert.equal(ReplaceIngredientBody.safeParse(sinIdioma).success, true);
  });

  test("acepta los 5 tipos de comida reales, incluidos los dos tentempiés", () => {
    for (const mealType of [
      "breakfast",
      "snack_morning",
      "lunch",
      "snack_afternoon",
      "dinner",
    ]) {
      const r = ReplaceIngredientBody.safeParse({ ...CUERPO_REAL_DEL_NAVEGADOR, mealType });
      assert.equal(r.success, true, `Rechaza mealType="${mealType}", que sí existe en los planes`);
    }
  });
});

describe("ReplaceIngredientBody — sigue rechazando lo que debe", () => {
  test("rechaza si falta ingredientName", () => {
    const { ingredientName, ...malo } = CUERPO_REAL_DEL_NAVEGADOR;
    assert.equal(ReplaceIngredientBody.safeParse(malo).success, false);
  });

  test("rechaza un día de la semana inventado", () => {
    const r = ReplaceIngredientBody.safeParse({ ...CUERPO_REAL_DEL_NAVEGADOR, dayOfWeek: "lunes" });
    assert.equal(r.success, false, "dayOfWeek debe seguir siendo un enum cerrado en inglés");
  });

  test("rechaza mealPlanId vacío", () => {
    const r = ReplaceIngredientBody.safeParse({ ...CUERPO_REAL_DEL_NAVEGADOR, mealPlanId: "" });
    assert.equal(r.success, false);
  });

  test("rechaza un cuerpo vacío", () => {
    assert.equal(ReplaceIngredientBody.safeParse({}).success, false);
  });

  test("el error de validación dice QUÉ campo falla (para el 400 con detalle)", () => {
    const r = ReplaceIngredientBody.safeParse({});
    assert.equal(r.success, false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path.join("."));
      assert.ok(campos.includes("mealPlanId"), "debe señalar mealPlanId");
      assert.ok(campos.includes("ingredientName"), "debe señalar ingredientName");
    }
  });
});

describe("ReplaceIngredientResponse — describe la comida real del plan", () => {
  test("acepta una comida real tal y como está guardada", () => {
    const r = ReplaceIngredientResponse.safeParse(COMIDA_REAL_DEL_PLAN);
    assert.equal(
      r.success,
      true,
      "El esquema de respuesta no describe la comida real. " +
        (r.success ? "" : JSON.stringify(r.error.issues)),
    );
  });

  test("no exige un id que la comida no tiene", () => {
    assert.ok(!("id" in COMIDA_REAL_DEL_PLAN), "las comidas del plan no llevan id");
    assert.equal(ReplaceIngredientResponse.safeParse(COMIDA_REAL_DEL_PLAN).success, true);
  });

  test("admite snack_morning y snack_afternoon", () => {
    for (const mealType of ["snack_morning", "snack_afternoon"]) {
      const r = ReplaceIngredientResponse.safeParse({ ...COMIDA_REAL_DEL_PLAN, mealType });
      assert.equal(r.success, true, `Rechaza mealType="${mealType}"`);
    }
  });

  test("plate_distribution usa protein/carbs/fat y suma 100", () => {
    const d = COMIDA_REAL_DEL_PLAN.plate_distribution;
    assert.equal(d.protein + d.carbs + d.fat, 100);
    assert.equal(ReplaceIngredientResponse.safeParse(COMIDA_REAL_DEL_PLAN).success, true);
  });
});
