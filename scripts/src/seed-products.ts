import { getUncachableStripeClient } from "./stripeClient";

const PLANS = [
  {
    name: "Basic",
    description: "Get started with a personalized meal and workout plan.",
    metadata: { tier: "basic", order: "1" },
    price: 499,
  },
  {
    name: "Pro",
    description:
      "Full weekly plans, ingredient swapping, and progress analytics.",
    metadata: { tier: "pro", order: "2" },
    price: 999,
  },
  {
    name: "Premium",
    description:
      "Everything in Pro plus smart AI coaching insights and advanced tracking.",
    metadata: { tier: "premium", order: "3" },
    price: 1999,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Creating NutriCoach subscription plans in Stripe...\n");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(
        `✓ ${plan.name} already exists (${existing.data[0].id}) — skipping`,
      );
      const prices = await stripe.prices.list({
        product: existing.data[0].id,
        active: true,
      });
      prices.data.forEach((p) =>
        console.log(
          `  Price: ${p.id} ($${(p.unit_amount! / 100).toFixed(2)}/mo)`,
        ),
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`✓ Created product: ${product.name} (${product.id})`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: "usd",
      recurring: { interval: "month" },
    });
    console.log(
      `  Price: ${price.id} ($${(plan.price / 100).toFixed(2)}/month)\n`,
    );
  }

  console.log("Done! Webhooks will sync these products to your database.");
}

seedProducts().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
