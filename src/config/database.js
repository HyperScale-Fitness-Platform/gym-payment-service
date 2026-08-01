const { Pool } = require("pg");


const connectionString =
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
  `@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client (payment-service)", err);
});

module.exports = pool;