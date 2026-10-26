const sequelize = require('../config/database');

// Import models here
const User = require('./User');
const Address = require('./Address');
const ShopSettings = require('./ShopSettings');
const Category = require('./Category');
const Product = require('./Product');
const ProductVariant = require('./ProductVariant');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Coupon = require('./Coupon');
const CouponRedemption = require('./CouponRedemption');
const DeliverySlot = require('./DeliverySlot');
const SupportTicket = require('./SupportTicket');
const ContactMessage = require('./ContactMessage');
const SellerBill = require('./SellerBill');
const SellerBillItem = require('./SellerBillItem');
const Banner = require('./Banner');

// Relationships
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Driver Relationship
User.hasMany(Order, { foreignKey: 'driver_id', as: 'deliveries' });
Order.belongsTo(User, { foreignKey: 'driver_id', as: 'driver' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Coupon.hasMany(Order, { foreignKey: 'coupon_id', as: 'orders' });
Order.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

Coupon.hasMany(CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
CouponRedemption.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

User.hasMany(CouponRedemption, { foreignKey: 'user_id', as: 'coupon_redemptions' });
CouponRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Order.hasOne(CouponRedemption, { foreignKey: 'order_id', as: 'coupon_redemption' });
CouponRedemption.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'order_items' });

OrderItem.belongsTo(ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
ProductVariant.hasMany(OrderItem, { foreignKey: 'variant_id', as: 'order_items' });

User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'support_tickets' });
SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Order.hasMany(SupportTicket, { foreignKey: 'order_id', as: 'support_tickets' });
SupportTicket.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

SellerBill.hasMany(SellerBillItem, { foreignKey: 'bill_id', as: 'items' });
SellerBillItem.belongsTo(SellerBill, { foreignKey: 'bill_id', as: 'bill' });

SellerBillItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(SellerBillItem, { foreignKey: 'product_id', as: 'seller_bill_items' });

module.exports = {
  sequelize,
  User,
  Address,
  ShopSettings,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Coupon,
  CouponRedemption,
  DeliverySlot,
  SupportTicket,
  ContactMessage,
  SellerBill,
  SellerBillItem,
  Banner
};
