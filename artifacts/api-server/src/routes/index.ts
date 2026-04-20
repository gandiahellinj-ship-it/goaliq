import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import onboardingRouter from "./onboarding";
import mealsRouter from "./meals";
import workoutsRouter from "./workouts";
import calendarRouter from "./calendar";
import progressRouter from "./progress";
import stripeRouter from "./stripe";
import exercisesRouter from "./exercises";
import flexDaysRouter from "./flex-days";
import workoutHistoryRouter from "./workout-history";
import strengthRouter from "./strength";
import qaRouter from "./qa";
import qaE2eRouter from "./qa-e2e";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(onboardingRouter);
router.use(mealsRouter);
router.use(workoutsRouter);
router.use(calendarRouter);
router.use(progressRouter);
router.use(stripeRouter);
router.use(exercisesRouter);
router.use(flexDaysRouter);
router.use(workoutHistoryRouter);
router.use(strengthRouter);
router.use(qaRouter);
router.use(qaE2eRouter);

export default router;
