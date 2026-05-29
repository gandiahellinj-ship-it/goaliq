import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { publicLimiter } from "../middlewares/rate-limiters";

const router: IRouter = Router();

router.get("/healthz", publicLimiter, (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
