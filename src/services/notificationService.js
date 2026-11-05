const { Expo } = require('expo-server-sdk');
const { getIo } = require('../config/socket');
const { Op } = require('sequelize');
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

// A token Expo reports as DeviceNotRegistered will never work again (app reinstalled / token rotated):
// drop it so it stops cluttering the list; the app uploads its fresh token when it next opens.
const removePushToken = async (token) => {
  try {
    const users = await User.findAll({ where: { push_token: { [Op.like]: `%${token}%` } } });
    for (const u of users) {
      const kept = u.push_token.split(',').map(t => t.trim()).filter(t => t && t !== token);
      await u.update({ push_token: kept.length ? kept.join(',') : null });
    }
  } catch (error) {
    console.error('Could not remove stale push token:', error.message);
  }
};

// A ticket only says Expo accepted the push. Whether FCM actually delivered it shows up in the receipt a
// little later (bad FCM credentials, unregistered device...), so log those failures instead of losing them.
const checkReceiptsLater = (tickets, chunk) => {
  const ids = tickets.filter(t => t.status === 'ok' && t.id).map(t => t.id);
  if (ids.length === 0) return;
  const tokenByTicket = {};
  tickets.forEach((t, i) => { if (t.id) tokenByTicket[t.id] = chunk[i].to; });
  setTimeout(async () => {
    try {
      for (const receiptChunk of expo.chunkPushNotificationReceiptIds(ids)) {
        const receipts = await expo.getPushNotificationReceiptsAsync(receiptChunk);
        for (const [id, r] of Object.entries(receipts)) {
          if (r.status !== 'error') continue;
          console.error('Expo push receipt error:', tokenByTicket[id], r.message, r.details);
          if (r.details && r.details.error === 'DeviceNotRegistered') removePushToken(tokenByTicket[id]);
        }
      }
    } catch (error) {
      console.error('Could not fetch push receipts:', error.message);
    }
  }, 60 * 1000);
};

// Expo rejects a batch whose tokens belong to different Expo projects (PUSH_TOO_MANY_EXPERIENCE_IDS),
// which would silently drop the push for everyone. On that error, resend one batch per project.
const sendChunk = async (chunk) => {
  const tickets = await expo.sendPushNotificationsAsync(chunk);
  checkReceiptsLater(tickets, chunk);
  tickets.forEach((t, i) => {
    if (t.status === 'error') {
      console.error('Expo push ticket error:', chunk[i].to, t.message, t.details);
      if (t.details && t.details.error === 'DeviceNotRegistered') removePushToken(chunk[i].to);
    }
  });
};

const sendPushMessages = async (messages) => {
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await sendChunk(chunk);
    } catch (error) {
      const groups = error && error.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS' && error.details
        ? Object.values(error.details)
        : null;
      if (!groups) {
        console.error('Error sending push notification chunk:', error);
        continue;
      }
      for (const tokens of groups) {
        try {
          await sendChunk(chunk.filter(m => tokens.includes(m.to)));
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
   * Send a different push to each recipient: items are { tokens, title, body, data } (used for reminders)
   */
  async sendPersonalised(items) {
    const messages = [];
    for (const { tokens, title, body, data = {} } of items) {
      for (const to of tokens) {
        if (Expo.isExpoPushToken(to)) messages.push({ to, ...alertOptions(), title, body, data });
      }
    }
    if (messages.length > 0) await sendPushMessages(messages);
    return messages.length;
  }

  /**
   * Notify all Admins
   */
  async notifyAdmins({ title, body, data = {}, socketEvent }) {
    try {
      // 1. Emit socket event if active
      // (a socket problem must never stop the push below, which is what reaches a closed/locked phone)
      if (socketEvent) {
        try {
          getIo().to('admin_room').emit(socketEvent, { title, body, data });
        } catch (socketError) {
          console.error('notifyAdmins socket emit failed:', socketError.message);
        }
      }

      // 2. Send Push Notification
      const admins = await User.findAll({ where: { role: 'ADMIN' } });
      const messages = [];
      const queued = new Set(); // one push per device even if several admin accounts hold the same token

      for (let admin of admins) {
        if (admin.push_token) {
          const tokens = admin.push_token.split(',').map(t => t.trim());
          for (const token of tokens) {
            if (Expo.isExpoPushToken(token) && !queued.has(token)) {
              queued.add(token);
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
