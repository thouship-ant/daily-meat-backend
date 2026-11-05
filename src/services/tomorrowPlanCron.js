const cron = require('node-cron');
const moment = require('moment-timezone');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Expo } = require('expo-server-sdk');
const { User, Order } = require('../models');
const PromoNotificationLog = require('../models/PromoNotificationLog');
const notificationService = require('./notificationService');

const IST = 'Asia/Kolkata';
const NOT_COUNTED = ['CANCELLED', 'FAILED'];
// One log entry per run (7 PM and 10 PM), so each run can reach a customer once but both runs can reach them
const kindFor = (now) => `tomorrow${now.format('HH')}`;

// Every day at 7:00 PM and 10:00 PM IST, remind customers to plan tomorrow's order:
//  - 'cancelled': they booked an order for today and cancelled it, and did not order again today
//  - 'noorder':   they have no order today at all (nothing placed or delivered)
// Customers who already have an order booked for tomorrow are skipped, and so is anyone who turned off
// promotional notifications. Set TOMORROW_PLAN_ALL_CUSTOMERS=false to send only the 'cancelled' group.
// Disable everything with TOMORROW_PLAN_REMINDER_ENABLED=false.
const MESSAGES = {
  cancelled: {
    title: "Plan tomorrow's order 🥩",
    body: 'Your order today was cancelled. Pre-book fresh chicken, mutton or fish for tomorrow and pick your delivery slot!',
  },
  noorder: {
    title: "Plan tomorrow's meals 🍗",
    body: "Pre-book fresh meat for tomorrow and choose the delivery slot that suits you. Order now!",
  },
};

const tokensOf = (user) =>
  String(user.push_token || '').split(',').map((t) => t.trim()).filter((t) => Expo.isExpoPushToken(t));
const messageKey = (kind) => crypto.createHash('sha1').update(`tomorrow|${kind}`).digest('hex').slice(0, 40);

const runTomorrowPlanReminder = async ({ dryRun = false } = {}) => {
  const now = moment.tz(IST);
  const today = now.format('YYYY-MM-DD');
  const runKind = kindFor(now);
  const tomorrow = now.clone().add(1, 'day').format('YYYY-MM-DD');
  const dayStart = now.clone().startOf('day').toDate();
  const dayEnd = now.clone().add(1, 'day').startOf('day').toDate();

  // Orders that belong to today: scheduled for today, or booked today as ASAP (no delivery date)
  const todaysOrders = await Order.findAll({
    where: {
      [Op.or]: [
        { delivery_date: today },
        { delivery_date: null, createdAt: { [Op.gte]: dayStart, [Op.lt]: dayEnd } },
      ],
    },
    attributes: ['user_id', 'status'],
    raw: true,
  });
  const hasLiveOrderToday = new Set();
  const cancelledToday = new Set();
  for (const o of todaysOrders) {
    if (NOT_COUNTED.includes(o.status)) {
      if (o.status === 'CANCELLED') cancelledToday.add(o.user_id);
    } else {
      hasLiveOrderToday.add(o.user_id);
    }
  }

  const tomorrowOrders = await Order.findAll({
    where: { delivery_date: tomorrow, status: { [Op.notIn]: NOT_COUNTED } },
    attributes: ['user_id'],
    raw: true,
  });
  const alreadyPlanned = new Set(tomorrowOrders.map((o) => o.user_id));

  const includeAll = process.env.TOMORROW_PLAN_ALL_CUSTOMERS !== 'false';
  const customers = await User.findAll({
    where: {
      role: 'CUSTOMER',
      is_active: true,
      push_token: { [Op.ne]: null },
      promotional_notifications: { [Op.or]: [true, null] },
    },
    attributes: ['id', 'push_token'],
  });

  // Never send this twice in the same run (restart / second instance)
  const logs = await PromoNotificationLog.findAll({
    where: { sent_on: today, kind: runKind },
    attributes: ['user_id'],
    raw: true,
  }).catch((error) => {
    console.error('Could not read promo_notification_logs:', error.message);
    return [];
  });
  const sentToday = new Set(logs.map((l) => l.user_id));

  const reminders = [];
  for (const user of customers) {
    if (hasLiveOrderToday.has(user.id) || alreadyPlanned.has(user.id) || sentToday.has(user.id)) continue;
    const kind = cancelledToday.has(user.id) ? 'cancelled' : includeAll ? 'noorder' : null;
    if (!kind) continue;
    const tokens = tokensOf(user);
    if (tokens.length === 0) continue;
    reminders.push({ userId: user.id, kind, tokens, ...MESSAGES[kind] });
  }

  const counts = reminders.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] || 0) + 1 }), {});
  if (!dryRun && reminders.length > 0) {
    await notificationService.sendPersonalised(
      reminders.map((r) => ({ tokens: r.tokens, title: r.title, body: r.body, data: { route: 'home', type: 'TOMORROW_PLAN' } }))
    );
    await PromoNotificationLog.bulkCreate(
      reminders.map((r) => ({ user_id: r.userId, sent_on: today, kind: runKind, message_key: messageKey(r.kind) }))
    ).catch((error) => console.error('Could not log tomorrow-plan reminders:', error.message));
  }
  console.log(`Tomorrow plan reminders ${dryRun ? 'prepared' : 'sent'}:`, JSON.stringify(counts));
  return { sent: dryRun ? 0 : reminders.length, counts, reminders };
};

const initTomorrowPlanCron = () => {
  if (process.env.TOMORROW_PLAN_REMINDER_ENABLED === 'false') {
    console.log('Tomorrow plan reminder cron disabled (TOMORROW_PLAN_REMINDER_ENABLED=false).');
    return;
  }
  console.log("Initializing Tomorrow Plan Reminder Cron Job (7:00 PM and 10:00 PM IST)...");
  cron.schedule(
    '0 19,22 * * *',
    async () => {
      try {
        await runTomorrowPlanReminder();
      } catch (error) {
        console.error('Error in tomorrow plan reminder cron:', error);
      }
    },
    { timezone: IST }
  );
};

module.exports = { initTomorrowPlanCron, runTomorrowPlanReminder };
