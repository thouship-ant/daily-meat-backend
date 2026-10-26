const { Order, User, OrderItem, Product, ProductVariant } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('../services/notificationService');
const { getIo } = require('../config/socket');

class DriverController {
  /**
   * Get active orders for the logged-in driver
   * GET /driver/orders/active
   */
  async getActiveOrders(req, res) {
    try {
      const driverId = req.user.id;

      const activeOrders = await Order.findAll({
        where: {
          driver_id: driverId,
          status: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY']
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'phone', 'email']
          },
          {
            model: OrderItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['name', 'image_url']
              },
              {
                model: ProductVariant,
                as: 'variant',
                attributes: ['weight', 'price']
              }
            ]
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      res.status(200).json(activeOrders);
    } catch (error) {
      console.error('Get active orders error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching active orders.' });
    }
  }

  /**
   * Get completed orders for the logged-in driver
   * GET /driver/orders/completed
   */
  async getCompletedOrders(req, res) {
    try {
      const driverId = req.user.id;

      const completedOrders = await Order.findAll({
        where: {
          driver_id: driverId,
          status: ['DELIVERED', 'FAILED']
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'phone', 'email']
          },
          {
            model: OrderItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['name', 'image_url']
              },
              {
                model: ProductVariant,
                as: 'variant',
                attributes: ['weight', 'price']
              }
            ]
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      res.status(200).json(completedOrders);
    } catch (error) {
      console.error('Get completed orders error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching completed orders.' });
    }
  }

  /**
   * Get single order details
   * GET /driver/orders/:id
   */
  async getOrderById(req, res) {
    try {
      const driverId = req.user.id;
      const { id } = req.params;

      const order = await Order.findOne({
        where: {
          id,
          driver_id: driverId
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'phone', 'email']
          },
          {
            model: OrderItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['name', 'image_url']
              },
              {
                model: ProductVariant,
                as: 'variant',
                attributes: ['weight', 'price']
              }
            ]
          }
        ]
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json(order);
    } catch (error) {
      console.error('Get order by id error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching order details.' });
    }
  }

  /**
   * Get dashboard statistics for the logged-in driver
   * GET /driver/orders/dashboard/stats
   */
  async getDashboardStats(req, res) {
    try {
      const driverId = req.user.id;
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Today's Stats
      const todayOrders = await Order.findAll({
        where: {
          driver_id: driverId,
          updatedAt: { [Op.gte]: startOfDay }
        },
        attributes: ['status']
      });

      let assigned = 0;
      let picked = 0;
      let outForDelivery = 0;
      let completedToday = 0;

      todayOrders.forEach(o => {
        if (o.status === 'ASSIGNED') assigned++;
        else if (o.status === 'PICKED') picked++;
        else if (o.status === 'OUT_FOR_DELIVERY') outForDelivery++;
        else if (o.status === 'DELIVERED') completedToday++;
      });

      // Also get all active orders just in case they were assigned before today but are still active
      const activeOrdersCount = await Order.count({
        where: {
          driver_id: driverId,
          status: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY']
        }
      });
      // We can use activeOrdersCount for a more accurate pending view if needed, but today's specific stats are good.

      // Weekly Graph Data (Last 7 days completed)
      const graphData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await Order.count({
          where: {
            driver_id: driverId,
            status: 'DELIVERED',
            updatedAt: { [Op.between]: [d, endOfDay] }
          }
        });

        // Format day e.g. "Mon", "Tue"
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        graphData.push({ day: dayStr, count });
      }

      res.status(200).json({
        stats: {
          assigned,
          picked,
          outForDelivery,
          completedToday
        },
        graphData
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching dashboard stats.' });
    }
  }

  /**
   * Mark an order as picked
   * PUT /driver/orders/:id/pick
   */
  async markPicked(req, res) {
    try {
      const driverId = req.user.id;
      const { id } = req.params;

      const order = await Order.findOne({
        where: {
          id,
          driver_id: driverId,
          status: 'ASSIGNED'
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found or not assigned to you.' });
      }

      order.status = 'PICKED';
      await order.save();

      res.status(200).json({ message: 'Order marked as picked successfully.', order });
    } catch (error) {
      console.error('Mark picked error:', error.message);
      res.status(500).json({ error: 'Internal server error while marking order as picked.' });
    }
  }

  /**
   * Mark an order as out for delivery
   * PUT /driver/orders/:id/out-for-delivery
   */
  async markOutForDelivery(req, res) {
    try {
      const driverId = req.user.id;
      const { id } = req.params;

      const order = await Order.findOne({
        where: {
          id,
          driver_id: driverId,
          status: 'PICKED'
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found or not in picked status.' });
      }

      order.status = 'OUT_FOR_DELIVERY';
      await order.save();

      // Notify Customer
      await notificationService.notifyUser({
        userId: order.user_id,
        title: 'Your order is on the way!',
        body: 'Your Daily Meat order is out for delivery and will arrive shortly.',
        data: { route: 'tracking', orderId: order.id },
        socketEvent: 'orderStatusChanged'
      });

      // Notify Admins
      await notificationService.notifyAdmins({
        title: `Order #${order.id} Out for Delivery`,
        body: `Driver has picked up Order #${order.id}.`,
        data: { route: 'admin_order', orderId: order.id },
        socketEvent: 'adminOrderStatusChanged'
      });

      res.status(200).json({ message: 'Order marked as out for delivery.', order });
    } catch (error) {
      console.error('Mark out for delivery error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating order.' });
    }
  }

  /**
   * Mark an order as delivered
   * PUT /driver/orders/:id/deliver
   */
  async markDelivered(req, res) {
    try {
      const driverId = req.user.id;
      const { id } = req.params;

      const order = await Order.findOne({
        where: {
          id,
          driver_id: driverId,
          status: 'OUT_FOR_DELIVERY'
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found or not assigned to you.' });
      }

      order.status = 'DELIVERED';
      order.delivered_at = new Date();
      
      if (order.payment_method === 'COD') {
        order.payment_status = 'PAID';
      }

      await order.save();

      // Notify Customer
      await notificationService.notifyUser({
        userId: order.user_id,
        title: 'Order Delivered!',
        body: 'Your order has been delivered. Enjoy your fresh meat!',
        data: { route: 'order_history', orderId: order.id },
        socketEvent: 'orderStatusChanged'
      });

      // Notify Admins
      await notificationService.notifyAdmins({
        title: `Order #${order.id} Delivered`,
        body: `Order #${order.id} has been successfully delivered.`,
        data: { route: 'admin_order', orderId: order.id },
        socketEvent: 'adminOrderStatusChanged'
      });

      res.status(200).json({ message: 'Order marked as delivered successfully.', order });
    } catch (error) {
      console.error('Mark delivered error:', error.message);
      res.status(500).json({ error: 'Internal server error while marking order as delivered.' });
    }
  }

  /**
   * Mark an order as failed
   * PUT /driver/orders/:id/fail
   */
  async markFailed(req, res) {
    try {
      const driverId = req.user.id;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required for failed delivery.' });
      }

      const order = await Order.findOne({
        where: {
          id,
          driver_id: driverId,
          status: 'OUT_FOR_DELIVERY'
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found or not assigned to you.' });
      }

      order.status = 'FAILED';
      order.failure_reason = reason;
      await order.save();

      // Notify Customer
      await notificationService.notifyUser({
        userId: order.user_id,
        title: 'Delivery Failed',
        body: `Unfortunately, we couldn't deliver your order. Reason: ${reason}`,
        data: { route: 'order_history', orderId: order.id },
        socketEvent: 'orderStatusChanged'
      });

      // Notify Admins
      await notificationService.notifyAdmins({
        title: `Delivery Failed: Order #${order.id}`,
        body: `Driver failed to deliver Order #${order.id}. Reason: ${reason}`,
        data: { route: 'admin_order', orderId: order.id },
        socketEvent: 'adminOrderStatusChanged'
      });

      res.status(200).json({ message: 'Order marked as failed successfully.', order });
    } catch (error) {
      console.error('Mark failed error:', error.message);
      res.status(500).json({ error: 'Internal server error while marking order as failed.' });
    }
  }

  /**
   * Bulk mark orders as picked (for routes)
   * PUT /driver/orders/bulk/pick
   */
  async markBulkPicked(req, res) {
    try {
      const driverId = req.user.id;
      const { order_ids } = req.body;

      if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'order_ids array is required.' });
      }

      await Order.update(
        { status: 'PICKED' },
        { where: { id: order_ids, driver_id: driverId, status: 'ASSIGNED' } }
      );

      res.status(200).json({ message: 'Orders marked as picked.' });
    } catch (error) {
      console.error('Bulk mark picked error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating orders.' });
    }
  }

  /**
   * Bulk mark orders as out for delivery (for routes)
   * PUT /driver/orders/bulk/out-for-delivery
   */
  async markBulkOutForDelivery(req, res) {
    try {
      const driverId = req.user.id;
      const { order_ids } = req.body;

      if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'order_ids array is required.' });
      }

      const orders = await Order.findAll({
        where: { id: order_ids, driver_id: driverId, status: 'PICKED' }
      });

      if (orders.length > 0) {
        const validOrderIds = orders.map(o => o.id);
        
        await Order.update(
          { status: 'OUT_FOR_DELIVERY' },
          { where: { id: validOrderIds } }
        );

        for (const order of orders) {
          // Notify Customer
          await notificationService.notifyUser({
            userId: order.user_id,
            title: 'Your order is on the way!',
            body: 'Your Daily Meat order is out for delivery and will arrive shortly.',
            data: { route: 'tracking', orderId: order.id },
            socketEvent: 'orderStatusChanged'
          });

          // Notify Admins
          await notificationService.notifyAdmins({
            title: `Order #${order.id} Out for Delivery`,
            body: `Driver has picked up Order #${order.id}.`,
            data: { route: 'admin_order', orderId: order.id },
            socketEvent: 'adminOrderStatusChanged'
          });
        }
      }

      res.status(200).json({ message: 'Orders marked as out for delivery.' });
    } catch (error) {
      console.error('Bulk mark out for delivery error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating orders.' });
    }
  }

  /**
   * Update driver location from background task
   * POST /driver/location
   */
  async updateLocation(req, res) {
    try {
      const driverId = req.user.id;
      const { orderIds, latitude, longitude, speed, heading } = req.body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: 'orderIds array is required.' });
      }

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
      }

      const io = getIo();
      if (io) {
        orderIds.forEach(orderId => {
          io.to(`order_${orderId}`).emit('orderLocationUpdate', {
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date().toISOString()
          });
        });
      }

      res.status(200).json({ success: true, message: 'Location updated via API.' });
    } catch (error) {
      console.error('Update driver location error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating location.' });
    }
  }
}

module.exports = new DriverController();
