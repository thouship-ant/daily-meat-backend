const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Coupon = sequelize.define('Coupon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('code', value ? String(value).trim().toUpperCase() : value);
    }
  },
  title: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  discount_type: {
    type: DataTypes.ENUM('flat', 'percent'),
    allowNull: false,
  },
  discount_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  max_discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  min_order_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  max_order_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  start_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  visibility: {
    type: DataTypes.ENUM('public', 'hidden'),
    allowNull: false,
    defaultValue: 'public',
  },
  audience_type: {
    type: DataTypes.ENUM('all_users', 'new_users_only'),
    allowNull: false,
    defaultValue: 'all_users',
  },
  total_redemption_limit: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  per_user_limit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  auto_hide_after_use: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'coupons',
  timestamps: true,
  indexes: [
    {
      name: 'coupons_code_idx',
      unique: true,
      fields: ['code'],
    },
    {
      name: 'coupons_active_idx',
      fields: ['is_active', 'visibility'],
    }
  ]
});

module.exports = Coupon;
