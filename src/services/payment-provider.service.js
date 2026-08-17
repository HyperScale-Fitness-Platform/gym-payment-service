const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Creates one configured Stripe client, using your secret key from the environment.

async function createPaymentIntent({ amountCents, currency, metadata }) {
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    // Stripe always expects amounts in the SMALLEST currency unit.

    currency: currency || "usd",

    metadata,
    // "metadata" is a plain key-value object Stripe stores alongside
    // the PaymentIntent and echoes back on every webhook event. We use
    // this to carry OUR OWN payment record's id, so when the webhook
    // fires later, we know exactly which row in our own database to
    // update — Stripe has no idea our "payments" table exists.

    automatic_payment_methods: { enabled: true },
    // Lets Stripe automatically offer whatever payment methods are
    // enabled on your account (cards, wallets, etc.) without you having
    // to list them manually.
  });

  return {
    providerPaymentId: intent.id,
    // Stripe's own id for this PaymentIntent, e.g. "pi_3Abc...". This
    // is what we store as provider_payment_id in our own table.
    clientSecret: intent.client_secret,
    // This is what gets returned to the FRONTEND — it's the credential
    // Stripe.js needs to confirm the payment directly, without ever
    // routing card details through our backend.
    status: intent.status,
    // Stripe's initial status, typically "requires_payment_method" or
    // "requires_confirmation" at this point — NOT yet "succeeded".
    // Actual success only comes later, via the webhook.
  };
}

async function retrievePaymentIntent(providerPaymentId) {
  // Fetches an existing PaymentIntent from Stripe. This is what lets a
  // customer RESUME a checkout they abandoned: Stripe keeps the same
  // PaymentIntent (and its client_secret) alive until it's confirmed,
  // so we can hand the frontend the same secret again.
  const intent = await stripe.paymentIntents.retrieve(
    providerPaymentId
  );

  return {
    providerPaymentId: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}

async function cancelPaymentIntent(providerPaymentId) {
  // Best-effort cancel of an abandoned PaymentIntent. Stripe throws if
  // the intent is already canceled or no longer cancellable, so callers
  // wrap this in a try/catch — cancelling is a cleanup nicety, not a
  // hard requirement for deleting our own payment record.
  return stripe.paymentIntents.cancel(providerPaymentId);
}

function constructWebhookEvent(rawBody, signature) {
  // Stripe signs every webhook request with your webhook secret so you
  // can verify it genuinely came from Stripe, not an attacker pretending
  // to notify you a payment succeeded.
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

module.exports = { createPaymentIntent, retrievePaymentIntent, cancelPaymentIntent, constructWebhookEvent };