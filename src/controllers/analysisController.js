const { Category, Product, ProductVariant, Order, OrderItem } = require('../models');
const { Op } = require('sequelize');

class AnalysisController {
  // Aggregate sales revenue, cost, profit, and stock health grouped by category
  async getCategoryAnalytics(req, res) {
    try {
      const filter = req.query.filter || 'all';
      let dateFilter = {};
      const now = new Date();
      
      // Parse temporal filter (today, week, month, or custom start/end range)
      if (filter === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        dateFilter = { createdAt: { [Op.gte]: startOfDay } };
      } else if (filter === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
      } else if (filter === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
      } else if (filter === 'custom' && req.query.start_date && req.query.end_date) {
        const startDate = new Date(req.query.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(req.query.end_date);
        endDate.setHours(23, 59, 59, 999);
        dateFilter = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };
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
            where: dateFilter,
            attributes: ['id', 'status']
          },
          {
            model: Product,
            as: 'product',
            attributes: ['category_id']
          }
        ]
      });

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
        } else if (status === 'CANCELLED') {
           stat.cancelledRevenue += lineTotal;
           stat._cancelledOrdersSet.add(item.order.id);
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
