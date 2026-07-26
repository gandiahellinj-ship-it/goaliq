import { Router, type IRouter } from "express";
import { getOrCreateDishImage, diagnoseDishImages, resetFailedDish, type DishInput } from "../lib/dishImages";
import { normalLimiter } from "../middlewares/rate-limiters";

const router: IRouter = Router();

// GET /api/dish-image/diagnose — lo responde el servidor DESPLEGADO: qué variables
// ve (sí/no, nunca el valor), esquema REAL de dish_images vs. lo que el código
// espera, y conteo por estado. Sesión requerida (solo booleanos + nombres de columna).
router.get("/dish-image/diagnose", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(await diagnoseDishImages());
});

// POST /api/dish-image/reset — borra las filas 'failed' de un plato (levanta el
// veto anti-bucle para poder reintentar). Sesión requerida.
router.post("/dish-image/reset", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const mealName = typeof body.meal_name === "string" ? body.meal_name.trim() : "";
  if (!mealName) {
    res.status(400).json({ error: "meal_name requerido" });
    return;
  }
  const deleted = await resetFailedDish({
    meal_name: mealName,
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    is_drink: Boolean(body.is_drink),
  });
  res.json({ deleted });
});

// POST /api/dish-image
// Devuelve { url } (string o null) de la foto del plato. Genera bajo demanda con
// caché COMPARTIDA. Requiere sesión (evita que anónimos disparen generaciones que
// cuestan dinero). Nunca bloquea nada: si no hay foto, url = null → iniciales.
router.post("/dish-image", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const mealName = typeof body.meal_name === "string" ? body.meal_name.trim() : "";
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!mealName) {
    res.status(400).json({ error: "meal_name requerido" });
    return;
  }
  const dish: DishInput = {
    meal_name: mealName,
    ingredients,
    is_drink: Boolean(body.is_drink),
  };
  const result = await getOrCreateDishImage(dish); // nunca lanza
  // Devuelve también `error` (motivo del fallo) para diagnóstico — beta, sesión requerida.
  res.json(result);
});

export default router;
