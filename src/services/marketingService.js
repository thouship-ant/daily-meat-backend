// Shared by the admin "Marketing Broadcast" and the scheduled notification plans.
const { Expo } = require('expo-server-sdk');
const { Op, literal } = require('sequelize');
const sequelize = require('../config/database');
const { User } = require('../models');
const notificationService = require('./notificationService');

/**
 * Push tokens of the customers who should get a promotional push.
 *   target 'ALL'      every active customer who has not opted out
 *   target 'INACTIVE' only those with no order in the last `inactiveDays` days (default 14)
 * One database query in both cases (the old inactive filter ran one query per customer).
 */
const getAudienceTokens = async ({ target = 'ALL', inactiveDays } = {}) => {
  const where = {
    role: 'CUSTOMER',
    is_active: true,
    promotional_notifications: { [Op.or]: [true, null] },
    push_token: { [Op.ne]: null },
    phone: { [Op.or]: [null, { [Op.notLike]: 'del\\_%' }] }, // deleted accounts
  };
  if (target === 'INACTIVE') {
    const days = parseInt(inactiveDays, 10) || 14;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where[Op.and] = [
      literal(`NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = "User"."id" AND o."createdAt" >= ${sequelize.escape(cutoff)})`),
    ];
  }

  const users = await User.findAll({ where, attributes: ['id', 'push_token'], raw: true });

  // push_token holds every device of a user, comma separated: check each token on its own, send each device once
  const tokens = new Set();
  for (const user of users) {
    for (const token of String(user.push_token || '').split(',').map((t) => t.trim())) {
      if (Expo.isExpoPushToken(token)) tokens.add(token);
    }
  }
  return { customers: users.length, tokens: [...tokens] };
};

/** Sends the push to the audience and returns how many devices it was handed to Expo for */
const sendMarketingPush = async ({ target, inactiveDays, title, body, data }) => {
  const { tokens, customers } = await getAudienceTokens({ target, inactiveDays });
  if (tokens.length > 0) {
    await notificationService.sendToTokens(tokens, { title, body, data: data || { route: 'home', type: 'MARKETING' } });
  }
  return { devices: tokens.length, customers };
};

/** Push to the admins' devices only (used to preview a plan before it goes to customers) */
const sendToAdmins = async ({ title, body, data }) => {
  const admins = await User.findAll({ where: { role: 'ADMIN' }, attributes: ['push_token'], raw: true });
  const tokens = new Set();
  for (const a of admins) {
    for (const t of String(a.push_token || '').split(',').map((x) => x.trim())) {
      if (Expo.isExpoPushToken(t)) tokens.add(t);
    }
  }
  if (tokens.size > 0) await notificationService.sendToTokens([...tokens], { title, body, data: data || { route: 'home', type: 'MARKETING' } });
  return { devices: tokens.size };
};

module.exports = { getAudienceTokens, sendMarketingPush, sendToAdmins };
