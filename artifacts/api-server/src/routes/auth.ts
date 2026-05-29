import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { publicLimiter } from "../middlewares/rate-limiters";

const router: IRouter = Router();

router.get("/auth/user", publicLimiter, (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

export default router;
