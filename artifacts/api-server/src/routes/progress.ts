import { Router, type IRouter } from "express";
import { GetProgressResponse, UpdateProgressBody, UpdateProgressResponse } from "@workspace/api-zod";
import { createUserClient } from "../lib/supabase";

const router: IRouter = Router();

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

router.get("/progress", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const db = createUserClient(req.supabaseToken!);
    const { start, end } = getWeekRange();

    const [{ data: profiles }, { data: weightEntries }, { data: weeklyEvents }] = await Promise.all([
      db.from("profiles").select("weight_kg, target_weight_kg").eq("id", req.user.id).limit(1),
      db.from("progress_logs").select("log_date, weight_kg").eq("user_id", req.user.id).order("log_date", { ascending: true }),
      db.from("calendar_events").select("event_type, is_completed").eq("user_id", req.user.id).gte("date", start).lte("date", end),
    ]);

    const profile = profiles?.[0];
    const entries = weightEntries || [];
    const startWeightKg = entries.length > 0 ? entries[0].weight_kg : (profile?.weight_kg ?? 70);
    const currentWeightKg = entries.length > 0 ? entries[entries.length - 1].weight_kg : startWeightKg;

    const workoutRows = (weeklyEvents || []).filter((e: any) => e.event_type === "workout");
    const completedWorkouts = workoutRows.filter((e: any) => e.is_completed).length;
    const adherencePercent = workoutRows.length > 0
      ? Math.round((completedWorkouts / workoutRows.length) * 100) : 0;

    res.json(GetProgressResponse.parse({
      currentWeightKg,
      targetWeightKg: profile?.target_weight_kg ?? null,
      startWeightKg,
      weeklyAdherencePercent: adherencePercent,
      completedWorkoutsThisWeek: completedWorkouts,
      totalWorkoutsThisWeek: workoutRows.length,
      weightHistory: entries.map((e: any) => ({ date: e.log_date, weightKg: e.weight_kg })),
    }));
  } catch (err) {
    req.log.error({ err }, "[progress] GET failed");
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

router.post("/progress", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const body = UpdateProgressBody.parse(req.body);
    const db = createUserClient(req.supabaseToken!);
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await db
      .from("progress_logs")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("log_date", today)
      .maybeSingle();

    if (existing) {
      await db.from("progress_logs").update({ weight_kg: body.weightKg }).eq("user_id", req.user.id).eq("log_date", today);
    } else {
      await db.from("progress_logs").insert({ user_id: req.user.id, log_date: today, weight_kg: body.weightKg });
    }

    const { start, end } = getWeekRange();
    const [{ data: profiles }, { data: weightEntries }, { data: weeklyEvents }] = await Promise.all([
      db.from("profiles").select("weight_kg, target_weight_kg").eq("id", req.user.id).limit(1),
      db.from("progress_logs").select("log_date, weight_kg").eq("user_id", req.user.id).order("log_date", { ascending: true }),
      db.from("calendar_events").select("event_type, is_completed").eq("user_id", req.user.id).gte("date", start).lte("date", end),
    ]);

    const profile = profiles?.[0];
    const entries = weightEntries || [];
    const startWeightKg = entries.length > 0 ? entries[0].weight_kg : (profile?.weight_kg ?? 70);
    const workoutRows = (weeklyEvents || []).filter((e: any) => e.event_type === "workout");
    const completedWorkouts = workoutRows.filter((e: any) => e.is_completed).length;
    const adherencePercent = workoutRows.length > 0
      ? Math.round((completedWorkouts / workoutRows.length) * 100) : 0;

    res.json(UpdateProgressResponse.parse({
      currentWeightKg: body.weightKg,
      targetWeightKg: profile?.target_weight_kg ?? null,
      startWeightKg,
      weeklyAdherencePercent: adherencePercent,
      completedWorkoutsThisWeek: completedWorkouts,
      totalWorkoutsThisWeek: workoutRows.length,
      weightHistory: entries.map((e: any) => ({ date: e.log_date, weightKg: e.weight_kg })),
    }));
  } catch (err) {
    req.log.error({ err }, "[progress] POST failed");
    res.status(500).json({ error: "Failed to save progress" });
  }
});

export default router;
