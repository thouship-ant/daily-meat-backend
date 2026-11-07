// Request timing: logs every request, flags slow ones, and keeps per-endpoint statistics in memory so we can
// see which endpoints are actually slow (GET /api/admin/perf).
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 800;
const MAX_SAMPLES = 200; // recent durations kept per endpoint, for the percentile

const stats = new Map(); // "GET /api/admin/orders/:id" -> { count, errors, totalMs, maxMs, slow, samples[] }

// Use the matched route pattern, so /orders/123 and /orders/456 count as one endpoint
const endpointKey = (req) => {
  const pattern = req.route && req.route.path ? `${req.baseUrl || ''}${req.route.path}` : req.originalUrl.split('?')[0];
  return `${req.method} ${pattern}`;
};

const record = (key, ms, status) => {
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, totalMs: 0, maxMs: 0, slow: 0, samples: [] };
    stats.set(key, s);
  }
  s.count += 1;
  s.totalMs += ms;
  if (ms > s.maxMs) s.maxMs = ms;
  if (ms >= SLOW_MS) s.slow += 1;
  if (status >= 500) s.errors += 1;
  s.samples.push(ms);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();
};

const percentile = (samples, p) => {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const requestTimer = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const rounded = Math.round(ms);
    const key = endpointKey(req);
    record(key, rounded, res.statusCode);
    const auth = req._authMs !== undefined ? ` auth:${req._authMs}ms` : '';
    const flag = rounded >= SLOW_MS ? ' SLOW' : '';
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${rounded}ms${auth}${flag}`);
  });
  next();
};

// Slowest endpoints first (by 95th percentile)
const snapshot = () =>
  [...stats.entries()]
    .map(([endpoint, s]) => ({
      endpoint,
      count: s.count,
      avgMs: Math.round(s.totalMs / s.count),
      p50Ms: percentile(s.samples, 50),
      p95Ms: percentile(s.samples, 95),
      maxMs: s.maxMs,
      slowRequests: s.slow,
      errors: s.errors,
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms);

const reset = () => stats.clear();

module.exports = { requestTimer, snapshot, reset, SLOW_MS };
