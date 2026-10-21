const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

// ==========================================
// STRIPE ACCOUNTS
// ==========================================

// Existing Stripe account
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// HEALIX Stripe account
const healixStripe = new Stripe(process.env.HEALIX_STRIPE_SECRET_KEY);

// ==========================================
// EXISTING STRIPE PRODUCTS
// ==========================================

router.get("/products", async (req, res) => {
  try {
    const products = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    const items = products.data.map((product) => {
      const price =
        product.default_price && typeof product.default_price === "object"
          ? product.default_price
          : null;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.images[0] || null,
        priceId: price?.id || null,
        price: price?.unit_amount != null ? price.unit_amount / 100 : null,
        currency: price?.currency || null,
      };
    });

    res.json({ products: items });
  } catch (error) {
    console.error("Stripe products error:", error);

    res.status(500).json({
      error: "Failed to retrieve products",
    });
  }
});

// ==========================================
// EXISTING STRIPE PRICES
// ==========================================

router.get("/prices", async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    res.json({ prices: prices.data });
  } catch (error) {
    console.error("Stripe prices error:", error);

    res.status(500).json({
      error: "Failed to retrieve prices",
    });
  }
});

// ==========================================
// EXISTING STRIPE PAYMENTS
// ==========================================

const calculateOrderAmount = (items) => {
  let total = 0;

  items.forEach((item) => {
    total += item.amount;
  });

  return total;
};

router.post("/calculate-order", async (req, res) => {
  try {
    const items = [
      {
        id: "xl-tshirt",
        amount: 1000,
      },
    ];

    const amount = calculateOrderAmount(items);

    res.json({
      amount,
      currency: "usd",
    });
  } catch (error) {
    console.error("Calculate order error:", error);

    res.status(500).json({
      error: "Unable to calculate the order.",
    });
  }
});

router.post("/create-payment-intent", async (req, res) => {
  try {
    const items = [
      {
        id: "xl-tshirt",
        amount: 1000,
      },
    ];

    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateOrderAmount(items),
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Payment intent error:", error);

    res.status(500).json({
      error: "Unable to start the payment.",
    });
  }
});

// ==========================================
// HEALIX DONATIONS
// ==========================================

// POST /healix/donations/checkout
router.post("/healix/donations/checkout", async (req, res) => {
  try {
    const { amount } = req.body;

    // Donation amount in dollars
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 1000
    ) {
      return res.status(400).json({
        error: "Donation must be between $1 and $1,000.",
      });
    }

    const amountInCents = Math.round(amount * 100);

    const session = await healixStripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "HEALIX Donation",
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],

      return_url:
        "https://spearitual.xyz/healix/donation/return?session_id={CHECKOUT_SESSION_ID}",

      redirect_on_completion: "if_required",
    });

    return res.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error("HEALIX donation error:", error);

    return res.status(500).json({
      error: "Unable to initialize donation.",
    });
  }
});
// ==========================================
// HEALIX DONATION SESSION STATUS
// ==========================================

// GET /healix/donations/session/:sessionId
router.get("/healix/donations/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await healixStripe.checkout.sessions.retrieve(sessionId);

    return res.json({
      status: session.status,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    console.error("HEALIX session error:", error);

    return res.status(500).json({
      error: "Unable to retrieve donation status.",
    });
  }
});

module.exports = router;
