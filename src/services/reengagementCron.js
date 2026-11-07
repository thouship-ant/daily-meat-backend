const cron = require('node-cron');
const moment = require('moment-timezone');
const { User, Order } = require('../models');
const { Op } = require('sequelize');
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

const initReengagementCron = () => {
  console.log('Initializing Re-engagement Cron Job...');

  // Run once a day at 10:00 AM (server local time)
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('Running daily re-engagement check...');

      // Find users whose last order was exactly 7 days ago in IST
      const sevenDaysAgoStart = moment.tz('Asia/Kolkata').subtract(7, 'days').startOf('day').toDate();
      const sevenDaysAgoEnd = moment.tz('Asia/Kolkata').subtract(7, 'days').endOf('day').toDate();

      const customers = await User.findAll({ 
        where: { 
          role: 'CUSTOMER', 
          is_active: true,
          promotional_notifications: { [Op.or]: [true, null] }
        } 
      });
      const targetUsers = [];
      const seenTokens = new Set();

      for (const customer of customers) {
        const tokens = String(customer.push_token || '').split(',').map((t) => t.trim())
          .filter((t) => Expo.isExpoPushToken(t) && !seenTokens.has(t));
        if (tokens.length === 0) continue;

        const lastOrder = await Order.findOne({
          where: { user_id: customer.id },
          order: [['createdAt', 'DESC']]
        });

        // Check if their most recent order was exactly 7 days ago
        if (lastOrder && lastOrder.createdAt >= sevenDaysAgoStart && lastOrder.createdAt <= sevenDaysAgoEnd) {
          targetUsers.push(customer);
          tokens.forEach((t) => seenTokens.add(t));
        }
      }

      if (seenTokens.size > 0) {
        await require('./notificationService').sendToTokens([...seenTokens], {
          title: 'We miss you! 🥩',
          body: 'It’s been a week! Treat yourself to some fresh, premium meat today.',
          data: { route: 'home' },
        });
        console.log(`Sent re-engagement push to ${targetUsers.length} users (${seenTokens.size} devices).`);
      }

    } catch (error) {
      console.error('Error in reengagement cron:', error);
    }
  });
};

module.exports = {
  initReengagementCron
};
