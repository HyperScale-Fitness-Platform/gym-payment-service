const paymentModel = require("../models/payment.model");
const provider = require("./payment-provider.service");

async function initiatePayment({ userId, referenceType, referenceId, amountCents, currency }) {
  if (!userId || !referenceType || !referenceId || !amountCents) {
    throw { status: 400, message: "userId, referenceType, referenceId, and amountCents are required" };
  }

  const existing = await paymentModel.findByReference(referenceType, referenceId);

  if (existing && existing.status === "succeeded") {
    throw { status: 409, message: "This reference has already been paid for" };
  }

  // Step 1: create a "pending" record BEFORE attempting the actual
  // charge. This means even if the process crashes mid-charge, there's
  // already a database row showing an attempt was made — nothing is
  // ever silently lost.
  const payment = await paymentModel.create({
    userId,
    referenceType,
    referenceId,
    amountCents,
    currency: currency || "usd",
  });

  // Step 2: actually attempt the charge through the provider.
  const intent = await provider.createPaymentIntent({
    amountCents,
    currency,
    metadata: { internalPaymentId: payment.id },
  });

  await paymentModel.updateStatus(payment.id, {
    status: "processing",
    providerPaymentId: intent.providerPaymentId,
  });
  
  // Return the client_secret to the controller — this is what the
  // frontend actually needs to finish the payment with Stripe.js.
  return { paymentId: payment.id, clientSecret: intent.clientSecret };
}

async function handleWebhookEvent(event) {
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const internalPaymentId = intent.metadata.internalPaymentId;
  
    await paymentModel.updateStatus(internalPaymentId, {
      status: "succeeded",
      providerPaymentId: intent.id,
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object;
    const internalPaymentId = intent.metadata.internalPaymentId;

    await paymentModel.updateStatus(internalPaymentId, {
      status: "failed",
      providerPaymentId: intent.id,
    });
  }
  // Any other event type is simply ignored — Stripe sends dozens of
  // event types (refunds, disputes, etc.) we don't need to handle yet.
}


async function getById(id) {
  const payment = await paymentModel.findById(id);
  if (!payment) {
    throw { status: 404, message: "Payment not found" };
  }
  return payment;
}

async function getUserPayments(userId, limit, offset) {
  return paymentModel.findByUserId(userId, limit, offset);
}

module.exports = { initiatePayment, getById, getUserPayments, handleWebhookEvent };