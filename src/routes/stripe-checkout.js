const express = require("express");
const app = express();
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();
app.use(express.static("public"));
app.use(express.json());

router.get("/products", async (req, res) => {
  try {
    const products = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    const items = products.data.map((product) => {
      const price =
        typeof product.default_price === "object"
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
    console.error("Stripe error:", error);
    res.status(500).json({
      error: "Failed to retrieve products",
    });
  }
});

router.get("/prices", async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    res.json({ prices: prices.data });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({
      error: "Failed to retrieve prices",
    });
  }
});

const calculateOrderAmount = (items) => {
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  let total = 0;
  items.forEach((item) => {
    total += item.amount;
  });
  return total;
};

app.post("/calculate-order", async (req, res) => {
  try {
    // Look up the order's prices on the server, never from client-supplied amounts.
    const items = [{ id: "xl-tshirt", amount: 1000 }];
    const amount = calculateOrderAmount(items);
    res.send({ amount, currency: "usd" });
  } catch {
    res.status(500).send({ error: "Unable to calculate the order." });
  }
});

app.post("/create-payment-intent", async (req, res) => {
  try {
    // Use the same server-owned order as /calculate-order.
    const items = [{ id: "xl-tshirt", amount: 1000 }];

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateOrderAmount(items),
      currency: "usd",
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch {
    res.status(500).send({ error: "Unable to start the payment." });
  }
});
module.exports = router;
