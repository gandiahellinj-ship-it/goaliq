import { getStripeSync } from "./stripeClient";
import { updateSubscriptionStatusByCustomer } from "./stripeStorage";
import { logger } from "./lib/logger";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
]);

export class WebhookHandlers {
  static async processWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Webhook payload must be a Buffer. " +
          "Ensure the webhook route is registered BEFORE app.use(express.json()).",
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());

      if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const sub = event.data?.object;
        if (sub?.customer && sub?.id && sub?.status) {
          await updateSubscriptionStatusByCustomer(
            sub.customer as string,
            sub.id as string,
            sub.status as string,
          );
          logger.info(
            { customerId: sub.customer, subscriptionId: sub.id, status: sub.status },
            "Subscription status updated in stripe_users",
          );
        }
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const customerId = session?.customer as string | undefined;
        const subscriptionId = session?.subscription as string | undefined;
        if (customerId && subscriptionId) {
          await updateSubscriptionStatusByCustomer(
            customerId,
            subscriptionId,
            "trialing",
          );
          logger.info(
            { customerId, subscriptionId },
            "Checkout session completed — subscription linked in stripe_users",
          );
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to parse webhook for subscription status update");
    }
  }
}
