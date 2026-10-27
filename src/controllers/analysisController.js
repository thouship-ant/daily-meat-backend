const { Category, Product, ProductVariant, Order, OrderItem } = require('../models');
const { Op } = require('sequelize');
const { getISTRange } = require('../utils/istRange');

class AnalysisController {
  // Aggregate sales revenue, cost, profit, and stock health grouped by category
  async getCategoryAnalytics(req, res) {
    try {
      const filter = req.query.filter || 'all';
      // Delivered orders count in the period they were DELIVERED (IST), not when they were booked or
      // scheduled; cancelled orders count by booking time. Legacy delivered orders without
      // delivered_at fall back to booking time.
      let orderFilter = { status: { [Op.in]: ['DELIVERED', 'CANCELLED'] } };
      const range = getISTRange(filter, req.query.start_date, req.query.end_date);
      if (range) {
        const inRange = range.end
          ? { [Op.gte]: range.start, [Op.lt]: range.end }
          : { [Op.gte]: range.start };
        orderFilter = {
          [Op.or]: [
            { status: 'DELIVERED', delivered_at: inRange },
            { status: 'DELIVERED', delivered_at: null, createdAt: inRange },
            { status: 'CANCELLED', createdAt: inRange }
          ]
        };
      }

      // Step 1: Fetch all categories
      const categories = await Category.findAll({
        attributes: ['id', 'name', 'image_url'],
        where: { is_active: true }
      });

      // Step 2: Calculate inventory per category
      const inventoryData = await Product.findAll({
        attributes: ['category_id'],
        include: [
          {
            model: ProductVariant,
            as: 'variants',
            attributes: ['id', 'in_stock'],
          }
        ]
      });

      const inventoryMap = {}; 
      categories.forEach(c => { inventoryMap[c.id] = { totalVariants: 0, inStockVariants: 0 } });

      inventoryData.forEach(product => {
        if (!inventoryMap[product.category_id]) return;
        product.variants.forEach(v => {
          inventoryMap[product.category_id].totalVariants++;
          if (v.in_stock) {
             inventoryMap[product.category_id].inStockVariants++;
          }
        });
      });

      // Step 3: Fetch order items matching the date filter
      const orderItems = await OrderItem.findAll({
        include: [
          {
            model: Order,
            as: 'order',
            where: orderFilter,
            attributes: ['id', 'status']
          },
          {
            model: Product,
            as: 'product',
            attributes: ['category_id']
          }
        ]
      });

      // An order with items in several categories counts once per category above, so also report
      // overall distinct counts (what the app should show as the grand total, not the sum of categories)
      const overallDelivered = new Set();
      const overallCancelled = new Set();

      const analyticsMap = {};
      categories.forEach(c => {
        analyticsMap[c.id] = {
          id: c.id,
          name: c.name,
          image_url: c.image_url,
          totalRevenue: 0,
          grossSales: 0,
          netProfit: 0,
          totalOrdersCount: 0,
          cancelledRevenue: 0,
          cancelledOrdersCount: 0,
          inStockVariants: inventoryMap[c.id].inStockVariants,
          totalVariants: inventoryMap[c.id].totalVariants,
          _deliveredOrdersSet: new Set(),
          _cancelledOrdersSet: new Set(),
        };
      });

      orderItems.forEach(item => {
        const catId = item.product?.category_id;
        if (!catId || !analyticsMap[catId]) return;

        const stat = analyticsMap[catId];
        const status = item.order.status;
        const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1);
        const lineCost = (parseFloat(item.cost_price_snapshot) || 0) * (parseInt(item.quantity, 10) || 1);

        if (status === 'DELIVERED') {
           stat.totalRevenue += lineTotal;
           stat.grossSales += lineTotal;
           stat.netProfit += (lineTotal - lineCost);
           stat._deliveredOrdersSet.add(item.order.id);
           overallDelivered.add(item.order.id);
        } else if (status === 'CANCELLED') {
           stat.cancelledRevenue += lineTotal;
           stat._cancelledOrdersSet.add(item.order.id);
           overallCancelled.add(item.order.id);
        }
      });

      // Format final response
      const result = Object.values(analyticsMap).map(stat => ({
        id: stat.id,
        name: stat.name,
        image_url: stat.image_url,
        totalRevenue: stat.totalRevenue,
        grossSales: stat.grossSales,
        netProfit: stat.netProfit,
        totalOrdersCount: stat._deliveredOrdersSet.size,
        cancelledRevenue: stat.cancelledRevenue,
        cancelledOrdersCount: stat._cancelledOrdersSet.size,
        overallTotalOrdersCount: overallDelivered.size,
        overallCancelledOrdersCount: overallCancelled.size,
        inStockVariants: stat.inStockVariants,
        totalVariants: stat.totalVariants,
      }));

      res.status(200).json(result);
    } catch (error) {
      console.error('Get category analytics error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching category analytics.' });
    }
  }
}

module.exports = new AnalysisController();
