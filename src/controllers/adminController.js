const { User, Order, OrderItem, Product, ProductVariant } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { USER_ROLES } = require('../constants/enum');
const notificationService = require('../services/notificationService');
const { getIo } = require('../config/socket');
const { parse } = require('json2csv');
const { getISTRange } = require('../utils/istRange');

// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Helper to get IST-adjusted boundaries and conditions for both delivery_date and createdAt
function getDateCondition(period, Op, startStr = null, endStr = null) {
  const nowUTC = new Date();
  const istTime = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
  
  const getStr = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'today') {
    const startOfISTDay = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate(), 0, 0, 0, 0));
    const start = new Date(startOfISTDay.getTime() - (5.5 * 60 * 60 * 1000));
    return {
      [Op.or]: [
        { delivery_date: getStr(istTime) },
        { createdAt: { [Op.gte]: start } }
      ]
    };
  } else if (period === 'week') {
    const startOfWeekIST = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate(), 0, 0, 0, 0));
    startOfWeekIST.setUTCDate(startOfWeekIST.getUTCDate() - startOfWeekIST.getUTCDay());
    const start = new Date(startOfWeekIST.getTime() - (5.5 * 60 * 60 * 1000));
    return {
      [Op.or]: [
        { delivery_date: { [Op.gte]: getStr(startOfWeekIST) } },
        { createdAt: { [Op.gte]: start } }
      ]
    };
  } else if (period === 'month') {
    const startOfMonthIST = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), 1, 0, 0, 0, 0));
    const start = new Date(startOfMonthIST.getTime() - (5.5 * 60 * 60 * 1000));
    return {
      [Op.or]: [
        { delivery_date: { [Op.gte]: getStr(startOfMonthIST) } },
        { createdAt: { [Op.gte]: start } }
      ]
    };
  } else if (period === 'custom' && startStr && endStr) {
    return {
      [Op.or]: [
        { delivery_date: { [Op.between]: [startStr, endStr] } },
        {
          createdAt: {
            [Op.gte]: new Date(startStr),
            [Op.lte]: new Date(`${endStr}T23:59:59.999Z`)
          }
        }
      ]
    };
  }
  return {};
}

// Date condition for DELIVERED orders: matches on the actual completion time (delivered_at),
// so orders booked on different days but delivered in the period are all counted.
// Legacy delivered orders without delivered_at fall back to the booking/scheduled-date condition.
function getDeliveredDateCondition(period, Op, startStr = null, endStr = null) {
  const range = getISTRange(period, startStr, endStr);
  if (!range) return {};

  const deliveredAt = range.end ? { [Op.gte]: range.start, [Op.lt]: range.end } : { [Op.gte]: range.start };
  return {
    [Op.or]: [
      { delivered_at: deliveredAt },
      { [Op.and]: [{ delivered_at: null }, getDateCondition(period, Op, startStr, endStr)] }
    ]
  };
}

// Date condition for order lists: delivered orders match by delivery time, cancelled by booking time,
// everything else by booking/scheduled date. Returns null when the period has no date filter.
function getStatusAwareDateCondition(period, Op, startStr = null, endStr = null) {
  const range = getISTRange(period, startStr, endStr);
  if (!range) return null;

  const created = range.end
    ? { [Op.gte]: range.start, [Op.lt]: range.end }
    : { [Op.gte]: range.start };
  return {
    [Op.or]: [
      { [Op.and]: [{ status: 'DELIVERED' }, getDeliveredDateCondition(period, Op, startStr, endStr)] },
      { status: 'CANCELLED', createdAt: created },
      { [Op.and]: [{ status: { [Op.notIn]: ['DELIVERED', 'CANCELLED'] } }, getDateCondition(period, Op, startStr, endStr)] }
    ]
  };
}

class AdminController {
  /**
   * Create a new driver account
   * POST /admin/drivers
   */
  async createDriver(req, res) {
    try {
      const { phone, password, name, email } = req.body;

      if (!phone || !password || !name) {
        return res.status(400).json({ error: 'Phone, password, and name are required.' });
      }

      // Check if user exists
      const existingUser = await User.findOne({ where: { phone } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this phone number already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const driver = await User.create({
        phone,
        password: hashedPassword,
        name,
        email: email || null,
        role: USER_ROLES.DRIVER || 'DRIVER',
        is_profile_completed: true,
      });

      res.status(201).json({
        message: 'Driver created successfully',
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          role: driver.role
        }
      });
    } catch (error) {
      console.error('Create driver error:', error.message);
      res.status(500).json({ error: 'Internal server error while creating driver.' });
    }
  }

  /**
   * Get assignment suggestions for a specific order
   * GET /admin/orders/:id/assignment-suggestions
   */
  async getAssignmentSuggestions(req, res) {
    try {
      const { id } = req.params;
      const radiusKm = 5; // Configurable search radius in km

      // Fetch the target order
      const targetOrder = await Order.findByPk(id);
      if (!targetOrder) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      if (!targetOrder.address_latitude || !targetOrder.address_longitude) {
         return res.status(400).json({ error: 'Target order has no coordinates.' });
      }

      // Fetch all CONFIRMED orders (unassigned) and ASSIGNED/PICKED orders (assigned but not out)
      const otherOrders = await Order.findAll({
        where: {
          status: ['CONFIRMED', 'ASSIGNED', 'PICKED'],
        },
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'name', 'phone'],
          }
        ]
      });

      const suggestions = {
        nearbyUnassignedOrders: [],
        nearbyActiveDrivers: []
      };

      const addedDriverIds = new Set();

      for (const order of otherOrders) {
        if (order.id === targetOrder.id) continue;

        if (order.address_latitude && order.address_longitude) {
          const distance = calculateDistance(
            targetOrder.address_latitude,
            targetOrder.address_longitude,
            order.address_latitude,
            order.address_longitude
          );

          if (distance <= radiusKm) {
            if (order.status === 'CONFIRMED') {
              suggestions.nearbyUnassignedOrders.push({
                orderId: order.id,
                distanceKm: distance.toFixed(2),
                address: `${order.address_street}, ${order.address_city}`
              });
            } else if (['ASSIGNED', 'PICKED'].includes(order.status) && order.driver_id) {
              if (!addedDriverIds.has(order.driver_id)) {
                // Check if this driver has ANY OUT_FOR_DELIVERY orders
                const outForDeliveryCount = await Order.count({
                  where: { driver_id: order.driver_id, status: 'OUT_FOR_DELIVERY' }
                });
                if (outForDeliveryCount === 0) {
                  suggestions.nearbyActiveDrivers.push({
                    driver: order.driver,
                    distanceKm: distance.toFixed(2),
                    activeOrderId: order.id
                  });
                  addedDriverIds.add(order.driver_id);
                }
              }
            }
          }
        }
      }

      // Also suggest all completely free drivers (0 OUT_FOR_DELIVERY orders)
      const allDrivers = await User.findAll({ where: { role: 'DRIVER' } });
      const freeDrivers = [];
      
      for (const driver of allDrivers) {
        const activeCount = await Order.count({
          where: { driver_id: driver.id, status: 'OUT_FOR_DELIVERY' }
        });
        if (activeCount === 0) {
           freeDrivers.push({ id: driver.id, name: driver.name, phone: driver.phone });
        }
      }

      suggestions.freeDrivers = freeDrivers;

      res.status(200).json(suggestions);
    } catch (error) {
      console.error('Get assignment suggestions error:', error.message);
      res.status(500).json({ error: 'Internal server error while getting suggestions.' });
    }
  }

  /**
   * Assign driver to orders
   * PUT /admin/orders/assign-driver
   */
  async assignDriver(req, res) {
    try {
      const { driver_id, order_ids } = req.body;

      if (!driver_id || !order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'driver_id and an array of order_ids are required.' });
      }

      const driver = await User.findByPk(driver_id);
      if (!driver || driver.role !== 'DRIVER') {
        return res.status(404).json({ error: 'Driver not found or invalid role.' });
      }

      const assignable = await Order.findAll({ where: { id: order_ids, status: 'CONFIRMED' } });

      await Order.update(
        { driver_id, status: 'ASSIGNED' },
        { where: { id: assignable.map(o => o.id), status: 'CONFIRMED' } }
      );

      // Let each customer's open order screen move to "Assigned to Rider"
      assignable.forEach(o => notificationService.emitOrderStatus({ id: o.id, user_id: o.user_id, status: 'ASSIGNED' }));

      // Notify Driver (sound alert via the new-orders channel / in-app alarm), only if something was assigned
      if (assignable.length > 0) {
        await notificationService.notifyUser({
          userId: driver_id,
          title: 'New Delivery Assigned',
          body: `You have been assigned to deliver ${assignable.length} new order(s).`,
          data: { route: 'driver_active_orders', orderIds: assignable.map(o => o.id) },
          socketEvent: 'driverAssigned'
        });
      }

      res.status(200).json({ message: 'Orders assigned to driver successfully.' });
    } catch (error) {
      console.error('Assign driver error:', error.message);
      res.status(500).json({ error: 'Internal server error while assigning driver.' });
    }
  }

  /**
   * Get all orders for admin
   * GET /admin/orders
   */
  async getAllOrders(req, res) {
    try {
      const { startDate, endDate, date, status } = req.query;
      const { OrderItem, Product, ProductVariant } = require('../models');
      const { Op } = require('sequelize');

      const whereClause = {
        [Op.or]: [
          { payment_method: 'COD' },
          { payment_status: 'PAID' },
          { payment_status: 'REFUNDED' },
          { payment_status: 'FAILED' } // Just to be safe, maybe don't filter payment? But keeping it as is. Wait, originally it didn't include FAILED but let's keep original
        ]
      };
      // Keep original payment logic
      whereClause[Op.or] = [
        { payment_method: 'COD' },
        { payment_status: 'PAID' },
        { payment_status: 'REFUNDED' }
      ];

      // 1. Status Filter
      if (status) {
        // e.g., 'DELIVERED', 'CANCELLED'
        whereClause.status = status;
      }

      // 2. Date Filter
      let dateCondition = null;
      if (startDate && endDate) {
        dateCondition = getStatusAwareDateCondition('custom', Op, startDate, endDate);
      } else if (['today', 'week', 'month'].includes(date)) {
        dateCondition = getStatusAwareDateCondition(date, Op);
      }
      if (dateCondition) {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(dateCondition);
      }

      const orders = await Order.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
          { model: User, as: 'driver', attributes: ['id', 'name', 'phone'] },
          {
            model: OrderItem,
            as: 'items',
            include: [
              { model: Product, as: 'product', attributes: ['name', 'image_url'] },
              { model: ProductVariant, as: 'variant', attributes: ['weight', 'price'] }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      res.status(200).json(orders);
    } catch (error) {
      console.error('Get all orders error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching all orders.' });
    }
  }

  /**
   * Update order status
   * PUT /admin/orders/:id/status
   */
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      if (status === 'CANCELLED') {
        if (['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'].includes(order.status)) {
          return res.status(400).json({ error: `Cannot cancel an order that is already ${order.status}.` });
        }
      }

      order.status = status;
      if (status === 'DELIVERED') {
        order.delivered_at = new Date();
      } else if (status === 'PENDING') {
        // Reset logistics if it's being re-ordered
        order.driver_id = null;
        order.failure_reason = null;
      }
      await order.save();

      // Every status change updates the customer's open order screen live (with the new status)
      notificationService.emitOrderStatus(order);

      // Notifications based on status
      if (status === 'CONFIRMED') {
        await notificationService.notifyUser({
          userId: order.user_id,
          title: 'Order Confirmed!',
          body: 'Your order has been confirmed and is being prepared.',
          data: { route: 'order_history', orderId: order.id },
          socketEvent: 'orderStatusChanged'
        });
      } else if (status === 'OUT_FOR_DELIVERY') {
        await notificationService.notifyUser({
          userId: order.user_id,
          title: 'Your order is on the way!',
          body: 'Your Daily Meat order is out for delivery and will arrive shortly.',
          data: { route: 'tracking', orderId: order.id },
          socketEvent: 'orderStatusChanged'
        });
      } else if (status === 'DELIVERED') {
        await notificationService.notifyUser({
          userId: order.user_id,
          title: 'Order Delivered!',
          body: 'Your order has been delivered. Enjoy your fresh meat!',
          data: { route: 'order_history', orderId: order.id },
          socketEvent: 'orderStatusChanged'
        });
      } else if (status === 'CANCELLED') {
        // Notify Customer
        await notificationService.notifyUser({
          userId: order.user_id,
          title: 'Order Cancelled',
          body: 'Your order has been cancelled by the admin.',
          data: { route: 'order_history', orderId: order.id },
          socketEvent: 'orderStatusChanged'
        });
        
        // Notify Driver if assigned
        if (order.driver_id) {
          await notificationService.notifyUser({
            userId: order.driver_id,
            title: 'Order Cancelled',
            body: `Order #${order.id} has been cancelled and removed from your route.`,
            data: { route: 'driver_active_orders', orderId: order.id, status: 'CANCELLED' },
            socketEvent: 'driverOrderStatusChanged'
          });
        }
      }

      res.status(200).json({ message: 'Order status updated successfully.', order });
    } catch (error) {
      console.error('Update order status error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating order status.' });
    }
  }
  /**
   * Log every ADMIN out of all devices (including the caller)
   * POST /admin/logout-all-admins
   */
  async logoutAllAdmins(req, res) {
    try {
      const [affected] = await User.update(
        { tokens_valid_after: new Date(), refresh_token: null, push_token: null },
        { where: { role: 'ADMIN' } }
      );

      // Tell open admin apps to go to login, then drop their socket connections
      const io = getIo();
      io.to('admin_room').emit('forceLogout', { code: 'SESSION_ENDED', message: 'You have been logged out from all devices.' });
      io.in('admin_room').disconnectSockets(true);

      res.status(200).json({ message: `Logged out ${affected} admin account(s) from all devices.` });
    } catch (error) {
      console.error('Logout all admins error:', error.message);
      res.status(500).json({ error: 'Internal server error while logging out admins.' });
    }
  }

  /**
   * Get all drivers with analytics
   * GET /admin/drivers
   */
  async getAllDrivers(req, res) {
    try {
      const drivers = await User.findAll({
        where: { role: 'DRIVER' },
        attributes: ['id', 'name', 'email', 'phone', 'is_active', 'is_profile_completed', 'createdAt']
      });

      // Fetch analytics for each driver
      const driversWithStats = await Promise.all(drivers.map(async (driver) => {
        const activeOrdersCount = await Order.count({
          where: { 
            driver_id: driver.id, 
            status: { [Op.in]: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY'] } 
          }
        });
        const completedOrdersCount = await Order.count({
          where: { driver_id: driver.id, status: 'DELIVERED' }
        });

        return {
          ...driver.toJSON(),
          activeOrdersCount,
          completedOrdersCount
        };
      }));

      res.status(200).json(driversWithStats);
    } catch (error) {
      console.error('Get all drivers error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching drivers.' });
    }
  }

  /**
   * Get specific driver details and their active orders
   * GET /admin/drivers/:id
   */
  async getDriverDetails(req, res) {
    try {
      const { id } = req.params;
      const driver = await User.findOne({
        where: { id, role: 'DRIVER' },
        attributes: ['id', 'name', 'email', 'phone', 'is_active', 'createdAt']
      });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found.' });
      }

      const activeOrdersCount = await Order.count({
        where: { 
          driver_id: id, 
          status: { [Op.in]: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY'] }
        }
      });
      const completedOrdersCount = await Order.count({
        where: { driver_id: id, status: 'DELIVERED' }
      });

      const activeOrders = await Order.findAll({
        where: { 
          driver_id: id, 
          status: { [Op.in]: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY'] }
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
          {
            model: OrderItem,
            as: 'items',
            include: [
              { model: Product, as: 'product', attributes: ['name', 'image_url'] },
              { model: ProductVariant, as: 'variant', attributes: ['weight', 'price'] }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        driver,
        stats: {
          activeOrdersCount,
          completedOrdersCount
        },
        activeOrders
      });
    } catch (error) {
      console.error('Get driver details error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching driver details.' });
    }
  }

  /**
   * Get all customers
   * GET /admin/customers
   */
  async getAllCustomers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = (req.query.search || req.query.q || '').trim();
      const offset = (page - 1) * limit;

      const whereClause = { role: 'CUSTOMER' };

      if (search) {
        const cleanDigits = search.replace(/\D/g, '');
        const orConditions = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];

        if (cleanDigits && cleanDigits.length >= 3 && cleanDigits !== search) {
          orConditions.push({ phone: { [Op.iLike]: `%${cleanDigits}%` } });
        }

        whereClause[Op.or] = orConditions;
      }

      const { count, rows } = await User.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'name', 'phone', 'email', 'is_active', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      res.status(200).json({
        data: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      console.error('Get all customers error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching customers.' });
    }
  }

  /**
   * Export all customers to CSV
   * GET /admin/customers/export
   */
  async exportCustomers(req, res) {
    try {
      const customers = await User.findAll({
        where: { role: 'CUSTOMER' },
        attributes: ['name', 'phone'],
        order: [['createdAt', 'DESC']]
      });

      if (!customers || customers.length === 0) {
        return res.status(404).json({ error: 'No customers found to export.' });
      }

      // Format data with only Name and Mobile Number
      // Use ="<phone>" format so Excel treats mobile number as text and never converts to scientific notation (like 9.87E+09)
      const customersData = customers.map(c => {
        const rawPhone = c.phone ? String(c.phone).trim() : '';
        return {
          'Name': c.name || 'N/A',
          'Mobile Number': rawPhone ? `="${rawPhone}"` : ''
        };
      });

      const fields = ['Name', 'Mobile Number'];
      const csvData = parse(customersData, { fields });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
      return res.status(200).send(csvData);
    } catch (error) {
      console.error('Export customers error:', error.message);
      res.status(500).json({ error: 'Internal server error while exporting customers.' });
    }
  }

  /**
   * Search customer by phone for manual orders
   * GET /admin/customers/search?phone=XYZ
   */
  async searchCustomerByPhone(req, res) {
    try {
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ error: 'Phone is required' });

      const customer = await User.findOne({ where: { phone, role: 'CUSTOMER' } });
      if (!customer) return res.json({ found: false });

      // Fetch all saved addresses
      const { Address } = require('../models');
      const addresses = await Address.findAll({
        where: { user_id: customer.id },
        order: [['is_default', 'DESC'], ['createdAt', 'DESC']]
      });

      // Also fetch last order just in case they have no saved addresses but have an order
      const lastOrder = await Order.findOne({
        where: { user_id: customer.id },
        order: [['createdAt', 'DESC']]
      });

      res.json({
        found: true,
        customer: {
          name: customer.name,
          phone: customer.phone,
          addresses: addresses.map(a => ({
            id: a.id,
            street: a.street,
            city: a.city,
            pincode: a.pincode,
            title: a.title
          })),
          lastAddress: lastOrder ? {
            street: lastOrder.address_street,
            city: lastOrder.address_city
          } : null
        }
      });
    } catch (error) {
      console.error('Search customer error:', error.message);
      res.status(500).json({ error: 'Internal server error while searching customer.' });
    }
  }

  /**
   * Get specific customer details with analytics
   * GET /admin/customers/:id
   */
  async getCustomerDetails(req, res) {
    try {
      const { id } = req.params;
      const customer = await User.findOne({
        where: { id, role: 'CUSTOMER' },
        attributes: ['id', 'name', 'phone', 'email', 'is_active', 'createdAt']
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found.' });
      }

      // Fetch all DELIVERED orders for revenue calculation
      const orders = await Order.findAll({
        where: { user_id: id, status: 'DELIVERED' },
        attributes: ['total_amount']
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

      // Fetch all orders for history
      const { OrderItem, Product, ProductVariant } = require('../models');
      const orderHistory = await Order.findAll({
        where: { user_id: id },
        include: [
          { model: User, as: 'driver', attributes: ['id', 'name', 'phone'] },
          {
            model: OrderItem,
            as: 'items',
            include: [
              { model: Product, as: 'product', attributes: ['name', 'image_url'] },
              { model: ProductVariant, as: 'variant', attributes: ['weight', 'price'] }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 10 // only recent 10 for display
      });

      res.status(200).json({
        customer,
        analytics: {
          totalOrders,
          totalRevenue: totalRevenue.toFixed(2)
        },
        recentOrders: orderHistory
      });
    } catch (error) {
      console.error('Get customer details error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching customer details.' });
    }
  }

  /**
   * Toggle customer active status
   * PUT /admin/customers/:id/status
   */
  async toggleCustomerStatus(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be a boolean.' });
      }

      const customer = await User.findOne({ where: { id, role: 'CUSTOMER' } });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found.' });
      }

      customer.is_active = is_active;
      await customer.save();

      res.status(200).json({ message: 'Customer status updated successfully.', customer });
    } catch (error) {
      console.error('Toggle customer status error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating customer status.' });
    }
  }

  /**
   * Toggle driver active status
   * PUT /admin/drivers/:id/status
   */
  async toggleDriverStatus(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be a boolean.' });
      }

      const driver = await User.findOne({ where: { id, role: 'DRIVER' } });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found.' });
      }

      driver.is_active = is_active;
      await driver.save();

      res.status(200).json({ message: 'Driver status updated successfully.', driver });
    } catch (error) {
      console.error('Toggle driver status error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating driver status.' });
    }
  }

  /**
   * Get comprehensive dashboard statistics
   * GET /admin/dashboard
   */
  async getDashboardStats(req, res) {
    try {
      // Import necessary models
      const { OrderItem, Product, ProductVariant } = require('../models');

      const filter = req.query.filter || 'all'; // 'today', 'week', 'month', 'custom', 'all'
      
      const baseFilter = {
        [Op.or]: [
          { payment_method: 'COD' },
          { payment_status: 'PAID' },
          { payment_status: 'REFUNDED' }
        ]
      };
      if (['today', 'week', 'month'].includes(filter)) {
        baseFilter[Op.and] = baseFilter[Op.and] || [];
        baseFilter[Op.and].push(getDateCondition(filter, Op));
      } else if (filter === 'custom' && req.query.start_date && req.query.end_date) {
        baseFilter[Op.and] = baseFilter[Op.and] || [];
        baseFilter[Op.and].push(getDateCondition('custom', Op, req.query.start_date, req.query.end_date));
      }

      // Delivered orders are bucketed by when they were delivered, not when they were booked
      const paymentFilter = { [Op.or]: baseFilter[Op.or] };
      const deliveredFilter = { ...paymentFilter };
      if (['today', 'week', 'month'].includes(filter)) {
        deliveredFilter[Op.and] = [getDeliveredDateCondition(filter, Op)];
      } else if (filter === 'custom' && req.query.start_date && req.query.end_date) {
        deliveredFilter[Op.and] = [getDeliveredDateCondition('custom', Op, req.query.start_date, req.query.end_date)];
      }

      // 1. Total Revenue (Only from DELIVERED orders)
      const deliveredOrders = await Order.findAll({
        where: { status: 'DELIVERED', ...deliveredFilter },
        attributes: ['total_amount', 'total_profit', 'delivery_charge']
      });
      const grossSales = deliveredOrders.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0);
      const netProfit = deliveredOrders.reduce((sum, order) => sum + (parseFloat(order.total_profit) || 0), 0);
      const totalDeliveryFees = deliveredOrders.reduce((sum, order) => sum + (parseFloat(order.delivery_charge) || 0), 0);

      // 2. Order Counts by Status
      // Total uses the same status-aware bucketing as the order lists, so a cancelled order is
      // counted on the day it was booked, not the day it was scheduled for.
      const totalFilter = { ...paymentFilter };
      const totalDate = getStatusAwareDateCondition(filter, Op, req.query.start_date, req.query.end_date);
      if (totalDate) totalFilter[Op.and] = [totalDate];
      const totalOrdersCount = await Order.count({ where: totalFilter });
      const pendingOrdersCount = await Order.count({
        where: { status: 'PENDING', ...baseFilter }
      });
      const activeDeliveriesCount = await Order.count({
        where: { status: { [Op.in]: ['ASSIGNED', 'PICKED', 'OUT_FOR_DELIVERY'] }, ...baseFilter }
      });
      const completedDeliveriesCount = await Order.count({
        where: { status: 'DELIVERED', ...deliveredFilter }
      });

      // 3. User Counts (All-time, generally not filtered by date on overview)
      const totalCustomers = await User.count({ where: { role: 'CUSTOMER' } });
      const totalDrivers = await User.count({ where: { role: 'DRIVER' } });

      // 4. Recent Orders (Top 5, applying date filter if any)
      // Delivered orders are shown by delivery time and cancelled ones by booking time,
      // so an order delivered/cancelled on an earlier day isn't listed just because it was scheduled today.
      const recentFilter = { ...paymentFilter };
      const recentDate = getStatusAwareDateCondition(
        filter, Op, req.query.start_date, req.query.end_date
      );
      if (recentDate) recentFilter[Op.and] = [recentDate];

      const recentOrders = await Order.findAll({
        where: recentFilter,
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
          {
            model: OrderItem,
            as: 'items',
            include: [
              { model: Product, as: 'product', attributes: ['name', 'image_url'] },
              { model: ProductVariant, as: 'variant', attributes: ['weight', 'price'] }
            ]
          }
        ]
      });

      res.status(200).json({
        revenue: {
          total: grossSales, // kept for backward compatibility
          grossSales,
          netProfit,
          totalDeliveryFees
        },
        orders: {
          total: totalOrdersCount,
          pending: pendingOrdersCount,
          active: activeDeliveriesCount,
          completed: completedDeliveriesCount
        },
        users: {
          customers: totalCustomers,
          drivers: totalDrivers
        },
        recentOrders
      });

    } catch (error) {
      console.error('Get dashboard stats error:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching dashboard stats.' });
    }
  }

  // ==========================================
  // Delivery Slots Management
  // ==========================================

  async createDeliverySlot(req, res) {
    try {
      const { DeliverySlot } = require('../models');
      const { start_time, end_time, label, is_active } = req.body;

      if (!start_time || !end_time || !label) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const slot = await DeliverySlot.create({
        start_time,
        end_time,
        label,
        is_active: is_active !== undefined ? is_active : true
      });

      res.status(201).json({ message: 'Delivery slot created successfully', slot });
    } catch (error) {
      console.error('Create delivery slot error:', error);
      res.status(500).json({ error: 'Failed to create delivery slot.' });
    }
  }

  async getDeliverySlots(req, res) {
    try {
      const { DeliverySlot } = require('../models');
      const slots = await DeliverySlot.findAll();
      
      const parseTime = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(' ');
        const [h, m] = parts[0].split(':');
        let hours = parseInt(h, 10) || 0;
        const minutes = parseInt(m, 10) || 0;
        if (parts[1]) {
          const modifier = parts[1].toUpperCase();
          if (hours === 12) {
            hours = modifier === 'AM' ? 0 : 12;
          } else if (modifier === 'PM') {
            hours += 12;
          }
        }
        return hours * 60 + minutes;
      };

      slots.sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));
      
      res.status(200).json(slots);
    } catch (error) {
      console.error('Get delivery slots error:', error);
      res.status(500).json({ error: 'Failed to fetch delivery slots.' });
    }
  }

  async updateDeliverySlot(req, res) {
    try {
      const { DeliverySlot } = require('../models');
      const { id } = req.params;
      const { start_time, end_time, label, is_active } = req.body;

      const slot = await DeliverySlot.findByPk(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      await slot.update({
        start_time: start_time || slot.start_time,
        end_time: end_time || slot.end_time,
        label: label || slot.label,
        is_active: is_active !== undefined ? is_active : slot.is_active
      });

      res.status(200).json({ message: 'Delivery slot updated successfully', slot });
    } catch (error) {
      console.error('Update delivery slot error:', error);
      res.status(500).json({ error: 'Failed to update delivery slot.' });
    }
  }

  async deleteDeliverySlot(req, res) {
    try {
      const { DeliverySlot } = require('../models');
      const { id } = req.params;

      const slot = await DeliverySlot.findByPk(id);
      if (!slot) {
        return res.status(404).json({ error: 'Delivery slot not found.' });
      }

      await slot.destroy();
      res.status(200).json({ message: 'Delivery slot deleted successfully' });
    } catch (error) {
      console.error('Delete delivery slot error:', error);
      res.status(500).json({ error: 'Failed to delete delivery slot.' });
    }
  }
  // ==========================================
  // Support Tickets Management
  // ==========================================

  async getAllTickets(req, res) {
    try {
      const { SupportTicket, Order, User } = require('../models');
      const tickets = await SupportTicket.findAll({
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
          { model: Order, as: 'order', attributes: ['id', 'status', 'total_amount', 'createdAt'] }
        ],
        order: [['created_at', 'DESC']]
      });
      res.status(200).json(tickets);
    } catch (error) {
      console.error('Get all tickets error:', error);
      res.status(500).json({ error: 'Failed to fetch tickets.' });
    }
  }

  async updateTicketStatus(req, res) {
    try {
      const { SupportTicket } = require('../models');
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'status is required.' });
      }

      const ticket = await SupportTicket.findByPk(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      await ticket.update({ status });

      res.status(200).json({ message: 'Ticket status updated successfully', ticket });
    } catch (error) {
      console.error('Update ticket status error:', error);
      res.status(500).json({ error: 'Failed to update ticket status.' });
    }
  }

  // ==========================================
  // Marketing Notifications
  // ==========================================

  async sendMarketingBroadcast(req, res) {
    try {
      const { target, inactiveDays, title, body, data } = req.body;
      const { User, Order } = require('../models');

      if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required.' });
      }

      let targetUsers = [];

      if (target === 'INACTIVE') {
        const days = parseInt(inactiveDays, 10) || 14;
        const inactiveDate = new Date();
        inactiveDate.setDate(inactiveDate.getDate() - days);

        const customers = await User.findAll({ 
          where: { 
            role: 'CUSTOMER', 
            is_active: true,
            promotional_notifications: { [Op.or]: [true, null] }
          } 
        });
        for (const customer of customers) {
          const lastOrder = await Order.findOne({ 
            where: { user_id: customer.id }, 
            order: [['createdAt', 'DESC']] 
          });
          if (!lastOrder || lastOrder.createdAt < inactiveDate) {
            targetUsers.push(customer);
          }
        }
      } else {
        targetUsers = await User.findAll({ 
          where: { 
            role: 'CUSTOMER', 
            is_active: true,
            promotional_notifications: { [Op.or]: [true, null] }
          } 
        });
      }

      let sentCount = 0;
      // We will gather all tokens to send them efficiently instead of querying the DB in a loop
      const { Expo } = require('expo-server-sdk');
      const expo = new Expo();
      const messages = [];
      const seenTokens = new Set();

      for (const user of targetUsers) {
        if (user.push_token && Expo.isExpoPushToken(user.push_token)) {
          if (!seenTokens.has(user.push_token)) {
            seenTokens.add(user.push_token);
            messages.push({
              to: user.push_token,
              sound: 'default',
              title: title,
              body: body,
              data: data || {},
            });
            sentCount++;
          }
        }
      }

      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
          try {
            await expo.sendPushNotificationsAsync(chunk);
          } catch (error) {
            console.error('Error sending marketing push notification chunk:', error);
          }
        }
      }

      res.status(200).json({ message: `Marketing broadcast sent to ${sentCount} devices.` });
    } catch (error) {
      console.error('Marketing broadcast error:', error);
      res.status(500).json({ error: 'Failed to send marketing broadcast.' });
    }
  }
}

module.exports = new AdminController();
