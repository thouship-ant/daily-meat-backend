const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { DeliverySlot, Order } = require('../models');
const notificationService = require('./notificationService');

const initSlotNotificationCron = () => {
  console.log('Initializing Slot Notification Cron Job...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const nowIST = moment().tz('Asia/Kolkata');
      const todayDate = nowIST.format('YYYY-MM-DD');

      // 1. Find all active delivery slots
      const activeSlots = await DeliverySlot.findAll({
        where: { is_active: true }
      });

      if (!activeSlots || activeSlots.length === 0) {
        return;
      }

      // 2. Filter slots that start exactly in ~5 minutes
      const upcomingSlots = [];
      for (const slot of activeSlots) {
        if (!slot.start_time) continue;

        const [hours, minutes] = slot.start_time.split(':');
        if (hours === undefined || minutes === undefined) continue;

        const slotMoment = moment.tz('Asia/Kolkata')
          .set({ hour: parseInt(hours, 10), minute: parseInt(minutes, 10), second: 0, millisecond: 0 });

        // Calculate diff in seconds to tolerate slight cron execution delays
        const diffSeconds = slotMoment.diff(nowIST, 'seconds');
        
        // Between 4 mins 30 secs and 5 mins 30 secs
        if (diffSeconds >= 270 && diffSeconds < 330) {
          upcomingSlots.push({ slot, targetMoment: slotMoment });
        }
      }

      if (upcomingSlots.length === 0) {
        return; 
      }

      // 3. For each matching slot, check for pending/confirmed orders
      for (const { slot, targetMoment } of upcomingSlots) {
        const orderCount = await Order.count({
          where: {
            delivery_slot_id: slot.id,
            status: { [Op.in]: ['PENDING', 'CONFIRMED'] },
            [Op.or]: [
              { delivery_date: todayDate },
              { delivery_date: null } // ASAP orders are usually for today
            ]
          }
        });

        // 4. If there are orders, notify admins
        if (orderCount > 0) {
          const ampmTime = targetMoment.format('hh:mm A'); // e.g., 09:00 AM
          await notificationService.notifyAdmins({
            title: `⏱️ Upcoming Orders for ${ampmTime}!`,
            body: `You have ${orderCount} order(s) scheduled for the "${slot.label}" slot starting in 5 minutes!`,
            socketEvent: 'admin_slot_alert',
            data: {
              type: 'SLOT_ALERT',
              slot_id: slot.id,
              target_time: slot.start_time
            }
          });
          console.log(`Slot Notification Sent: ${orderCount} orders for ${slot.label} at ${slot.start_time}`);
        }
      }
    } catch (error) {
      console.error('Error in slot notification cron:', error);
    }
  });
};

module.exports = {
  initSlotNotificationCron
};
