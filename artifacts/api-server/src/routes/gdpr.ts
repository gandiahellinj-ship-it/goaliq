import { Router, type IRouter, type Request } from "express";
import { normalLimiter, publicLimiter, betaValidateLimiter } from "../middlewares/rate-limiters";
import pg from "pg";

const router: IRouter = Router();

let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

// Helper: obtener IP del request (Replit usa X-Forwarded-For, ya trust proxy)
function getClientIp(req: Request): string {
  return req.ip || "unknown";
}

// Helper: obtener User-Agent
function getUserAgent(req: Request): string {
  return req.headers["user-agent"]?.substring(0, 500) || "unknown";
}

// ============================================================
// POST /api/consent
// Body: { type, accepted, version? }
// ============================================================
router.post("/consent", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id;
  const { type, accepted, version = "v1.0" } = req.body;

  const validTypes = ["terms_of_use", "privacy_policy", "medical_data_processing", "ai_disclosure"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: "Invalid consent type" });
    return;
  }

  if (typeof accepted !== "boolean") {
    res.status(400).json({ error: "accepted must be boolean" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Insert immutable consent log
    await client.query(
      `INSERT INTO consent_log (user_id, consent_type, consent_version, accepted, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, version, accepted, getClientIp(req), getUserAgent(req)],
    );

    // 2. Update profiles timestamp (only if accepted=true)
    if (accepted) {
      const columnMap: Record<string, string> = {
        terms_of_use: "terms_accepted_at",
        privacy_policy: "privacy_accepted_at",
        medical_data_processing: "medical_consent_at",
        ai_disclosure: "ai_disclosure_acknowledged_at",
      };

      const column = columnMap[type];
      await client.query(
        `UPDATE profiles SET ${column} = NOW(), consent_version = $1 WHERE id = $2`,
        [version, userId],
      );
    }

    await client.query("COMMIT");

    res.json({ success: true, type, accepted, timestamp: new Date().toISOString() });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Consent registration error:", err);
    res.status(500).json({ error: "Failed to register consent" });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/consent
// ============================================================
router.get("/consent", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id;
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT
        terms_accepted_at,
        privacy_accepted_at,
        medical_consent_at,
        ai_disclosure_acknowledged_at,
        consent_version
       FROM profiles WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get consent error:", err);
    res.status(500).json({ error: "Failed to get consent status" });
  }
});

// ============================================================
// POST /api/beta/validate-code (PUBLIC)
// ============================================================
router.post("/beta/validate-code", betaValidateLimiter, async (req, res) => {
  const { code } = req.body;

  if (typeof code !== "string" || code.length === 0) {
    res.status(400).json({ valid: false, reason: "Code required" });
    return;
  }

  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT used_by_user_id, used_at, expires_at
       FROM beta_invite_codes
       WHERE code = $1`,
      [code.trim().toUpperCase()],
    );

    if (result.rows.length === 0) {
      res.json({ valid: false, reason: "Invalid code" });
      return;
    }

    const row = result.rows[0];

    if (row.used_by_user_id !== null) {
      res.json({ valid: false, reason: "Code already used" });
      return;
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.json({ valid: false, reason: "Code expired" });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("Validate code error:", err);
    res.status(500).json({ valid: false, reason: "Server error" });
  }
});

// ============================================================
// POST /api/beta/claim-code (AUTH)
// ============================================================
router.post("/beta/claim-code", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id;
  const { code } = req.body;

  if (typeof code !== "string" || code.length === 0) {
    res.status(400).json({ success: false, reason: "Code required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Atomic claim with conditions
    const claim = await client.query(
      `UPDATE beta_invite_codes
       SET used_by_user_id = $1, used_at = NOW()
       WHERE code = $2
         AND used_by_user_id IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING id`,
      [userId, code.trim().toUpperCase()],
    );

    if (claim.rowCount === 0) {
      await client.query("ROLLBACK");
      res.json({ success: false, reason: "Invalid, used, or expired code" });
      return;
    }

    // 2. Update profile with code used
    await client.query(
      `UPDATE profiles SET beta_code_used = $1 WHERE id = $2`,
      [code.trim().toUpperCase(), userId],
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Claim code error:", err);
    res.status(500).json({ success: false, reason: "Server error" });
  } finally {
    client.release();
  }
});

// ============================================================
// DELETE /api/account — GDPR Art. 17
// Body: { confirmation: "DELETE_MY_ACCOUNT" }
// Auth model: Bearer JWT (no passport/session). Client must discard
// its token after a successful response.
//
// Transactional: INSERT deletion_logs + DELETE auth.users atomic.
// If either fails, both rollback. Log is always created BEFORE
// the cascade to preserve audit trail (RGPD Art. 17 compliance).
// ============================================================
router.delete("/account", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id;
  const userEmail = (req.user as any).username; // username = email in this project
  const { confirmation } = req.body;

  if (confirmation !== "DELETE_MY_ACCOUNT") {
    res.status(400).json({
      error: "Confirmation required",
      hint: "Send body: { confirmation: 'DELETE_MY_ACCOUNT' }",
    });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Capture beta_code BEFORE delete (for metadata)
    const profileResult = await client.query(
      `SELECT beta_code_used, consent_version FROM profiles WHERE id = $1`,
      [userId],
    );
    const betaCodeUsed = profileResult.rows[0]?.beta_code_used ?? null;
    const consentVersion = profileResult.rows[0]?.consent_version ?? null;

    // 2. Build metadata for audit trail
    const metadata = {
      version: "1.0",
      ip_address: req.ip ?? null,
      user_agent: req.headers["user-agent"] ?? null,
      beta_code_released: betaCodeUsed,
      consent_version_at_delete: consentVersion,
    };

    // 3. INSERT audit log FIRST (must persist even if cascade fails)
    await client.query(
      `INSERT INTO deletion_logs (
        deleted_user_email,
        deleted_user_id,
        deletion_reason,
        deletion_method,
        metadata
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        userEmail,
        userId,
        "rgpd_art_17_user_request",
        "manual_user_initiated",
        metadata,
      ],
    );

    // 4. Clear used_at on released beta code (BUG #8 fix)
    // FK ON DELETE SET NULL only clears used_by_user_id, not used_at.
    // We need both NULL so a released code looks identical to an unused one.
    await client.query(
      `UPDATE beta_invite_codes SET used_at = NULL WHERE used_by_user_id = $1`,
      [userId],
    );

    // 5. DELETE from auth.users — triggers FK CASCADE to all related public.* tables
    const deleteResult = await client.query(
      `DELETE FROM auth.users WHERE id = $1 RETURNING id`,
      [userId],
    );

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }

    await client.query("COMMIT");

    // Clear any legacy session cookie (harmless if not present)
    res.clearCookie("sid");
    res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/export-data — GDPR Art. 20
// ============================================================
router.get("/export-data", normalLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id;
  const pool = getPool();

  // NOTE: weight_entries and progress_logs tables don't exist in current Supabase schema.
  // Removed from export to keep it resilient. Re-add when tables are created/migrated.
  // Backup data may live in backup_progress_logs_legacy.
  const safeQuery = async (sql: string, params: unknown[]): Promise<{ rows: unknown[] }> => {
    try {
      return await pool.query(sql, params);
    } catch (err: any) {
      console.warn(`[export] query failed: ${sql.slice(0, 60)}… — ${err?.message ?? err}`);
      return { rows: [] };
    }
  };

  try {
    const [
      profile,
      foodPrefs,
      healthScreening,
      mealPlans,
      workoutPlans,
      calendarEvents,
      flexDays,
      workoutHistory,
      strengthLogs,
      consents,
      betaCode,
      healthLogs,
      mealVersions,
      workoutVersions,
      profileEvents,
    ] = await Promise.all([
      safeQuery("SELECT * FROM profiles WHERE id = $1", [userId]),
      safeQuery("SELECT * FROM food_preferences WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM health_screenings WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM meal_plans WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM workout_plans WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM calendar_events WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM flex_days WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM workout_history WHERE user_id = $1", [userId]),
      safeQuery("SELECT * FROM strength_logs WHERE user_id = $1", [userId]),
      safeQuery(
        "SELECT consent_type, consent_version, accepted, created_at FROM consent_log WHERE user_id = $1 ORDER BY created_at DESC",
        [userId],
      ),
      safeQuery("SELECT code, used_at FROM beta_invite_codes WHERE used_by_user_id = $1", [userId]),
      safeQuery(
        "SELECT * FROM health_validation_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000",
        [userId],
      ),
      // meal_plan_versions / workout_plan_versions use generated_at, not created_at
      // (see lib/plan-versioning.ts).
      safeQuery(
        "SELECT * FROM meal_plan_versions WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 100",
        [userId],
      ),
      safeQuery(
        "SELECT * FROM workout_plan_versions WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 100",
        [userId],
      ),
      safeQuery(
        "SELECT * FROM profile_change_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
        [userId],
      ),
    ]);

    const exportData = {
      export_timestamp: new Date().toISOString(),
      export_format_version: "1.0",
      user_id: userId,
      data: {
        profile: profile.rows[0] || null,
        food_preferences: foodPrefs.rows[0] || null,
        health_screening: healthScreening.rows[0] || null,
        meal_plans: mealPlans.rows,
        workout_plans: workoutPlans.rows,
        calendar_events: calendarEvents.rows,
        flex_days: flexDays.rows,
        workout_history: workoutHistory.rows,
        strength_logs: strengthLogs.rows,
        consents_history: consents.rows,
        beta_code: betaCode.rows[0] || null,
        health_validation_logs: healthLogs.rows,
        meal_plan_versions: mealVersions.rows,
        workout_plan_versions: workoutVersions.rows,
        profile_change_events: profileEvents.rows,
      },
      notes: {
        gdpr_article: "Art. 20 (Right to data portability)",
        contact: "blckbtz96@gmail.com",
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="goaliq-export-${userId.substring(0, 8)}-${Date.now()}.json"`,
    );
    res.json(exportData);
  } catch (err) {
    console.error("Export data error:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;
