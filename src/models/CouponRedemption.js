const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CouponRedemption = sequelize.define('CouponRedemption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('used'),
    allowNull: false,
    defaultValue: 'used',
  }
}, {
  tableName: 'coupon_redemptions',
  timestamps: true,
  indexes: [
    {
      name: 'coupon_redemptions_coupon_idx',
      fields: ['coupon_id'],
    },
    {
      name: 'coupon_redemptions_user_coupon_idx',
      fields: ['user_id', 'coupon_id'],
    },
    {
      name: 'coupon_redemptions_order_idx',
      unique: true,
      fields: ['order_id'],
    }
  ]
});

module.exports = CouponRedemption;
