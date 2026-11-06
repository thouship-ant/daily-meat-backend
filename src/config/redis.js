const Redis = require('ioredis');

// Redis is optional: without REDIS_URL (or when Redis is down) every call quietly does nothing and the app
// reads straight from the database, exactly as before. So Redis can never take the API down.
//   REDIS_URL=redis://redis:6379          (docker compose)
//   REDIS_URL=redis://:password@host:6379
let client = null;
let lastErrorLog = 0;

const getRedis = () => {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false, // while disconnected, commands fail at once instead of piling up
    connectTimeout: 5000,
    commandTimeout: 500, // a slow Redis must never make a request slower than the database would be
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on('connect', () => console.log('[redis] connected'));
  client.on('error', (err) => {
    // log at most once a minute so an outage does not flood the log
    if (Date.now() - lastErrorLog > 60000) {
      lastErrorLog = Date.now();
      console.error('[redis] error (cache bypassed):', err.message);
    }
  });
  return client;
};

module.exports = { getRedis };
