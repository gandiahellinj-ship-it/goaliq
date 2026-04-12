import pg from "pg";

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function ensureStripeUsersTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.stripe_users (
      supabase_user_id TEXT PRIMARY KEY,
      email TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE public.stripe_users
    ADD COLUMN IF NOT EXISTS subscription_status TEXT
  `);
  // has_used_trial is a permanent flag — once set true it is never cleared.
  // It allows the checkout session to skip the trial period for returning users.
  await pool.query(`
    ALTER TABLE public.stripe_users
    ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

export async function upsertStripeUser(
  supabaseUserId: string,
  email: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO public.stripe_users (supabase_user_id, email)
     VALUES ($1, $2)
     ON CONFLICT (supabase_user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
    [supabaseUserId, email],
  );
}

export async function getStripeUser(supabaseUserId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM public.stripe_users WHERE supabase_user_id = $1",
    [supabaseUserId],
  );
  return rows[0] || null;
}

export async function updateStripeUserIds(
  supabaseUserId: string,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
  },
): Promise<void> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.stripeCustomerId !== undefined) {
    sets.push(`stripe_customer_id = $${idx++}`);
    values.push(data.stripeCustomerId);
  }
  if (data.stripeSubscriptionId !== undefined) {
    sets.push(`stripe_subscription_id = $${idx++}`);
    values.push(data.stripeSubscriptionId);
    // When linking a real subscription, permanently mark the trial as used.
    // This flag is never cleared — even when the subscription ID is later nulled out.
    if (data.stripeSubscriptionId !== null) {
      sets.push(`has_used_trial = true`);
    }
  }
  if (data.subscriptionStatus !== undefined) {
    sets.push(`subscription_status = $${idx++}`);
    values.push(data.subscriptionStatus);
  }
  if (sets.length === 0) return;

  sets.push(`updated_at = NOW()`);
  values.push(supabaseUserId);
  await pool.query(
    `UPDATE public.stripe_users SET ${sets.join(", ")} WHERE supabase_user_id = $${idx}`,
    values,
  );
}

export async function updateSubscriptionStatusByCustomer(
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  status: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE public.stripe_users
     SET stripe_subscription_id = $2, subscription_status = $3, updated_at = NOW()
     WHERE stripe_customer_id = $1`,
    [stripeCustomerId, stripeSubscriptionId, status],
  );
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "none";

export function isAccessGranted(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export async function getSubscriptionStatus(supabaseUserId: string): Promise<{
  status: SubscriptionStatus;
  hasAccess: boolean;
  trialEndsAt: number | null;
  hasUsedTrial: boolean;
}> {
  const pool = getPool();
  try {
    const user = await getStripeUser(supabaseUserId);
    if (!user) return { status: "none", hasAccess: false, trialEndsAt: null, hasUsedTrial: false };

    const cached = user.subscription_status as SubscriptionStatus | null;
    const hasUsedTrial = user.has_used_trial === true;

    if (!user.stripe_subscription_id) {
      return { status: "none", hasAccess: false, trialEndsAt: null, hasUsedTrial };
    }

    try {
      const { rows } = await pool.query(
        `SELECT status, trial_end, customer FROM stripe.subscriptions WHERE id = $1 LIMIT 1`,
        [user.stripe_subscription_id],
      );
      if (rows.length > 0) {
        const liveStatus = rows[0].status as SubscriptionStatus;
        const subCustomer = rows[0].customer as string | null;

        // Stale-subscription guard: if the subscription in StripeSync belongs to a
        // different customer than the one stored for this user, the sub is from a
        // previous Stripe account (e.g. the old Replit connector). Clear the stale
        // IDs so the app correctly shows the user as inactive and prompts re-subscribe.
        if (subCustomer && user.stripe_customer_id && subCustomer !== user.stripe_customer_id) {
          await updateStripeUserIds(supabaseUserId, {
            stripeSubscriptionId: null,
            subscriptionStatus: null,
          });
          // hasUsedTrial stays true — the stale sub was real, so the trial was used
          return { status: "none", hasAccess: false, trialEndsAt: null, hasUsedTrial: true };
        }

        // trial_end is stored as jsonb by StripeSync — it's a raw UNIX integer (seconds),
        // NOT a date string. Do NOT wrap in new Date() or it'll be treated as milliseconds.
        const rawEnd = rows[0].trial_end;
        const trialEndsAt: number | null =
          rawEnd != null
            ? typeof rawEnd === "number"
              ? rawEnd
              : Math.floor(new Date(rawEnd).getTime() / 1000)
            : null;
        if (liveStatus !== cached) {
          await updateStripeUserIds(supabaseUserId, {
            subscriptionStatus: liveStatus,
          });
        }
        return { status: liveStatus, hasAccess: isAccessGranted(liveStatus), trialEndsAt, hasUsedTrial };
      }
    } catch {
    }

    if (cached) {
      return { status: cached, hasAccess: isAccessGranted(cached), trialEndsAt: null, hasUsedTrial };
    }

    return { status: "none", hasAccess: false, trialEndsAt: null, hasUsedTrial };
  } catch {
    return { status: "none", hasAccess: false, trialEndsAt: null, hasUsedTrial: false };
  }
}

export async function listPlansWithPrices() {
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id        AS product_id,
        p.name      AS product_name,
        p.description AS product_description,
        p.metadata  AS product_metadata,
        pr.id       AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);

    const map = new Map<string, any>();
    for (const row of rows) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata || {},
          prices: [],
        });
      }
      map.get(row.product_id).prices.push({
        id: row.price_id,
        unit_amount: row.unit_amount,
        currency: row.currency,
        recurring: row.recurring,
      });
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}
