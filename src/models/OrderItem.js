const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  product_name_snapshot: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  variant_name_snapshot: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  cost_price_snapshot: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Snapshot of the wholesale price at the time of order'
  },
  instruction: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'order_items',
  indexes: [
    { name: 'order_items_order_id_idx', fields: ['order_id'] },
    { name: 'order_items_product_id_idx', fields: ['product_id'] },
  ],
  timestamps: true,
});

module.exports = OrderItem;
