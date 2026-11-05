const { Sequelize } = require('sequelize');
require('dotenv').config();

// Pool and timeout settings. A pooled connection that the database/pooler silently dropped while idle can
// hang for minutes before the OS gives up, which made some requests take 2-3 minutes. Keep-alive, short idle
// time, a query timeout and an automatic retry make such a request fail fast and run again on a fresh connection.
const poolAndTimeouts = {
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: 0,
    acquire: 20000, // give up waiting for a free connection after 20s instead of 60s
    idle: 10000, // drop connections that sat idle for 10s (before the pooler does)
    evict: 5000,
  },
  retry: {
    max: 2,
    match: [/ConnectionError/, /ConnectionTimedOutError/, /ConnectionRefused/, /TimeoutError/, /ECONNRESET/, /EPIPE/, /timeout/i],
  },
};

const baseDialectOptions = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000, // a hung/slow query errors after 30s
  query_timeout: 30000,
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      ...poolAndTimeouts,
      dialectOptions: {
        ...baseDialectOptions,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: false,
        ...poolAndTimeouts,
        dialectOptions: baseDialectOptions,
      }
    );

module.exports = sequelize;
