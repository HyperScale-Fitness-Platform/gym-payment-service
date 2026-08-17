# Payment Feature — Implementation Summary

This document records what was actually changed for the Payment Feature plan, split into:

- **Section A** — changes **I made** in this session
- **Section B** — plan items that were **already present** in the working tree (verified, not re-made)
- **Section C** — verification done
- **Section D** — caveats / things to check before going live

---

## Section A — Changes I Made

### A1. `gym-operations-service/src/modules/membership/membership.module.ts`
Registered the two new payment-related providers:

```typescript
import { PaymentClientService } from './payment-client.service';
import { PaymentConsumerService } from 'src/events/payment-consumer.service';

providers: [MembershipService, MembershipFreezeJob, MembershipExpirationJob, EventPublisher, PaymentClientService, PaymentConsumerService],
```

### A2. `gym-operations-service/src/modules/membership/membership.service.ts`
- **Constructor**: injected `private paymentClient: PaymentClientService`.
- **`subscribe()`**:
  - Membership is now created with `status: MembershipStatus.PENDING_PAYMENT` (was `ACTIVE`).
  - After saving the membership + benefits, it calls `paymentClient.createPaymentIntent(customerId, 'membership', savedMembership.id.toString(), Math.round(plan.price * 100), 'egp')`.
  - Returns `{ membershipId, clientSecret }` instead of the raw membership entity.
- **`purchasePackage()`**:
  - Package is now created with `status: PtPackageStatus.PENDING_PAYMENT` (was `ACTIVE`).
  - **Removed** the early `PT_PACKAGE_PURCHASED` Kafka publish (moved to after payment confirms).
  - Calls `paymentClient.createPaymentIntent(..., priceMap[dto.packageType], 'egp')` with price map: 20→100000, 40→200000, 60→280000 cents.
  - Returns `{ packageId, clientSecret }`.
- **New `activateByPayment(referenceType, referenceId)`**:
  - `pt_package`: finds the `PENDING_PAYMENT` package, sets `ACTIVE`, then publishes `PT_PACKAGE_PURCHASED` (now only after payment succeeds).
  - `membership`: finds the `PENDING_PAYMENT` membership (via `parseInt(referenceId)`), sets `ACTIVE`.
- **New `failByPayment(referenceType, referenceId)`**:
  - `pt_package`: deletes the pending package.
  - `membership`: deletes the pending membership and its customer benefits.

### A3. `gym-operations-service/package.json` (+ lockfile)
Installed the missing dependencies required by the new services to compile/run:

```
kafkajs  (already declared, was not installed)
axios    (newly added, required by payment-client.service.ts)
```

### A4. `frontend-service/src/features/Membership/MembershipPlans.jsx`
- Added `loadStripe` / `Elements` imports and `CheckoutForm` import; created `stripePromise` from `VITE_STRIPE_PUBLISHABLE_KEY`.
- Added `clientSecret` state.
- `subscribe()` now stores `result.clientSecret` instead of showing a "Membership activated" toast immediately.
- Added `handlePaymentSuccess()` → clears clientSecret, toasts "Payment succeeded! Membership activated.", reloads data.
- Renders a `.formCard` block with `<Elements>` + `<CheckoutForm>` when `clientSecret` is set.

### A5. `frontend-service/src/features/Membership/MembershipPlans.module.css`
Added `.formCard`, `.formCard h3`, `.formCard p` styles.

### A6. `frontend-service/src/features/PTPackages/PTPackages.jsx`
- Added `loadStripe` / `Elements` / `CheckoutForm` imports and `stripePromise`.
- Added `clientSecret` state.
- `purchase()` now stores `result.clientSecret`.
- Added `handlePaymentSuccess()` → clears clientSecret, toasts "Payment succeeded! Package activated.", reloads data.
- Renders a `.formCard` block with `<Elements>` + `<CheckoutForm>` when `clientSecret` is set.

### A7. `frontend-service/src/features/PTPackages/PTPackages.module.css`
Added `.formCard`, `.formCard h3`, `.formCard p` styles.

### A8. `gym-payment-service/src/db/migrations/001_add_unique_reference.sql` (NEW)
Phase 5 race-condition migration — adds a unique constraint on `(reference_type, reference_id)`:

```sql
ALTER TABLE payments
ADD CONSTRAINT unique_reference UNIQUE (reference_type, reference_id);
```

> Note: the payment service has no migration runner; the file documents how to apply it (via `psql`). The in-code `23505` → 409 handling was already present.

---

## Section B — Plan Items Already Present (NOT changed by me)

These were already in the working tree (uncommitted) when I started. I verified they match the plan and left them as-is.

| # | Service | File | Status |
|---|---------|------|--------|
| 1 | Frontend | `Payment/CheckoutForm.jsx` | **NEW** — already exists (Phase 1) |
| 2 | Frontend | `Payment/Payment.jsx` | **MODIFIED** — history-only page, status badges + `Intl.NumberFormat` (Phase 2) |
| 3 | Frontend | `Payment/paymentApi.js` | **MODIFIED** — `initiatePayment` removed; `getMyPayments`/`getPaymentById` kept (Phase 2) |
| 4 | Frontend | `Payment/Payment.module.css` | **MODIFIED** — bare `button` selectors scoped to `.primaryButton`; status badge classes added (Phase 4) |
| 5 | Operations | `membership/payment-client.service.ts` | **NEW** — HTTP client to payment service (`POST /payments` with `user-id` header) (Phase 3A) |
| 6 | Operations | `events/payment-consumer.service.ts` | **NEW** — Kafka consumer on `PAYMENT_STATUS`, calls `activateByPayment`/`failByPayment` (Phase 3C) |
| 7 | Operations | `membership/enum/membership-status.enum.ts` | **MODIFIED** — added `PENDING_PAYMENT` (Phase 3A) |
| 8 | Payment | `config/kafka.js` | **MODIFIED** — filled in Kafka producer config (Phase 3B) |
| 9 | Payment | `events/producers/paymentStatus.producer.js` | **NEW** — publishes `PAYMENT_STATUS` (Phase 3B) |
| 10 | Payment | `index.js` | **MODIFIED** — connects Kafka producer on startup (Phase 3B) |
| 11 | Payment | `services/payment.service.js` | **MODIFIED** — webhook publishes Kafka events; `amountCents` validation; `23505` → 409 (Phases 3B + 5) |
| 12 | Payment | `events/producers/sessionBooked.producer.js` | **DELETED** — empty placeholder (Phase 3B) |
| 13 | Payment | `events/consumers/paymentSucceeded.consumer.js` | **DELETED** — empty placeholder (Phase 3B) |
| 14 | Payment | `package.json` / `package-lock.json` | **MODIFIED** — added `kafkajs` dependency (Phase 3B) |

---

## Section C — Verification Done

| Check | Result |
|-------|--------|
| `npm run build` in `gym-operations-service` | ✅ compiles |
| `npm run build` (vite) in `frontend-service` | ✅ builds |
| `npm run lint` (oxlint) in `frontend-service` | ✅ no errors (only pre-existing warnings) |
| `node --check` on changed payment-service JS files | ✅ syntax OK |

---

## Section D — Caveats / Things to Check Before Going Live

1. ~~**`payments.reference_id` column type**~~ — **RESOLVED (2026-08-17).** The live table was `ALTER TABLE payments ALTER COLUMN reference_id TYPE text` and the README schema now declares `reference_id VARCHAR(255)`. Membership reference IDs (serial integers) and PT package reference IDs (UUIDs) both fit. Fresh setups should use the updated README schema.
2. **Apply the migration** (`001_add_unique_reference.sql`) to `gym_payment` before enabling concurrent subscriptions/purchases; the code already handles the `23505` duplicate gracefully with a 409.
3. **`VITE_STRIPE_PUBLISHABLE_KEY`** is currently a placeholder (`your_stripe_publishable_key`) in `frontend-service/.env` — replace with the real Stripe publishable key.
4. **`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`** are placeholders in `gym-payment-service/.env` — Stripe will reject real charges/webhooks until real keys are set.
5. **Kafka broker** — operations & payment services default to `localhost:9092` unless `KAFKA_BROKERS` is set. In containerized/docker-compose environments, point it at the Kafka service.
6. **Payment consumer group** — `gym-operations-payment-group` is a new consumer with its own KafkaJS instance (the shared `kafkaConsumer`/`TrainerConsumerService` is untouched).
7. **Existing PENDING_PAYMENT rows** — if a payment fails before the webhook fires, `failByPayment` cleans up the pending record. If Stripe never fires a webhook (e.g. abandoned checkout), the pending record remains until then.