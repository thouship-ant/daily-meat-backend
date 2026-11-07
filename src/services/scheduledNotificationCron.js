const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { ScheduledNotification } = require('../models');
const { sendMarketingPush } = require('./marketingService');

const IST = 'Asia/Kolkata';

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * The minute (IST, minutes after midnight) a plan goes out on a given day: one moment inside its time range.
 * It is derived from the plan and the date, so it is the same on every run (and every server) that day,
 * but different from day to day instead of always landing on the first minute of the range.
 */
const sendMinuteFor = (plan, ymd) => {
  const start = toMinutes(plan.window_start);
  const end = toMinutes(plan.window_end);
  if (end <= start) return start;
  // FNV-1a hash plus a final mix, so neighbouring dates give well-spread minutes
  let hash = 2166136261;
  for (const ch of `${plan.id}-${ymd}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519) >>> 0;
  hash ^= hash >>> 13;
  return start + ((hash >>> 0) % (end - start));
};

/** Plans that should go out now: active, today inside their dates, inside their time range, not sent today yet */
const duePlans = async (now = moment().tz(IST)) => {
  const today = now.format('YYYY-MM-DD');
  const minuteNow = now.hours() * 60 + now.minutes();
  const plans = await ScheduledNotification.findAll({
    where: {
      is_active: true,
      start_date: { [Op.lte]: today },
      end_date: { [Op.gte]: today },
      [Op.or]: [{ last_sent_on: null }, { last_sent_on: { [Op.ne]: today } }],
    },
  });
  return plans.filter((p) => {
    const at = sendMinuteFor(p, today);
    // from its send minute until the end of the range (a restart in the middle of the range still sends it)
    return minuteNow >= at && minuteNow < Math.max(toMinutes(p.window_end), at + 1);
  });
};

const runDuePlans = async () => {
  const today = moment().tz(IST).format('YYYY-MM-DD');
  for (const plan of await duePlans()) {
    // Claim today's send first: if another server instance already did, this update changes nothing and we skip
    const [claimed] = await ScheduledNotification.update(
      { last_sent_on: today },
      { where: { id: plan.id, [Op.or]: [{ last_sent_on: null }, { last_sent_on: { [Op.ne]: today } }] } }
    );
    if (!claimed) continue;
    try {
      const { devices, customers } = await sendMarketingPush({
        target: plan.audience,
        inactiveDays: plan.inactive_days,
        title: plan.title,
        body: plan.body,
        data: { route: 'home', type: 'SCHEDULED', planId: plan.id },
      });
      await plan.update({ last_sent_count: devices });
      console.log(`Scheduled notification "${plan.name}" sent to ${devices} devices (${customers} customers).`);
    } catch (error) {
      console.error(`Scheduled notification "${plan.name}" failed:`, error.message);
    }
  }
};

const initScheduledNotificationCron = () => {
  if (process.env.SCHEDULED_NOTIFICATIONS_ENABLED === 'false') {
    console.log('Scheduled notifications disabled (SCHEDULED_NOTIFICATIONS_ENABLED=false).');
    return;
  }
  console.log('Initializing Scheduled Notification Cron Job (checks every minute, IST)...');
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await runDuePlans();
      } catch (error) {
        console.error('Error in scheduled notification cron:', error.message);
      }
    },
    { timezone: IST }
  );
};

module.exports = { initScheduledNotificationCron, runDuePlans, duePlans, sendMinuteFor };
