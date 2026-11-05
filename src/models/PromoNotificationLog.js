const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per promotional push sent to a customer. Used so the same message is never sent twice in a day
// and the "add your address / place your first order" intro isn't repeated every run.
const PromoNotificationLog = sequelize.define('PromoNotificationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sent_on: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Indian Standard Time date the push was sent',
  },
  kind: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  message_key: {
    type: DataTypes.STRING(40),
    allowNull: false,
    comment: 'Hash of the title and body',
  },
}, {
  tableName: 'promo_notification_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [{ name: 'promo_logs_user_sent_idx', fields: ['user_id', 'sent_on'] }],
});

module.exports = PromoNotificationLog;
