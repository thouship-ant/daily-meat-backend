const paymentService = require('../services/paymentService');
const { Order } = require('../models');
const notificationService = require('../services/notificationService');

/**
 * Endpoint for app to call after Cashfree Drop-in UI completes successfully.
 * POST /api/payments/verify
 * Body: { cf_order_id, order_id }
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { cf_order_id, order_id } = req.body;
    
    if (!cf_order_id || !order_id) {
      return res.status(400).json({ error: 'Missing cf_order_id or order_id' });
    }

    const order = await Order.findOne({ where: { id: order_id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_status === 'PAID') {
      return res.status(200).json({ message: 'Order is already marked as PAID', order });
    }

    // Call Cashfree API to verify
    const cfOrder = await paymentService.verifyPayment(order_id);

    if (cfOrder.order_status === 'PAID') {
      order.payment_status = 'PAID';
      
      // Update order state if needed (optional)
      // order.status = 'CONFIRMED'; 

      await order.save();

      // Notify Admins now that payment is confirmed
      let notificationBody = `A new ONLINE order has been placed and paid successfully.`;
      if (order.delivery_date && order.delivery_slot_label) {
        notificationBody += ` Scheduled for: ${order.delivery_date} (${order.delivery_slot_label}).`;
      } else if (order.delivery_slot_label) {
        notificationBody += ` Deliver Today (${order.delivery_slot_label}).`;
      }
  
      const { User } = require('../models');
      const user = await User.findByPk(order.user_id);
  
      await notificationService.notifyAdmins({
        title: `New Paid Order #${order.id}`,
        body: notificationBody,
        data: { 
          route: 'admin_order', 
          orderId: order.id,
          customerName: user ? user.name : 'Customer',
          address: `${order.address_street}, ${order.address_city}`,
          schedule: (order.delivery_date && order.delivery_slot_label) ? `${order.delivery_date} (${order.delivery_slot_label})` : order.delivery_slot_label || 'ASAP',
        },
        socketEvent: 'adminNewOrder'
      });

      return res.status(200).json({ message: 'Payment verified successfully', order });
    } else {
      // A payment order is only a draft until Cashfree confirms it as PAID.
      // Remove failed/expired drafts so they cannot appear as customer orders.
      await order.destroy();
      return res.status(400).json({ error: 'Payment not successful', status: cfOrder.order_status });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Webhook endpoint for Cashfree.
 * POST /api/payments/webhook
 */
exports.paymentWebhook = async (req, res) => {
  try {
    // Note: In production, verify the webhook signature here using x-webhook-signature
    
    const payload = req.body;
    console.log('Cashfree Webhook received:', payload);

    if (payload && payload.data && payload.data.order) {
      const { order_id, order_status } = payload.data.order;
      
      if (order_status === 'PAID') {
        const order = await Order.findOne({ where: { id: order_id } });
        if (order && order.payment_status !== 'PAID') {
          order.payment_status = 'PAID';
          await order.save();

          const { User } = require('../models');
          const user = await User.findByPk(order.user_id);

          // Notify Admins
          await notificationService.notifyAdmins({
            title: `New Paid Order #${order.id}`,
            body: `Webhook verified payment for order.`,
            data: { 
              route: 'admin_order', 
              orderId: order.id,
              customerName: user ? user.name : 'Customer',
              address: `${order.address_street}, ${order.address_city}`,
              schedule: (order.delivery_date && order.delivery_slot_label) ? `${order.delivery_date} (${order.delivery_slot_label})` : order.delivery_slot_label || 'ASAP',
            },
            socketEvent: 'adminNewOrder'
          });
        }
      } else if (['FAILED', 'EXPIRED', 'TERMINATED', 'CANCELLED'].includes(order_status)) {
        const order = await Order.findOne({ where: { id: order_id } });
        if (order && order.payment_method === 'ONLINE' && order.payment_status !== 'PAID') {
          await order.destroy();
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error');
  }
};
