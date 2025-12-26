require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  trino: {
    host: process.env.TRINO_HOST,
    port: process.env.TRINO_PORT,
    user: process.env.TRINO_USER,
    catalog: process.env.TRINO_CATALOG,
    schema: process.env.TRINO_SCHEMA,
  }
};