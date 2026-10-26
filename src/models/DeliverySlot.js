const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliverySlot = sequelize.define('DeliverySlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  start_time: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., 09:00',
  },
  end_time: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., 11:00',
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., Morning: 9 AM - 11 AM',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'delivery_slots',
  timestamps: true,
});

module.exports = DeliverySlot;
