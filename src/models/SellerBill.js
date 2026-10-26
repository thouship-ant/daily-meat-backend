const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SellerBill = sequelize.define('SellerBill', {
  id: {
    type: DataTypes.STRING,
    defaultValue: () => `DM${Math.floor(10000 + Math.random() * 90000)}`,
    primaryKey: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'CANCELLED'),
    defaultValue: 'PENDING',
  },
  category_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  supplier_name: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'seller_bills',
  timestamps: true,
});

module.exports = SellerBill;
