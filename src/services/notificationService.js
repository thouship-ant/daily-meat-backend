const { Expo } = require('expo-server-sdk');
const { getIo } = require('../config/socket');
const { User } = require('../models');

const expo = new Expo();

// High priority makes Android deliver the push (with sound) immediately even when the phone is
// idle/screen-off (Doze); normal priority gets deferred or arrives silently. An optional channel
// lets the app route alerts to a high-importance channel with the order alert sound.
// Events that must ring loudly even when the app is closed: new orders (admins) and driver assignments.
// They use the app's 'order-alarm' channel, which plays the bundled noti.mp3 as an alarm-type sound.
const ALARM_EVENTS = ['adminNewOrder', 'admin_slot_alert', 'driverAssigned'];
const ALARM_CHANNEL_ID = process.env.ANDROID_ALARM_CHANNEL_ID || 'order-alarm';

const alertOptions = (socketEvent) => {
  if (ALARM_EVENTS.includes(socketEvent)) {
    return {
      sound: 'noti.mp3',
      priority: 'high',
      ttl: 60 * 60,
      channelId: ALARM_CHANNEL_ID,
      // iOS: deliver immediately, even through Focus / a locked screen
      interruptionLevel: 'time-sensitive',
    };
  }
  return {
    sound: 'default',
    priority: 'high',
    ttl: 60 * 60,
    ...(process.env.ANDROID_NOTIFICATION_CHANNEL_ID ? { channelId: process.env.ANDROID_NOTIFICATION_CHANNEL_ID } : {}),
  };
};

// Expo rejects a batch whose tokens belong to different Expo projects (PUSH_TOO_MANY_EXPERIENCE_IDS),
// which would silently drop the push for everyone. On that error, resend one batch per project.
const sendPushMessages = async (messages) => {
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === 'error') {
          console.error('Expo push ticket error:', chunk[i].to, t.message, t.details);
        }
      });
    } catch (error) {
      const groups = error && error.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS' && error.details
        ? Object.values(error.details)
        : null;
      if (!groups) {
        console.error('Error sending push notification chunk:', error);
        continue;
      }
      for (const tokens of groups) {
        const subset = chunk.filter(m => tokens.includes(m.to));
        try {
          await expo.sendPushNotificationsAsync(subset);
        } catch (err) {
          console.error('Error sending push notification project batch:', err);
        }
      }
    }
  }
};

class NotificationService {
  /**
   * Send a push notification and a socket event
   * @param {Object} params
   * @param {string} params.userId - The ID of the user to receive the notification
   * @param {string} params.title - Notification title
   * @param {string} params.body - Notification body
   * @param {Object} params.data - Deep link data or extra payload
   * @param {string} params.socketEvent - Socket event name to emit
   */
  async notifyUser({ userId, title, body, data = {}, socketEvent }) {
    try {
      // 1. Emit socket event if active
      if (socketEvent) {
        const io = getIo();
        // Emit to user-specific room
        io.to(`user_${userId}`).emit(socketEvent, { title, body, data });
      }

      // 2. Send Push Notification
      const user = await User.findByPk(userId);
      if (user && user.push_token) {
        const tokens = user.push_token.split(',').map(t => t.trim());
        const messages = [];

        for (const token of tokens) {
          if (Expo.isExpoPushToken(token)) {
            messages.push({
              to: token,
              ...alertOptions(socketEvent),
              title: title,
              body: body,
              data: data,
            });
          }
        }

        if (messages.length > 0) await sendPushMessages(messages);
      }
    } catch (error) {
      console.error('NotificationService.notifyUser error:', error);
    }
  }

  /**
   * Silently tell the customer's open app that an order's status changed (socket only, no push),
   * so the order details / tracking screen can update without a manual refresh.
   */
  emitOrderStatus(order) {
    try {
      const io = getIo();
      const payload = { data: { orderId: order.id, status: order.status } };
      io.to(`user_${order.user_id}`).emit('orderStatusChanged', payload);
      io.to(`order_${order.id}`).emit('orderStatusChanged', payload);
      // Keep every admin's order screens and dashboard in sync, whoever changed the status
      io.to('admin_room').emit('adminOrderStatusChanged', payload);
    } catch (error) {
      console.error('NotificationService.emitOrderStatus error:', error);
    }
  }

  /**
   * Send the same push to a list of Expo tokens (used for broadcasts)
   */
  async sendToTokens(tokens, { title, body, data = {} }) {
    const messages = tokens
      .filter(t => Expo.isExpoPushToken(t))
      .map(to => ({ to, ...alertOptions(), title, body, data }));
    if (messages.length > 0) await sendPushMessages(messages);
    return messages.length;
  }

  /**
   * Notify all Admins
   */
  async notifyAdmins({ title, body, data = {}, socketEvent }) {
    try {
      // 1. Emit socket event if active
      if (socketEvent) {
        const io = getIo();
        io.to('admin_room').emit(socketEvent, { title, body, data });
      }

      // 2. Send Push Notification
      const admins = await User.findAll({ where: { role: 'ADMIN' } });
      const messages = [];

      for (let admin of admins) {
        if (admin.push_token) {
          const tokens = admin.push_token.split(',').map(t => t.trim());
          for (const token of tokens) {
            if (Expo.isExpoPushToken(token)) {
              messages.push({
                to: token,
                ...alertOptions(socketEvent),
                title: title,
                body: body,
                data: data,
              });
            }
          }
        }
      }

      if (messages.length > 0) await sendPushMessages(messages);
    } catch (error) {
      console.error('NotificationService.notifyAdmins error:', error);
    }
  }
}

module.exports = new NotificationService();
