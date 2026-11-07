// Short-lived in-memory cache of the signed-in user, so most requests skip the "find the user" database
// round trip that every authenticated call used to make (a cross-region trip to the database each time).
//
// The cache is cleared for a user whenever that user is saved / updated / deleted through Sequelize (hooks in
// models/User.js), so a forced logout, deactivation or role change takes effect at once on this server. The TTL is
// only a safety net (e.g. a raw SQL update, or another server instance changing the user).
const TTL_MS = Number(process.env.USER_CACHE_TTL_MS) || 30 * 1000;
const MAX_ENTRIES = 2000;

const store = new Map(); // id -> { values, expires }

const get = (id) => {
  const hit = store.get(String(id));
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    store.delete(String(id));
    return null;
  }
  return hit.values;
};

const set = (id, values) => {
  if (TTL_MS <= 0) return;
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // drop the oldest
  store.set(String(id), { values, expires: Date.now() + TTL_MS });
};

const invalidate = (id) => {
  store.delete(String(id));
};

const clear = () => store.clear();

module.exports = { get, set, invalidate, clear };
