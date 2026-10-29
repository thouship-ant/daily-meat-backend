const { Order, OrderItem, ProductVariant, sequelize } = require('../models');
const paymentService = require('../services/paymentService');
const { calculateDistance } = require('../utils/distanceCalc');
const { geocodeAddress } = require('../services/geocodingService');
const {
  createCouponRedemption,
  toMoney,
  validateCouponForUser,
} = require('../services/couponService');

exports.placeOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, address, deliveryInstruction, deliveryCharge, deliveryDate, deliverySlotId, deliverySlotLabel, couponCode, couponId, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    const customerLatitude = Number(address?.latitude);
    const customerLongitude = Number(address?.longitude);
    const { ShopSettings } = require('../models');
    const shopSettings = await ShopSettings.findByPk(1, { transaction });

    if (
      !shopSettings ||
      !address?.pincode
    ) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Delivery location could not be verified.' });
    }

    const isDeliverable = 
      !Array.isArray(shopSettings.deliverable_pincodes) || 
      shopSettings.deliverable_pincodes.length === 0 || 
      shopSettings.deliverable_pincodes.includes(address.pincode?.toString());

    if (!isDeliverable) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Sorry, we do not deliver to pincode ${address.pincode} yet.`
      });
    }
    
    // Store Timing Validation for ASAP orders
    if (!deliveryDate && !deliverySlotId) {
      const { ShopSettings } = require('../models');
      const settings = await ShopSettings.findByPk(1);
      
      if (settings && settings.store_start_time && settings.store_close_time) {
        // Use IST (UTC+5:30) — store times are configured in Indian Standard Time
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentHours = nowIST.getHours();
        const currentMinutes = nowIST.getMinutes();
        
        // Parse "HH:mm"
        const [startH, startM] = settings.store_start_time.split(':').map(Number);
        const [closeH, closeM] = settings.store_close_time.split(':').map(Number);
        
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const startTimeInMinutes = startH * 60 + startM;
        // Adding 10 mins grace period to closing time
        const closeTimeInMinutes = closeH * 60 + closeM + 10; 
        
        if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes > closeTimeInMinutes) {
          return res.status(400).json({ error: 'Store is currently closed. Please select a delivery slot for tomorrow.' });
        }
      }
    }

    let subtotalAmount = 0;
    let totalCost = 0;
    const normalizedItems = [];

    for (const item of items) {
      const variant = await ProductVariant.findByPk(item.variantId, { transaction });
      if (!variant || !variant.is_active || !variant.in_stock) {
        await transaction.rollback();
        return res.status(400).json({ error: `Variant ${item.variantId} is unavailable.` });
      }

      const unitPrice = toMoney(variant.discounted_price || variant.price);
      const costPriceSnapshot = variant && variant.cost_price ? parseFloat(variant.cost_price) : 0;
      subtotalAmount += unitPrice * item.quantity;
      totalCost += costPriceSnapshot * item.quantity;

      normalizedItems.push({
        ...item,
        unitPrice,
        costPriceSnapshot,
        variantName: item.variantName || variant.weight,
      });
    }

    subtotalAmount = toMoney(subtotalAmount);
    totalCost = toMoney(totalCost);
    const normalizedDeliveryCharge = toMoney(deliveryCharge || 0);
    const orderTotalBeforeDiscount = toMoney(subtotalAmount + normalizedDeliveryCharge);

    let appliedCoupon = null;
    let discountAmount = 0;
    if (couponCode || couponId) {
      const validation = await validateCouponForUser({
        couponCode,
        couponId,
        userId: req.user.id,
        orderTotal: orderTotalBeforeDiscount,
        transaction,
        includeHidden: true,
      });

      if (!validation.valid) {
        await transaction.rollback();
        return res.status(400).json({
          error: validation.message,
          reason_code: validation.reason_code,
        });
      }

      appliedCoupon = validation.coupon;
      discountAmount = toMoney(validation.discount_amount);
    }

    const finalTotalAmount = toMoney(orderTotalBeforeDiscount - discountAmount);

    // Large orders must be paid online (Cash on Delivery is capped)
    const COD_MAX_AMOUNT = 2000;
    if ((paymentMethod || 'COD') === 'COD' && finalTotalAmount > COD_MAX_AMOUNT) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cash on Delivery is not available for orders above Rs. ${COD_MAX_AMOUNT}. Please pay online.`,
      });
    }

    // The pin the customer set on the Add/Update Address screen is the source of truth for the
    // delivery location. Use it over whatever coordinates arrive with the order, and only
    // geocode the typed address when no coordinates exist at all.
    const { Address } = require('../models');
    const savedAddress = await Address.findOne({
      where: {
        user_id: req.user.id,
        street: address.street,
        city: address.city,
        pincode: address.pincode
      },
      transaction
    });
    const hasSavedPin = savedAddress && savedAddress.latitude && savedAddress.longitude;
    const hasClientPin = address.latitude && address.longitude;
    const pin = hasSavedPin
      ? { latitude: savedAddress.latitude, longitude: savedAddress.longitude }
      : hasClientPin
        ? { latitude: address.latitude, longitude: address.longitude }
        : await geocodeAddress(address);

    // Address snapshot
    const order = await Order.create({
      user_id: req.user.id,
      subtotal_amount: subtotalAmount,
      total_amount: finalTotalAmount,
      discount_amount: discountAmount,
      delivery_charge: normalizedDeliveryCharge,
      delivery_date: deliveryDate || null,
      delivery_slot_id: deliverySlotId || null,
      delivery_slot_label: deliverySlotLabel || null,
      delivery_instruction: deliveryInstruction || null,
      coupon_id: appliedCoupon ? appliedCoupon.id : null,
      coupon_code_snapshot: appliedCoupon ? appliedCoupon.code : null,
      address_title: address.title || null,
      address_street: address.street,
      address_city: address.city,
      address_pincode: address.pincode,
      address_latitude: pin?.latitude ?? null,
      address_longitude: pin?.longitude ?? null,
      payment_method: paymentMethod || 'COD'
    }, { transaction });

    // Items
    for (const item of normalizedItems) {
      await OrderItem.create({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name_snapshot: item.productName,
        variant_name_snapshot: item.variantName,
        cost_price_snapshot: item.costPriceSnapshot,
        quantity: item.quantity,
        price: item.unitPrice,
        instruction: item.instruction || null
      }, { transaction });
    }

    order.total_cost = totalCost;
    order.total_profit = toMoney(finalTotalAmount - normalizedDeliveryCharge - totalCost);
    await order.save({ transaction });

    let payment_session_id = null;
    let cf_order_id = null;

    // For ONLINE payments, generate Cashfree session before transaction commit
    if (order.payment_method === 'ONLINE') {
      const cfResponse = await paymentService.createCashfreeOrder(order, req.user);
      cf_order_id = cfResponse.cf_order_id;
      payment_session_id = cfResponse.payment_session_id;
      
      order.cf_order_id = cf_order_id;
      order.payment_session_id = payment_session_id;
      await order.save({ transaction });
    }

    // Record coupon redemption history inside transaction
    if (appliedCoupon) {
      await createCouponRedemption({
        couponId: appliedCoupon.id,
        userId: req.user.id,
        orderId: order.id,
        discountAmount,
        transaction,
      });
    }

    await transaction.commit();

    // Notify admins immediately for COD orders (ONLINE orders notified upon payment verification)
    if (order.payment_method === 'COD') {
      const notificationService = require('../services/notificationService');
      
      let notificationBody = `A new order has been placed and is awaiting assignment.`;
      if (deliveryDate && deliverySlotLabel) {
        notificationBody += ` Scheduled for: ${deliveryDate} (${deliverySlotLabel}).`;
      } else if (deliverySlotLabel) {
        notificationBody += ` Deliver Today (${deliverySlotLabel}).`;
      }

      await notificationService.notifyAdmins({
        title: `New Order #${order.id}`,
        body: notificationBody,
        data: { 
          route: 'admin_order', 
          orderId: order.id,
          customerName: req.user.name || 'Customer',
          address: `${address.street}, ${address.city}`,
          schedule: (deliveryDate && deliverySlotLabel) ? `${deliveryDate} (${deliverySlotLabel})` : deliverySlotLabel || 'ASAP',
        },
        socketEvent: 'adminNewOrder'
      });
    }

    res.status(201).json({
      message: 'Order placed successfully',
      orderId: order.id,
      discount_amount: order.discount_amount,
      coupon_code_snapshot: order.coupon_code_snapshot,
      coupon_id: order.coupon_id,
      payment_session_id,
      cf_order_id,
      cf_environment: process.env.CASHFREE_ENV === 'PROD' ? 'PRODUCTION' : 'SANDBOX'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const { User } = require('../models');
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [
        { 
          model: OrderItem, 
          as: 'items',
          include: [{
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['image_url']
          }]
        },
        { model: User, as: 'driver', attributes: ['id', 'name', 'phone'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

exports.getActiveDeliverySlots = async (req, res) => {
  try {
    const { DeliverySlot } = require('../models');
    const slots = await DeliverySlot.findAll({
      where: { is_active: true }
    });

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
    console.error('Error fetching delivery slots:', error);
    res.status(500).json({ error: 'Failed to fetch delivery slots.' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED'].includes(order.status)) {
      return res.status(400).json({ 
        error: `Order cannot be cancelled because it is currently ${order.status}.` 
      });
    }

    order.status = 'CANCELLED';
    
    // Automatic Refund for ONLINE PAID orders
    if (order.payment_method === 'ONLINE' && order.payment_status === 'PAID') {
      try {
        const refundId = `REFUND_${order.id}_${Date.now()}`;
        await paymentService.initiateRefund(order.id, order.total_amount, refundId);
        order.payment_status = 'REFUNDED';
      } catch (err) {
        console.error('Refund failed:', err);
      }
    }
    
    await order.save();

    const notificationService = require('../services/notificationService');

    // Notify Admins
    await notificationService.notifyAdmins({
      title: `Order Cancelled`,
      body: `Order #${order.id} was cancelled by the customer.`,
      data: { route: 'admin_order', orderId: order.id },
      socketEvent: 'adminOrderStatusChanged'
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

    res.status(200).json({ message: 'Order cancelled successfully.', order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
};

exports.deleteDraftOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.payment_method !== 'ONLINE' || order.payment_status === 'PAID') {
      return res.status(400).json({ error: 'Only unpaid online orders can be deleted.' });
    }

    await order.destroy();

    res.status(200).json({ message: 'Order deleted successfully.' });
  } catch (error) {
    console.error('Error deleting draft order:', error);
    res.status(500).json({ error: 'Failed to delete order.' });
  }
};
