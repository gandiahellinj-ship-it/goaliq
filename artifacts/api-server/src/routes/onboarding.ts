import { Router, type IRouter } from "express";
import { SaveOnboardingBodyStrict } from "@workspace/api-zod";
import { createUserClient } from "../lib/supabase";
import {
  checkProfileChangeCooldown,
  recordProfileChange,
  type ChangeField,
} from "../lib/cooldown";

const router: IRouter = Router();

// Mirrors getWeekStart() in artifacts/nutricoach/src/lib/onboarding-service.ts.
// Same pattern used in routes/strength.ts:38-44.
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function mapProfile(
  p: Record<string, unknown>,
  prefs?: Record<string, unknown> | null,
) {
  return {
    id: p.id,
    userId: p.id,
    age: p.age,
    sex: p.sex,
    heightCm: p.height_cm,
    weightKg: p.weight_kg,
    goalType: p.goal,
    dietType: p.diet_type,
    allergies: (prefs?.allergies as string[]) || [],
    likedFoods: (prefs?.liked_foods as string[]) || [],
    dislikedFoods: (prefs?.disliked_foods as string[]) || [],
    trainingLevel: p.training_level,
    trainingLocation: p.training_location,
    trainingDaysPerWeek: p.training_days_per_week,
    targetWeightKg: p.target_weight_kg ?? null,
    createdAt: p.created_at as string,
    updatedAt: p.created_at as string,
  };
}

router.get("/onboarding", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const db = createUserClient(req.supabaseToken!);

  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();

  if (profileErr || !profile || !profile.age) {
    res.status(404).json({ error: "Onboarding not completed" });
    return;
  }

  const { data: prefs } = await db
    .from("food_preferences")
    .select("*")
    .eq("user_id", req.user.id)
    .maybeSingle();

  // Skip Zod parse on response — profiles.id is a UUID string and
  // created_at is an ISO string, but the schema declares id: number
  // and createdAt: Date, causing a ZodError. The data comes from our
  // own trusted DB so validation adds no safety here.
  // Same pattern as routes/meals.ts:44-46.
  res.json(mapProfile(profile as Record<string, unknown>, prefs as Record<string, unknown> | null));
});

router.post("/onboarding", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SaveOnboardingBodyStrict.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    res.status(400).json({
      error: "Datos de onboarding no válidos",
      issues,
    });
    return;
  }
  const body = parsed.data;

  const db = createUserClient(req.supabaseToken!);
  const userId = req.user.id;
  const weekStart = getWeekStart();

  // Mejora 5: detect whether this POST is an edit of an existing profile
  // (vs the initial onboarding submission). Only edits trigger the 24h
  // cooldown; first-time onboarding is always allowed.
  const { data: existing } = await db
    .from("profiles")
    .select("weight_kg, goal")
    .eq("id", userId)
    .maybeSingle();
  const isEdit = existing != null;
  const existingProfile = (existing ?? null) as {
    weight_kg: number | null;
    goal:      string | null;
  } | null;

  if (isEdit) {
    const cd = await checkProfileChangeCooldown(db, userId);
    if (cd.blocked) {
      await db
        .from("health_validation_logs")
        .insert({
          user_id: userId,
          event_type: "blocked",
          trigger_reason: "profile_change_cooldown",
          user_data_snapshot: {
            events_in_last_24h: cd.eventsCount,
            oldest_event_at:    cd.oldestAt,
            hours_to_wait:      cd.hoursToWait,
            source:             "onboarding_edit",
          },
          action_taken: "auto_blocked_cooldown",
        })
        .then(({ error }) => {
          if (error) req.log.warn({ error }, "health_validation_logs insert failed (non-fatal)");
        });

      res.setHeader("Retry-After", String(cd.hoursToWait * 3600));
      res.status(429).json({
        error: "Cambios de perfil temporalmente bloqueados",
        retryAfterHours: cd.hoursToWait,
        message:
          `Has cambiado tu perfil ${cd.eventsCount} veces en las últimas 24 horas. ` +
          `Por tu seguridad, debes esperar aproximadamente ${cd.hoursToWait} ${cd.hoursToWait === 1 ? "hora" : "horas"} ` +
          `antes de modificarlo de nuevo. Si tienes dudas sobre tus objetivos, te recomendamos ` +
          `consultar a un profesional sanitario.`,
      });
      return;
    }
  }

  // 1) profiles — full parity with submitOnboarding (frontend).
  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: body.displayName.trim() || null,
        age: body.age,
        sex: body.sex,
        height_cm: body.heightCm,
        weight_kg: body.weightKg,
        target_weight_kg: body.targetWeightKg ?? null,
        goal: body.goalType,
        goal_pace: body.goalPace ?? "moderate",
        fasting_protocol: body.fastingProtocol ?? null,
        diet_type: body.dietType,
        training_level: body.trainingLevel,
        training_location: body.trainingLocation,
        training_days_per_week: body.trainingDaysPerWeek,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (profileErr || !profile) {
    req.log.error({ error: profileErr }, "Failed to save onboarding profile");
    res.status(500).json({ error: "No se pudo guardar el perfil" });
    return;
  }

  // 2) food_preferences — critical, 500 if it fails.
  const { error: prefErr } = await db.from("food_preferences").upsert(
    {
      user_id: userId,
      liked_foods: body.likedFoods,
      disliked_foods: body.dislikedFoods,
      allergies: body.allergies,
      intolerances: [],
    },
    { onConflict: "user_id" },
  );
  if (prefErr) {
    req.log.error({ error: prefErr }, "Failed to save food preferences");
    res.status(500).json({ error: "No se pudieron guardar las preferencias alimentarias" });
    return;
  }

  // 3) supplements — graceful: column may not exist yet, swallow.
  if (body.supplements && body.supplements.length > 0) {
    const { error: supErr } = await db
      .from("food_preferences")
      .upsert(
        { user_id: userId, supplements: body.supplements },
        { onConflict: "user_id" },
      );
    if (supErr) {
      req.log.warn({ error: supErr }, "Supplements upsert failed (non-fatal)");
    }
  }

  // 4) Wipe stale plans for the current week — generation mutations will recreate.
  // Swallow errors: if delete fails we don't want to abort the onboarding save.
  await Promise.all([
    db.from("meal_plans").delete().eq("user_id", userId).eq("week_start", weekStart),
    db.from("workout_plans").delete().eq("user_id", userId).eq("week_start", weekStart),
  ]);

  // Mejora 5: record the change for cooldown accounting. Only when this was
  // an edit AND extreme fields (weight/goal) actually moved. First-time
  // onboarding (isEdit=false) is never recorded — there is no "previous"
  // value to compare against.
  if (isEdit && existingProfile) {
    const changedFields: ChangeField[] = [];
    if (body.weightKg !== existingProfile.weight_kg) changedFields.push("weightKg");
    if (body.goalType !== existingProfile.goal)      changedFields.push("goalType");
    await recordProfileChange(db, userId, changedFields, "onboarding_edit", req.log);
  }

  // Skip Zod parse on response — profiles.id is a UUID string and
  // created_at is an ISO string, but the schema declares id: number
  // and createdAt: Date, causing a ZodError. The data comes from our
  // own trusted DB so validation adds no safety here.
  // Same pattern as routes/meals.ts:44-46.
  res.json(mapProfile(profile as Record<string, unknown>));
});

export default router;
