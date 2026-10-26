const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShopSettings = sequelize.define('ShopSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  shop_latitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  shop_longitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  delivery_radius_km: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 999.0, // Non-restrictive default (deliverability is pincode-based)
  },
  deliverable_pincodes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('deliverable_pincodes');
      try {
        return rawValue ? JSON.parse(rawValue) : [];
      } catch (e) {
        return [];
      }
    },
    set(value) {
      this.setDataValue('deliverable_pincodes', JSON.stringify(value || []));
    }
  },
  distance_tiers: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('distance_tiers');
      try {
        return rawValue ? JSON.parse(rawValue) : [];
      } catch (e) {
        return [];
      }
    },
    set(value) {
      this.setDataValue('distance_tiers', JSON.stringify(value || []));
    }
  },
  min_order_for_free_delivery: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1000.0,
  },
  delivery_fee_amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0,
  },
  free_delivery_distance_km: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 5.0,
  },
  distance_delivery_fee_amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0,
  },
  delivery_fee_strategy: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'amount', // 'amount' or 'distance'
  },
  store_start_time: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '09:00', // 24-hour HH:mm
    comment: 'Store opening time'
  },
  store_close_time: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '22:00', // 24-hour HH:mm
    comment: 'Store closing time'
  },
  orders_paused: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'When true, the shop is not accepting new orders'
  },
  pause_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "Under Maintenance",
    comment: 'Reason shown to customers when orders are paused'
  }
}, {
  tableName: 'shop_settings',
  timestamps: true,
});

module.exports = ShopSettings;
