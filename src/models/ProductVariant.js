const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  weight: {
    type: DataTypes.STRING(50),
    allowNull: false, // e.g., '500g', '1kg'
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  discounted_price: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  cost_price: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
    comment: 'Wholesale supplier price for this variant'
  },
  in_stock: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'product_variants',
  timestamps: true,
  indexes: [
    {
      name: 'variants_product_id_idx',
      fields: ['product_id'],
    }
  ]
});

module.exports = ProductVariant;
