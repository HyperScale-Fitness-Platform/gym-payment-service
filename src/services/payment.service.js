const paymentModel = require("../models/payment.model");
const provider = require("./payment-provider.service");
const { publishPaymentStatus } = require("../events/producers/paymentStatus.producer");

async function initiatePayment({ userId, referenceType, referenceId, amountCents, currency }) {
  if (!userId || !referenceType || !referenceId || !amountCents) {
    throw { status: 400, message: "userId, referenceType, referenceId, and amountCents are required" };
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw { status: 400, message: "amountCents must be a positive integer" };
  }

  const existing = await paymentModel.findByReference(referenceType, referenceId);

  if (existing && existing.status === "succeeded") {
    throw { status: 409, message: "This reference has already been paid for" };
  }

  // Step 1: create a "pending" record BEFORE attempting the actual
  // charge. This means even if the process crashes mid-charge, there's
  // already a database row showing an attempt was made — nothing is
  // ever silently lost.
  let payment;

  try {
    payment = await paymentModel.create({
      userId,
      referenceType,
      referenceId,
      amountCents,
      currency: currency || "usd",
    });
  } catch (err) {
    // Handle unique constraint violation (race condition protection)
    if (err.code === "23505") {
      throw { status: 409, message: "This reference has already been paid for" };
    }
    throw err;
  }

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
  
    const payment = await paymentModel.updateStatus(internalPaymentId, {
      status: "succeeded",
      providerPaymentId: intent.id,
    });

    // Publish to Kafka so other services (operations) can react
    await publishPaymentStatus({
      referenceType: payment.reference_type,
      referenceId: payment.reference_id,
      status: "succeeded",
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object;
    const internalPaymentId = intent.metadata.internalPaymentId;

    const current = await paymentModel.findById(internalPaymentId);

    // A failed attempt can precede the customer retrying and succeeding, and
    // Stripe retries/duplicates webhooks. Never downgrade an already-paid
    // payment — otherwise downstream services would treat a paid package as
    // failed.
    if (current && current.status === "succeeded") {
      return;
    }

    const payment = await paymentModel.updateStatus(internalPaymentId, {
      status: "failed",
      providerPaymentId: intent.id,
    });

    // Publish to Kafka so other services (operations) can react
    await publishPaymentStatus({
      referenceType: payment.reference_type,
      referenceId: payment.reference_id,
      status: "failed",
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

// Statuses Stripe reports for a PaymentIntent that can still be paid.
const RESUMABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

async function continuePayment(userId, paymentId) {
  const payment = await getById(paymentId);

  if (payment.user_id !== userId) {
    throw { status: 404, message: "Payment not found" };
  }

  // Already completed — nothing to resume.
  if (payment.status === "succeeded") {
    return { alreadyPaid: true };
  }

  const attachFreshIntent = async () => {
    // The customer never finished (or Stripe auto-cancelled the old
    // intent), so start a brand-new PaymentIntent from the stored amount.
    const intent = await provider.createPaymentIntent({
      amountCents: payment.amount_cents,
      currency: payment.currency,
      metadata: { internalPaymentId: payment.id },
    });

    await paymentModel.updateStatus(payment.id, {
      status: "processing",
      providerPaymentId: intent.providerPaymentId,
    });

    return { paymentId: payment.id, clientSecret: intent.clientSecret };
  };

  // No Stripe intent was ever created — nothing to resume, start fresh.
  if (!payment.provider_payment_id) {
    return attachFreshIntent();
  }

  const intent = await provider.retrievePaymentIntent(
    payment.provider_payment_id
  );

  // The previous intent already succeeded (e.g. a webhook was missed).
  if (intent.status === "succeeded") {
    await paymentModel.updateStatus(payment.id, {
      status: "succeeded",
      providerPaymentId: intent.providerPaymentId,
    });

    await publishPaymentStatus({
      referenceType: payment.reference_type,
      referenceId: payment.reference_id,
      status: "succeeded",
    });

    return { alreadyPaid: true };
  }

  // Still awaiting card details — hand back the same client_secret.
  if (RESUMABLE_STATUSES.has(intent.status)) {
    await paymentModel.updateStatus(payment.id, {
      status: "processing",
      providerPaymentId: payment.provider_payment_id,
    });
    return { paymentId: payment.id, clientSecret: intent.clientSecret };
  }

  // Cancelled / expired / anything else unpayable — start a fresh intent.
  return attachFreshIntent();
}

async function deletePayment(userId, paymentId) {
  const payment = await getById(paymentId);

  if (payment.user_id !== userId) {
    throw { status: 404, message: "Payment not found" };
  }

  if (payment.status === "succeeded") {
    throw { status: 409, message: "A completed payment cannot be deleted" };
  }

  // Cancel the Stripe intent if there is one (best-effort — it may
  // already be canceled or expired).
  if (payment.provider_payment_id) {
    try {
      await provider.cancelPaymentIntent(payment.provider_payment_id);
    } catch {
      // Ignore — Stripe throws if the intent is already canceled.
    }
  }

  // Let other services react: operations deletes the PENDING_PAYMENT
  // package that this payment was for.
  await publishPaymentStatus({
    referenceType: payment.reference_type,
    referenceId: payment.reference_id,
    status: "failed",
  });

  await paymentModel.remove(payment.id);

  return { deleted: true };
}

async function getUserPayments(userId, limit, offset) {
  return paymentModel.findByUserId(userId, limit, offset);
}

module.exports = { initiatePayment, continuePayment, deletePayment, getById, getUserPayments, handleWebhookEvent };