const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SellerBillItem = sequelize.define('SellerBillItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bill_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  product_name_snapshot: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  variant_name_snapshot: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'seller_bill_items',
  timestamps: true,
});

module.exports = SellerBillItem;
