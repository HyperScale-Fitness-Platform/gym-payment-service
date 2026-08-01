const pool = require("../config/database");

async function create({ userId, referenceType, referenceId, amountCents, currency }) {
  const result = await pool.query(
    `INSERT INTO payments (user_id, reference_type, reference_id, amount_cents, currency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, referenceType, referenceId, amountCents, currency]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query(
    "SELECT * FROM payments WHERE id = $1",
    [id]
  );
  return result.rows[0];
}

async function findByReference(referenceType, referenceId) {
  const result = await pool.query(
    "SELECT * FROM payments WHERE reference_type = $1 AND reference_id = $2",
    [referenceType, referenceId]
  );
  return result.rows[0];
}

async function updateStatus(id, { status, providerPaymentId }) {
  const result = await pool.query(
    `UPDATE payments
     SET status = $1, provider_payment_id = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, providerPaymentId, id]
  );
  return result.rows[0];
}

async function findByUserId(userId, limit, offset) {
  const result = await pool.query(
    `SELECT * FROM payments
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

module.exports = { create, findById, findByReference, updateStatus, findByUserId };