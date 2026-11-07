const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A pre-defined push notification plan: message + the dates and the IST time range it is sent in.
const ScheduledNotification = sequelize.define('ScheduledNotification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  audience: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ALL' }, // ALL | INACTIVE
  inactive_days: { type: DataTypes.INTEGER, allowNull: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  window_start: { type: DataTypes.STRING(5), allowNull: false }, // 'HH:mm' IST
  window_end: { type: DataTypes.STRING(5), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  last_sent_on: { type: DataTypes.DATEONLY, allowNull: true },
  last_sent_count: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'scheduled_notifications',
  timestamps: true,
});

module.exports = ScheduledNotification;
