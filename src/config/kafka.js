const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "gym-payment-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const producer = kafka.producer();

module.exports = { kafka, producer };
