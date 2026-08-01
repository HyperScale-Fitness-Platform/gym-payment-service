const dotenv = require("dotenv");
dotenv.config();

const express = require("express");

const paymentRoutes = require("./routes/payment.routes");
const webhookRoutes = require("./routes/webhook.routes");

const { attachUserFromHeaders } = require("./middleware/auth.middleware");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const app = express();

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "payment-service" });
});

// IMPORTANT: this webhook route is registered BEFORE express.json(),
// using express.raw() instead — Stripe's signature verification needs
// the exact original request bytes, which express.json() would have
// already parsed into a JS object and thrown away the raw form of.
app.use(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(express.json());

app.use(attachUserFromHeaders);

app.use("/payments", paymentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => {
  console.log(`payment-service listening on port ${PORT}`);
});