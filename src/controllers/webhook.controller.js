const paymentService = require("../services/payment.service");
const provider = require("../services/payment-provider.service");

async function handleStripeWebhook(req, res, next) {
  const signature = req.headers["stripe-signature"];
  // Stripe includes this header on every webhook request 
  // proving the request genuinely came from Stripe's servers.

  let event;
  try {
    event = provider.constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "invalid webhook signature" });
  }

  try {
    await paymentService.handleWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleStripeWebhook };