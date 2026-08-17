-- Phase 5: prevent duplicate payment intents for the same reference
-- (race condition protection). Run against gym_payment database:
--
--   docker exec -it gym-payment-postgres psql -U postgres -d gym_payment -f /path/to/001_add_unique_reference.sql

ALTER TABLE payments
ADD CONSTRAINT unique_reference UNIQUE (reference_type, reference_id);