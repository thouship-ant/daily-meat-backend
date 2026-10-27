const { Expo } = require('expo-server-sdk');
const { getIo } = require('../config/socket');
const { User } = require('../models');

const expo = new Expo();

// High priority makes Android deliver the push (with sound) immediately even when the phone is
// idle/screen-off (Doze); normal priority gets deferred or arrives silently. An optional channel
// lets the app route alerts to a high-importance channel with the order alert sound.
const alertOptions = () => ({
  sound: 'default',
  priority: 'high',
  ttl: 60 * 60,
  ...(process.env.ANDROID_NOTIFICATION_CHANNEL_ID ? { channelId: process.env.ANDROID_NOTIFICATION_CHANNEL_ID } : {}),
});

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
              ...alertOptions(),
              title: title,
              body: body,
              data: data,
            });
          }
        }

        if (messages.length > 0) {
          const chunks = expo.chunkPushNotifications(messages);
          for (let chunk of chunks) {
            try {
              await expo.sendPushNotificationsAsync(chunk);
            } catch (error) {
              console.error('Error sending push notification chunk:', error);
            }
          }
        }
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
    } catch (error) {
      console.error('NotificationService.emitOrderStatus error:', error);
    }
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
                ...alertOptions(),
                title: title,
                body: body,
                data: data,
              });
            }
          }
        }
      }

      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
          try {
            await expo.sendPushNotificationsAsync(chunk);
          } catch (error) {
            console.error('Error sending push notification to admins:', error);
          }
        }
      }
    } catch (error) {
      console.error('NotificationService.notifyAdmins error:', error);
    }
  }
}

module.exports = new NotificationService();
