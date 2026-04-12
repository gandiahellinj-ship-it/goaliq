import { Router } from "express";
import { stripeService } from "../stripeService";
import {
  getSubscriptionStatus,
  getStripeUser,
  listPlansWithPrices,
  updateSubscriptionStatusByCustomer,
  updateStripeUserIds,
} from "../stripeStorage";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

router.get("/plans", async (_req, res) => {
  try {
    const plans = await listPlansWithPrices();
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/subscription", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { status, hasAccess, trialEndsAt, hasUsedTrial } = await getSubscriptionStatus(req.user.id);
    const effectiveStatus = status === "none" ? "inactive" : status;
    res.json({ status: effectiveStatus, hasAccess, trialEndsAt, hasUsedTrial });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/subscribe", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await stripeService.createSubscriptionWithTrial(
      req.user.id,
      req.user.username,
    );
    const hasAccess = result.status === "trialing" || result.status === "active";
    res.json({ status: result.status, hasAccess, alreadyExists: result.alreadyExists });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/checkout", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId required" });

    // Check trial eligibility — returning users who already used their trial
    // must not get another trial period on the Stripe checkout page.
    const { hasUsedTrial } = await getSubscriptionStatus(req.user.id);

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = domain ? `https://${domain}` : "http://localhost:3000";

    const session = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.username,
      priceId,
      `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/pricing`,
      !hasUsedTrial, // trialEligible
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Called from the success page: immediately fetches the completed session from Stripe
// and writes the confirmed subscription status to the DB — no webhook latency.
router.get("/checkout/verify", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { session_id } = req.query;
  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "session_id required" });
  }
  try {
    const stripe = await getUncachableStripeClient();
    // Expand subscription + its default_payment_method so we can verify the card was saved
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription", "subscription.default_payment_method"],
    });

    const sub = session.subscription as any;
    const customerId = session.customer as string | null;

    if (sub && customerId) {
      // Ensure the customer ID is pinned to this user by supabase ID (handles key switches)
      await updateStripeUserIds(req.user.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
      });
      // Also update by customer ID in case other rows reference the same customer
      await updateSubscriptionStatusByCustomer(customerId, sub.id, sub.status);

      // If Stripe hasn't set a default payment method yet (race condition on fast completions),
      // find the customer's first card and set it as default on both the subscription and customer.
      const defaultPm = sub.default_payment_method;
      if (!defaultPm) {
        try {
          const pms = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });
          if (pms.data.length > 0) {
            const pmId = pms.data[0].id;
            // Attach as subscription default
            await stripe.subscriptions.update(sub.id, {
              default_payment_method: pmId,
            });
            // Attach as customer invoice default
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pmId },
            });
          }
        } catch (pmErr: any) {
          // Non-fatal — card will still be attached, billing portal will show it
          console.warn("Could not set default payment method:", pmErr.message);
        }
      }
    }

    const { status, hasAccess, trialEndsAt } = await getSubscriptionStatus(req.user.id);
    res.json({ status: status === "none" ? "inactive" : status, hasAccess, trialEndsAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint — live Stripe audit for the logged-in user.
// Shows what the DB has, what Stripe actually has, and which customer will be
// used for the billing portal (live email-based lookup, not cached IDs).
router.get("/debug", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const stripe = await getUncachableStripeClient();
    const user = await getStripeUser(req.user.id);
    const email = req.user.username;

    // ── What the DB currently stores ──────────────────────────────────────────
    const db = {
      supabase_user_id: req.user.id,
      email: user?.email,
      stripe_customer_id: user?.stripe_customer_id ?? null,
      stripe_subscription_id: user?.stripe_subscription_id ?? null,
      subscription_status: user?.subscription_status ?? null,
    };

    // ── Verify stored customer exists in current Stripe account ───────────────
    let storedCustomer: any = null;
    let storedCustomerError: string | null = null;
    if (user?.stripe_customer_id) {
      try {
        const c = await stripe.customers.retrieve(user.stripe_customer_id);
        storedCustomer = { id: c.id, deleted: (c as any).deleted ?? false };
      } catch (e: any) {
        storedCustomerError = e.message;
      }
    }

    // ── Verify stored subscription exists in current Stripe account ───────────
    let storedSubscription: any = null;
    let storedSubscriptionError: string | null = null;
    if (user?.stripe_subscription_id) {
      try {
        const s = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        storedSubscription = {
          id: s.id,
          status: s.status,
          customer: s.customer,
          trial_end: s.trial_end,
          default_payment_method: s.default_payment_method,
        };
      } catch (e: any) {
        storedSubscriptionError = e.message;
      }
    }

    // ── Live Stripe lookup: search by email for active/trialing subscription ──
    // This is the same logic createPortalSession uses — it does not rely on
    // any cached IDs. This is what will actually be used for the billing portal.
    const liveCustomersFound: any[] = [];
    let livePortalCustomerId: string | null = null;
    let liveSubFound: any = null;
    try {
      const customers = await stripe.customers.list({ email, limit: 10 });
      for (const customer of customers.data) {
        if ((customer as any).deleted) continue;
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 10,
        });
        const activeSub = subs.data.find(s =>
          (["active", "trialing"] as string[]).includes(s.status),
        );
        liveCustomersFound.push({
          id: customer.id,
          has_active_sub: !!activeSub,
          active_sub_id: activeSub?.id ?? null,
          active_sub_status: activeSub?.status ?? null,
        });
        if (activeSub && !livePortalCustomerId) {
          livePortalCustomerId = customer.id;
          liveSubFound = {
            id: activeSub.id,
            status: activeSub.status,
            customer: activeSub.customer,
            trial_end: activeSub.trial_end,
          };
        }
      }
    } catch (e: any) {
      liveCustomersFound.push({ error: e.message });
    }

    const customerMismatch =
      livePortalCustomerId &&
      user?.stripe_customer_id &&
      livePortalCustomerId !== user.stripe_customer_id;

    res.json({
      db,
      stored_customer_in_stripe: storedCustomer,
      stored_customer_error: storedCustomerError,
      stored_subscription_in_stripe: storedSubscription,
      stored_subscription_error: storedSubscriptionError,
      live_lookup: {
        email_searched: email,
        customers_found: liveCustomersFound,
        portal_will_use_customer: livePortalCustomerId,
        portal_subscription: liveSubFound,
      },
      customer_mismatch: customerMismatch ?? false,
      diagnosis: livePortalCustomerId
        ? customerMismatch
          ? `SYNCING: portal will use ${livePortalCustomerId} (live), DB has ${user?.stripe_customer_id} (stale) — will auto-correct on portal open`
          : "OK: DB customer matches live Stripe lookup"
        : "NO_ACTIVE_SUB: no active/trialing subscription found for this email in Stripe — user needs to subscribe",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/portal", async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = domain ? `https://${domain}` : "http://localhost:3000";

    const url = await stripeService.createPortalSession(
      req.user.id,
      req.user.username,
      `${baseUrl}/billing`,
    );
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
