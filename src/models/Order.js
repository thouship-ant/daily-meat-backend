const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.STRING,
    defaultValue: () => `ODDM${Math.floor(10000 + Math.random() * 90000)}`,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  subtotal_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Sum of item selling prices before delivery fee and coupon discount'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Coupon discount applied at order placement'
  },
  total_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Sum of all item cost prices at the time of order'
  },
  total_profit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'total_amount minus delivery_charge minus total_cost'
  },
  delivery_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Delivery fee charged at time of order placement',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  coupon_code_snapshot: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  payment_method: {
    type: DataTypes.STRING,
    defaultValue: 'COD',
  },
  payment_status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED'),
    defaultValue: 'PENDING',
    comment: 'Status of the payment for ONLINE methods'
  },
  cf_order_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cashfree internal order reference'
  },
  payment_session_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cashfree session for the frontend SDK'
  },
  delivery_instruction: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  delivery_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'The date requested for pre-order delivery. If null, it is an ASAP order.'
  },
  delivery_slot_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  delivery_slot_label: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Snapshot of the slot label (e.g. Morning: 9 AM - 11 AM) in case the slot config changes'
  },
  // Address Snapshot
  address_title: { type: DataTypes.STRING, allowNull: true },
  address_street: { type: DataTypes.STRING, allowNull: false },
  address_city: { type: DataTypes.STRING, allowNull: false },
  address_pincode: { type: DataTypes.STRING, allowNull: false },
  address_latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  address_longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
}, {
  tableName: 'orders',
  timestamps: true,
});

module.exports = Order;
