// Last known driver position per order, kept in memory so a customer who opens tracking (or reconnects)
// sees the rider immediately instead of waiting for the driver's next location ping.
const MAX_AGE_MS = 30 * 60 * 1000;
const lastByOrder = new Map();

const remember = (orderId, location) => {
  lastByOrder.set(String(orderId), { ...location, timestamp: new Date().toISOString() });
};

const recall = (orderId) => {
  const entry = lastByOrder.get(String(orderId));
  if (!entry) return null;
  if (Date.now() - new Date(entry.timestamp).getTime() > MAX_AGE_MS) {
    lastByOrder.delete(String(orderId));
    return null;
  }
  return entry;
};

module.exports = { remember, recall };
