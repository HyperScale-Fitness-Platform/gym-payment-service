const { producer } = require("../../config/kafka");

async function publishPaymentStatus({ referenceType, referenceId, status }) {
  await producer.send({
    topic: "PAYMENT_STATUS",
    messages: [
      {
        key: referenceId,
        value: JSON.stringify({
          referenceType,
          referenceId,
          status,
        }),
      },
    ],
  });

  console.log(`[Kafka] Published PAYMENT_STATUS: ${referenceType} ${referenceId} → ${status}`);
}

module.exports = { publishPaymentStatus };
