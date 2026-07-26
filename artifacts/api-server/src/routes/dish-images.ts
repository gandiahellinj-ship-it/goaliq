import { Router, type IRouter } from "express";
import { getOrCreateDishImage, type DishInput } from "../lib/dishImages";
import { normalLimiter } from "../middlewares/rate-limiters";

const router: IRouter = Router();

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
