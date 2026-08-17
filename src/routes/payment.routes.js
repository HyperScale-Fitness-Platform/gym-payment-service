const express = require("express");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

router.post("/", paymentController.initiatePayment);
router.get("/me", paymentController.getMyPayments);
router.post("/:id/continue", paymentController.resumePayment);
router.delete("/:id", paymentController.deletePayment);
router.get("/:id", paymentController.getPayment);

module.exports = router;