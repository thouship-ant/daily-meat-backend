const { getRedis } = require('../config/redis');

// Response cache for public, user-independent GET endpoints (catalog, banners, shop settings, delivery slots).
//
//   router.get('/products', cacheResponse({ ns: 'catalog', ttl: 300 }), handler)
//   router.use(invalidateOnWrite('catalog'))       // any successful POST/PUT/PATCH/DELETE clears that namespace
//
// Invalidation bumps a per-namespace version number, so it is a single O(1) command and old entries just expire.
// Every Redis failure falls through to the normal database path.
const PREFIX = 'dm:v1';

const getVersion = async (redis, ns) => (await redis.get(`${PREFIX}:ver:${ns}`)) || '0';

const cacheResponse = ({ ns, ttl = 60 }) => async (req, res, next) => {
  const redis = getRedis();
  if (!redis || req.method !== 'GET' || redis.status !== 'ready') return next();

  let key;
  try {
    key = `${PREFIX}:${ns}:${await getVersion(redis, ns)}:${req.originalUrl}`;
    const hit = await redis.get(key);
    if (hit) {
      res.set('X-Cache', 'HIT');
      res.status(200).type('application/json').send(hit);
      return;
    }
  } catch {
    return next();
  }

  res.set('X-Cache', 'MISS');
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && key) {
      redis.set(key, JSON.stringify(body), 'EX', ttl).catch(() => {});
    }
    return send(body);
  };
  next();
};

/** Drop everything cached under a namespace (call after data in it changed). */
const invalidate = async (...namespaces) => {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return;
  try {
    await Promise.all(namespaces.map((ns) => redis.incr(`${PREFIX}:ver:${ns}`)));
  } catch {
    /* entries expire by TTL anyway */
  }
};

/** Middleware: after a successful write request, clear the namespace(s). */
const invalidateOnWrite = (...namespaces) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => {
      if (res.statusCode < 400) invalidate(...namespaces);
    });
  }
  next();
};

module.exports = { cacheResponse, invalidate, invalidateOnWrite };
