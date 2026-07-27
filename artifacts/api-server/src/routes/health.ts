import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { publicLimiter } from "../middlewares/rate-limiters";

const router: IRouter = Router();

router.get("/healthz", publicLimiter, (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api — el healthcheck/preview de Replit (artifact.toml: paths=["/api"],
// previewPath="/api") pega aquí; sin ruta daba 404/500 y ensuciaba los logs.
// Devolvemos 200 para que el probe pase, apunte a /api o a /api/healthz.
router.get("/", publicLimiter, (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
