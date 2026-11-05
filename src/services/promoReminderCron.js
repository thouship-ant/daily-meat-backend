const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op, fn, col, literal } = require('sequelize');
const { Expo } = require('expo-server-sdk');
const crypto = require('crypto');
const { User, Order, OrderItem, Product, ProductVariant, ShopSettings, Address } = require('../models');
const PromoNotificationLog = require('../models/PromoNotificationLog');
const notificationService = require('./notificationService');

const IST = 'Asia/Kolkata';
// Runs on Sunday, Wednesday and Friday (disable everything with PROMO_REMINDERS_ENABLED=false). Each push goes out
// at a time inside its window, so 10,000 pushes don't all go out in the same second:
//  - 7:00 - 8:00 AM IST ('morning'): regular buyers (daily / weekly / monthly pattern) get a reorder reminder, and
//    new customers (no non-cancelled order yet) get the "add your address and order chicken, mutton, fish" intro
//  - 10:30 - 11:30 AM IST ('late'): new customers get one product with its weight and price
// The same message is never sent to a customer twice in a day (promo_notification_logs).
// The job ticks every 10 minutes inside a window and each customer has a fixed slot (from their id), so it is
// restart-safe and nobody is sent twice.
const SLOTS = 6; // ticks per window: :00 :10 :20 :30 :40 :50
const MORNING_CRON = '*/10 7 * * 0,3,5';
const NEW_CRON = '30,40,50 10 * * 0,3,5';
const NEW_CRON_2 = '0,10,20 11 * * 0,3,5';
const NOT_COUNTED_STATUSES = ['CANCELLED', 'FAILED'];
// New customers (no order yet) get the product offers during their first 60 days
const NEW_CUSTOMER_WINDOW_DAYS = 60;
// A frequent buyer stops being reminded once they have been away for this many typical gaps (or 14 days)
const LAPSED_AFTER_GAPS = 3;
// The intro is sent again only after this many days if the customer still hasn't ordered
const INTRO_REPEAT_DAYS = 7;

const rupees = (value) => `₹${Number(value) % 1 === 0 ? Number(value) : Number(value).toFixed(2)}`;

/** Cheapest sellable cut of every active product, with its price: [{ id, name, weight, price, popular }] */
const loadCatalog = async () => {
  const products = await Product.findAll({
    where: { is_active: true },
    include: [{ model: ProductVariant, as: 'variants', where: { is_active: true, in_stock: true }, required: true }],
  });
  return products.map((p) => {
    const priced = p.variants
      .map((v) => ({ weight: v.weight, price: Number(v.discounted_price) > 0 ? Number(v.discounted_price) : Number(v.price) }))
      .filter((v) => v.price > 0)
      .sort((a, b) => a.price - b.price)[0];
    return priced ? { id: p.id, name: p.name, weight: priced.weight, price: priced.price, popular: !!p.is_popular } : null;
  }).filter(Boolean);
};

// Emoji by product name: chicken leg, meat cut for mutton, fish
const emojiFor = (name) => {
  const n = String(name || '').toLowerCase();
  if (/fish|salmon|sangara|prawn|crab|seer|surmai|pomfret|anchovy|sardine|shrimp/.test(n)) return '🐟';
  if (/mutton|goat|lamb|keema|liver|brain/.test(n)) return '🥩';
  return '🍗';
};
const messageKey = (title, body) => crypto.createHash('sha1').update(`${title}|${body}`).digest('hex').slice(0, 40);

const offerText = (p) => `${p.name}${p.weight ? ` (${p.weight})` : ''} at just ${rupees(p.price)}`;

/** Two products to advertise today: popular / best-selling first, rotating so each run features different ones */
const pickPromoPair = async (catalog) => {
  if (catalog.length === 0) return [];
  const sold = await OrderItem.findAll({
    attributes: ['product_id', [fn('SUM', col('quantity')), 'qty']],
    group: ['product_id'],
    raw: true,
  });
  const qtyByProduct = new Map(sold.map((s) => [s.product_id, Number(s.qty)]));
  const ranked = [...catalog].sort(
    (a, b) => Number(b.popular) - Number(a.popular) || (qtyByProduct.get(b.id) || 0) - (qtyByProduct.get(a.id) || 0)
  );
  return ranked.slice(0, 3);
};

const tokensOf = (user) =>
  String(user.push_token || '').split(',').map((t) => t.trim()).filter((t) => Expo.isExpoPushToken(t));

/**
 * Builds the reminders without sending them. Returns [{ userId, tokens, title, body, kind }].
 *  - frequent buyers (daily / weekly / monthly pattern): "time to reorder your usual" with its current price
 *  - customers with no order yet: product offers with prices
 */
const buildReminders = async () => {
  const settings = await ShopSettings.findByPk(1);
  if (settings && settings.orders_paused) return { skipped: 'orders paused', reminders: [] };

  const catalog = await loadCatalog();
  if (catalog.length === 0) return { skipped: 'no products in stock', reminders: [] };

  const customers = await User.findAll({
    where: {
      role: 'CUSTOMER',
      is_active: true,
      promotional_notifications: { [Op.or]: [true, null] },
      push_token: { [Op.ne]: null },
      phone: { [Op.or]: [null, { [Op.notLike]: 'del\\_%' }] },
    },
    attributes: ['id', 'name', 'push_token', 'createdAt'],
  });
  const withPush = customers.filter((c) => tokensOf(c).length > 0);
  if (withPush.length === 0) return { reminders: [] };

  // Only customers in a deliverable pincode: at least one saved address must be in the shop's deliverable
  // list. (An empty list means everywhere is deliverable. Customers with no address yet can't be checked,
  // so they stay in - their push asks them to add an address.)
  const deliverable = new Set(((settings && settings.deliverable_pincodes) || []).map((p) => String(p).trim()));
  const allAddresses = await Address.findAll({
    where: { user_id: { [Op.in]: withPush.map((c) => c.id) } },
    attributes: ['user_id', 'pincode', 'createdAt'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  const deliverablePinByUser = new Map(); // first saved address inside the delivery area
  const hasAddress = new Set();
  for (const addr of allAddresses) {
    hasAddress.add(addr.user_id);
    const pin = String(addr.pincode || '').trim();
    if ((deliverable.size === 0 || deliverable.has(pin)) && !deliverablePinByUser.has(addr.user_id)) {
      deliverablePinByUser.set(addr.user_id, pin);
    }
  }
  const withTokens = withPush.filter((c) => !hasAddress.has(c.id) || deliverablePinByUser.has(c.id));
  if (withTokens.length === 0) return { reminders: [] };

  // Per customer: how many different days they ordered on, first and last order (IST days)
  const dayExpr = literal(`date_trunc('day', "createdAt" + interval '5 hours 30 minutes')`);
  const stats = await Order.findAll({
    where: { user_id: { [Op.in]: withTokens.map((c) => c.id) }, status: { [Op.notIn]: NOT_COUNTED_STATUSES } },
    attributes: [
      'user_id',
      [fn('COUNT', fn('DISTINCT', dayExpr)), 'days'],
      [fn('MIN', dayExpr), 'first'],
      [fn('MAX', dayExpr), 'last'],
    ],
    group: ['user_id'],
    raw: true,
  });
  const statsByUser = new Map(stats.map((s) => [s.user_id, s]));
  const today = moment.tz(IST).startOf('day');

  const due = []; // frequent buyers due a reminder
  const fresh = []; // never ordered
  for (const user of withTokens) {
    const s = statsByUser.get(user.id);
    if (!s) {
      const ageDays = today.diff(moment.tz(user.createdAt, IST).startOf('day'), 'days');
      if (ageDays >= 1 && ageDays <= NEW_CUSTOMER_WINDOW_DAYS) fresh.push(user);
      continue;
    }
    const days = Number(s.days);
    if (days < 3) continue; // not enough history to call them a regular
    const first = moment.tz(s.first, IST).startOf('day');
    const last = moment.tz(s.last, IST).startOf('day');
    const avgGap = Math.max(1, last.diff(first, 'days') / (days - 1));
    const sinceLast = today.diff(last, 'days');

    let cadence = null;
    if (avgGap <= 2) cadence = 'daily';
    else if (avgGap <= 10) cadence = 'weekly';
    else if (avgGap <= 45) cadence = 'monthly';
    if (!cadence) continue;

    const lapsed = sinceLast > Math.max(14, avgGap * LAPSED_AFTER_GAPS);
    // daily buyers: every run; weekly / monthly: the first run once their usual gap has passed
    // (runs are 2-3 days apart, so a 3-day window catches one run without nagging)
    const gap = Math.round(avgGap);
    const isDue = cadence === 'daily' ? sinceLast >= 1 : sinceLast >= gap && sinceLast < gap + 3;
    if (isDue && !lapsed) due.push({ user, cadence, sinceLast });
  }

  const reminders = [];
  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  const fallbackPair = await pickPromoPair(catalog);

  if (due.length > 0) {
    // Each regular's most-ordered product that is still available
    const favourites = await OrderItem.findAll({
      attributes: ['product_id', [col('order.user_id'), 'user_id'], [fn('SUM', col('OrderItem.quantity')), 'qty']],
      include: [{ model: Order, as: 'order', attributes: [], where: { user_id: { [Op.in]: due.map((d) => d.user.id) }, status: { [Op.notIn]: NOT_COUNTED_STATUSES } } }],
      group: ['order.user_id', 'product_id'],
      raw: true,
    });
    const favByUser = new Map();
    for (const f of favourites) {
      const product = catalogById.get(f.product_id);
      if (!product) continue;
      const current = favByUser.get(f.user_id);
      if (!current || Number(f.qty) > current.qty) favByUser.set(f.user_id, { product, qty: Number(f.qty) });
    }

    for (const d of due) {
      const product = favByUser.get(d.user.id)?.product || fallbackPair[0];
      if (!product) continue;
      const copy = {
        daily: { title: 'Fresh stock is in today 🍗', body: `Order your usual ${offerText(product)}, delivered fresh.` },
        weekly: { title: 'Time to restock for the week 🥩', body: `It's been ${d.sinceLast} days. ${offerText(product)} - order now!` },
        monthly: { title: 'Your monthly meat run 🥩', body: `It's been a while! ${offerText(product)}. Order now!` },
      }[d.cadence];
      reminders.push({ userId: d.user.id, tokens: tokensOf(d.user), kind: d.cadence, ...copy });
    }
  }

  if (fresh.length > 0) {
    // Does the new customer already have an address, and where? (pincode -> products ordered around them)
    const pincodeByUser = deliverablePinByUser;

    // What other customers order most in each pincode (delivered orders' address snapshot)
    const pincodes = [...new Set([...pincodeByUser.values()].filter(Boolean))];
    const rankedByPincode = new Map();
    if (pincodes.length > 0) {
      const rows = await OrderItem.findAll({
        attributes: ['product_id', [col('order.address_pincode'), 'pincode'], [fn('SUM', col('OrderItem.quantity')), 'qty']],
        include: [{ model: Order, as: 'order', attributes: [], where: { address_pincode: { [Op.in]: pincodes }, status: { [Op.notIn]: NOT_COUNTED_STATUSES } } }],
        group: ['order.address_pincode', 'product_id'],
        raw: true,
      });
      const byPin = new Map();
      for (const r of rows) {
        if (!catalogById.has(r.product_id)) continue;
        const list = byPin.get(String(r.pincode).trim()) || [];
        list.push({ product: catalogById.get(r.product_id), qty: Number(r.qty) });
        byPin.set(String(r.pincode).trim(), list);
      }
      for (const [pin, list] of byPin) rankedByPincode.set(pin, list.sort((x, y) => y.qty - x.qty).map((x) => x.product));
    }
    // Everyone else: most ordered overall (pickPromoPair is ordered popular / best-selling first)
    const dayIndex = moment.tz(IST).dayOfYear();

    for (const user of fresh) {
      const hasAddress = pincodeByUser.has(user.id);
      const introBody = hasAddress
        ? 'Place your first order for yummy chicken 🍗, mutton 🥩 and fish 🐟 - fresh to your door!'
        : 'Add your address and place an order for yummy chicken 🍗, mutton 🥩 and fish 🐟 - fresh to your door!';
      reminders.push({ userId: user.id, tokens: tokensOf(user), kind: 'intro', title: 'Welcome to Daily Meat 👋', body: introBody });

      // One item per push: top sellers around them, rotating through the top 3 so it differs between runs
      const local = rankedByPincode.get(pincodeByUser.get(user.id)) || [];
      const pool = (local.length > 0 ? local : fallbackPair).slice(0, 3);
      const product = pool[dayIndex % pool.length];
      if (product) {
        reminders.push({
          userId: user.id,
          tokens: tokensOf(user),
          kind: 'offer',
          title: local.length > 0 ? `Popular near you ${emojiFor(product.name)}` : `Fresh pick today ${emojiFor(product.name)}`,
          body: `${product.name}${product.weight ? ` (${product.weight})` : ''} - ${rupees(product.price)} only`,
        });
      }
    }
  }

  return { reminders };
};

// Fixed slot 0..SLOTS-1 for a customer, derived from their id
const slotOf = (userId) => parseInt(String(userId).replace(/-/g, '').slice(-8), 16) % SLOTS;

/**
 * Sends the reminders of one group in one slot (or just returns them with { dryRun: true }).
 * group: 'morning' (regular buyers + new-customer intro) | 'late' (new-customer product offer) | undefined (all);
 * slot: 0..SLOTS-1 | undefined (all slots)
 */
const runPromoReminders = async ({ dryRun = false, group, slot } = {}) => {
  const built = await buildReminders();
  if (built.skipped) {
    console.log(`Promo reminders skipped: ${built.skipped}`);
    return { sent: 0, skipped: built.skipped, reminders: [] };
  }
  let reminders = built.reminders.filter(
    (r) =>
      (!group || (group === 'late') === (r.kind === 'offer')) &&
      (slot === undefined || slotOf(r.userId) === slot)
  );

  // Never repeat a message the same day, and don't repeat the intro within INTRO_REPEAT_DAYS
  const today = moment.tz(IST).format('YYYY-MM-DD');
  if (reminders.length > 0) {
    // If the log table can't be read, the day's duplicate check is skipped rather than blocking the pushes
    const logs = await PromoNotificationLog.findAll({
      where: {
        user_id: { [Op.in]: [...new Set(reminders.map((r) => r.userId))] },
        sent_on: { [Op.gte]: moment.tz(IST).subtract(INTRO_REPEAT_DAYS, 'days').format('YYYY-MM-DD') },
      },
      attributes: ['user_id', 'sent_on', 'kind', 'message_key'],
      raw: true,
    }).catch((error) => {
      console.error('Could not read promo_notification_logs:', error.message);
      return [];
    });
    const sentToday = new Set(logs.filter((l) => l.sent_on === today).map((l) => `${l.user_id}|${l.message_key}`));
    const recentIntro = new Set(logs.filter((l) => l.kind === 'intro').map((l) => l.user_id));
    reminders = reminders.filter((r) => {
      if (sentToday.has(`${r.userId}|${messageKey(r.title, r.body)}`)) return false;
      if (r.kind === 'intro' && recentIntro.has(r.userId)) return false;
      return true;
    });
  }

  if (!dryRun && reminders.length > 0) {
    await notificationService.sendPersonalised(
      reminders.map((r) => ({ tokens: r.tokens, title: r.title, body: r.body, data: { route: 'home', type: 'PROMO_REMINDER' } }))
    );
    await PromoNotificationLog.bulkCreate(
      reminders.map((r) => ({ user_id: r.userId, sent_on: today, kind: r.kind, message_key: messageKey(r.title, r.body) }))
    );
  }
  const counts = reminders.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] || 0) + 1 }), {});
  console.log(`Promo reminders ${dryRun ? 'prepared' : 'sent'}:`, JSON.stringify(counts));
  return { sent: dryRun ? 0 : reminders.length, counts, reminders };
};

const initPromoReminderCron = () => {
  if (process.env.PROMO_REMINDERS_ENABLED === 'false') {
    console.log('Promo reminder cron disabled (PROMO_REMINDERS_ENABLED=false).');
    return;
  }
  console.log('Initializing promo reminder crons (7-8 AM and 10:30-11:30 AM IST, Sun/Wed/Fri)...');
  // Creates the log table the first time (no-op afterwards; nothing else is altered)
  PromoNotificationLog.sync().catch((error) => console.error('Could not prepare promo_notification_logs:', error.message));

  const tick = (group, slotOf2) => async () => {
    try {
      await runPromoReminders({ group, slot: slotOf2(moment.tz(IST)) });
    } catch (error) {
      console.error(`Error in promo reminder cron (${group}):`, error);
    }
  };
  const options = { timezone: IST };
  cron.schedule(MORNING_CRON, tick('morning', (now) => Math.floor(now.minute() / 10)), options);
  // 10:30, 10:40, 10:50, 11:00, 11:10, 11:20 -> slots 0..5
  const newSlot = (now) => Math.floor(((now.hour() - 10) * 60 + now.minute() - 30) / 10);
  cron.schedule(NEW_CRON, tick('late', newSlot), options);
  cron.schedule(NEW_CRON_2, tick('late', newSlot), options);
};

module.exports = { initPromoReminderCron, runPromoReminders, buildReminders };
