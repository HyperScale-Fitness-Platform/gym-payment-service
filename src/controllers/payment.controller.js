const paymentService = require("../services/payment.service");

async function initiatePayment(req, res, next) {
  try {
    const userId = req.user.id;

    const { referenceType, referenceId, amountCents, currency } = req.body;

    const payment = await paymentService.initiatePayment({
      userId,
      referenceType,
      referenceId,
      amountCents,
      currency,
    });

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

async function getPayment(req, res, next) {
  try {
    const payment = await paymentService.getById(req.params.id);
    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
}

async function resumePayment(req, res, next) {
  try {
    const result = await paymentService.continuePayment(
      req.user.id,
      req.params.id,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function deletePayment(req, res, next) {
  try {
    const result = await paymentService.deletePayment(
      req.user.id,
      req.params.id,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMyPayments(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const payments = await paymentService.getUserPayments(userId, limit, offset);
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
}

module.exports = { initiatePayment, getPayment, resumePayment, deletePayment, getMyPayments };