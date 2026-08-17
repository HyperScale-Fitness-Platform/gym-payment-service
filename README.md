# Gym Payment Service

A lightweight payment service for gym-related bookings built with Node.js, Express, PostgreSQL, and Stripe. It can create payment intents, store payment records, expose payment history, and handle Stripe webhook events.

## Features

- Create a payment record and initiate a Stripe payment intent
- Track payment status (`pending`, `processing`, `succeeded`, `failed`)
- Retrieve a single payment by ID
- Retrieve payments for the authenticated user
- Handle Stripe webhook events for successful or failed payments

## Project Structure

- `src/index.js` - application entry point
- `src/routes/` - API and webhook routes
- `src/controllers/` - request handlers
- `src/services/` - payment business logic
- `src/models/` - database access layer
- `src/config/` - DB and Stripe-related configuration

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (or Docker Engine)
- A Stripe account with test keys

## Environment Variables

Create a `.env` file in the project root with the following values:

```env
PORT=4004
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=devpass
DB_NAME=gym_payment
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Database Setup with Docker

Start a PostgreSQL container:

```bash
docker run --name gym-payment-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=gym_payment \
  -p 5432:5432 \
  -d postgres:16
```

Create the required extension and table:

```bash
docker exec -it gym-payment-postgres psql -U postgres -d gym_payment -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'

docker exec -it gym-payment-postgres psql -U postgres -d gym_payment -c '
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id TEXT NOT NULL,           
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',      
  status VARCHAR(20) NOT NULL DEFAULT 'pending',     
  provider_payment_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
'
```

You can verify the table exists with:

```bash
docker exec -it gym-payment-postgres psql -U postgres -d gym_payment -c '\dt'
```

## Installation

```bash
npm install
```

## Running the Service

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The service will run on port `4004` by default.

## API Endpoints

### Health Check

```bash
curl http://localhost:4004/health
```

### Create a Payment

```bash
curl -X POST http://localhost:4004/payments \
  -H "Content-Type: application/json" \
  -H "user-id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "referenceType": "session",
    "referenceId": "22222222-2222-2222-2222-222222222222",
    "amountCents": 5000,
    "currency": "usd"
  }'
```

### Get Payments for the Current User

```bash
curl http://localhost:4004/payments/me \
  -H "user-id: 11111111-1111-1111-1111-111111111111"
```

### Get a Specific Payment

```bash
curl http://localhost:4004/payments/123e4567-e89b-12d3-a456-426614174000 \
  -H "user-id: 11111111-1111-1111-1111-111111111111"
```

### Stripe Webhook

Stripe webhooks should be sent to:

```text
http://localhost:4004/webhooks/stripe
```

## Notes

- The service expects the authenticated user ID in the `user-id` header.
- Payment creation uses Stripe payment intents and stores the resulting payment status in PostgreSQL.
- The webhook route is registered before JSON parsing so Stripe signatures can be verified correctly.
