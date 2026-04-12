import { getUncachableStripeClient } from "./stripeClient";
import {
  upsertStripeUser,
  getStripeUser,
  updateStripeUserIds,
  updateSubscriptionStatusByCustomer,
} from "./stripeStorage";

const TRIAL_PRICE_ID = "price_1TFYJVAC9aQrlGDtdvlFPtjX";
const TRIAL_DAYS = 3;

export class StripeService {
  async getOrCreateCustomer(supabaseUserId: string, email: string): Promise<string> {
    const stripe = await getUncachableStripeClient();

    await upsertStripeUser(supabaseUserId, email);
    const user = await getStripeUser(supabaseUserId);

    if (user?.stripe_customer_id) {
      // Verify the customer still exists in the current Stripe account
      // (it may not if keys were rotated or the account changed)
      try {
        const existing = await stripe.customers.retrieve(user.stripe_customer_id);
        if (!existing.deleted) return user.stripe_customer_id;
      } catch {
        // Customer not found in this Stripe account — fall through to create a new one
      }
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { supabaseUserId },
    });
    await updateStripeUserIds(supabaseUserId, {
      stripeCustomerId: customer.id,
    });
    return customer.id;
  }

  async createSubscriptionWithTrial(supabaseUserId: string, email: string) {
    const stripe = await getUncachableStripeClient();

    const user = await getStripeUser(supabaseUserId);

    if (
      user?.stripe_subscription_id &&
      user?.subscription_status &&
      ["active", "trialing"].includes(user.subscription_status)
    ) {
      return {
        status: user.subscription_status,
        subscriptionId: user.stripe_subscription_id,
        alreadyExists: true,
      };
    }

    const customerId = await this.getOrCreateCustomer(supabaseUserId, email);

    if (user?.stripe_customer_id || customerId) {
      try {
        const existing = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: "all",
        });
        const live = existing.data.find(s =>
          ["active", "trialing"].includes(s.status),
        );
        if (live) {
          await updateStripeUserIds(supabaseUserId, {
            stripeSubscriptionId: live.id,
            subscriptionStatus: live.status,
          });
          return { status: live.status, subscriptionId: live.id, alreadyExists: true };
        }
      } catch {
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: TRIAL_PRICE_ID }],
      trial_period_days: TRIAL_DAYS,
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: { supabaseUserId },
    });

    await updateStripeUserIds(supabaseUserId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    });

    return {
      status: subscription.status,
      subscriptionId: subscription.id,
      alreadyExists: false,
    };
  }

  async createCheckoutSession(
    supabaseUserId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    trialEligible: boolean = true,
  ) {
    const stripe = await getUncachableStripeClient();
    const customerId = await this.getOrCreateCustomer(supabaseUserId, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      // Always collect a card so Stripe can charge automatically after trial (or immediately
      // for returning users who are resubscribing without a trial).
      payment_method_collection: "always",
      subscription_data: {
        // Only set trial_period_days for first-time users. Returning users who already
        // used their trial must NOT receive another trial — this also removes the
        // "3-day free trial" language from the Stripe-hosted checkout page.
        ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
        metadata: { supabaseUserId },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { supabaseUserId },
    });

    return session;
  }

  async createPortalSession(supabaseUserId: string, email: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();

    let portalCustomerId: string | null = null;
    let foundSubId: string | null = null;
    let foundStatus: string | null = null;

    // ── Step 1: Live Stripe lookup — do NOT trust any cached customer ID. ──────────
    // List every customer in this Stripe account that matches the user's email,
    // then find the one that actually owns an active or trialing subscription.
    // This is the authoritative path and handles all account-switching / stale-ID scenarios.
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
        if (activeSub) {
          portalCustomerId = customer.id;
          foundSubId = activeSub.id;
          foundStatus = activeSub.status;
          break;
        }
      }
    } catch {
      // Stripe search failed — fall through to cached lookups below
    }

    // ── Step 2: If the live lookup found the subscription, sync DB so future ───────
    // calls (subscription status, etc.) use the correct IDs.
    if (portalCustomerId && foundSubId && foundStatus) {
      await updateStripeUserIds(supabaseUserId, {
        stripeCustomerId: portalCustomerId,
        stripeSubscriptionId: foundSubId,
        subscriptionStatus: foundStatus,
      });
      await updateSubscriptionStatusByCustomer(portalCustomerId, foundSubId, foundStatus);
    }

    // ── Step 3: If no active sub was found via email search, check whether the ─────
    // stored subscription ID resolves to a valid customer in the current account.
    if (!portalCustomerId) {
      const user = await getStripeUser(supabaseUserId);
      if (user?.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
          portalCustomerId = sub.customer as string;
          // Sync in case the customer ID drifted
          if (portalCustomerId !== user.stripe_customer_id) {
            await updateStripeUserIds(supabaseUserId, { stripeCustomerId: portalCustomerId });
          }
        } catch {
          // Stored subscription is stale — clear it
          await updateStripeUserIds(supabaseUserId, {
            stripeSubscriptionId: null,
            subscriptionStatus: null,
          });
        }
      }
    }

    // ── Step 4: Final fallback — ensure the customer record exists. ───────────────
    // This path is only reached when the user has no subscription anywhere in Stripe.
    // The portal will open but show no subscription, which is correct.
    if (!portalCustomerId) {
      portalCustomerId = await this.getOrCreateCustomer(supabaseUserId, email);
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: portalCustomerId,
        return_url: returnUrl,
      });
      return session.url;
    } catch (err: any) {
      throw new Error(
        err?.raw?.message ?? err?.message ?? "Unable to open billing portal. Please try again.",
      );
    }
  }
}

export const stripeService = new StripeService();
