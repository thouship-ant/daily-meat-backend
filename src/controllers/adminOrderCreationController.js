const { User, Order, OrderItem, sequelize } = require('../models');
const { geocodeAddress } = require('../services/geocodingService');

exports.createManualOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { 
      customerPhone, 
      customerName, 
      items, 
      address, 
      paymentMethod, 
      totalAmount, 
      deliveryDate, 
      deliverySlotId, 
      deliverySlotLabel 
    } = req.body;

    if (!customerPhone || !customerName) {
      return res.status(400).json({ error: 'Customer phone and name are required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Format phone to match DB
    const formattedPhone = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone}`;

    // 1. Find or Create User
    // If the phone number exists, use that user. Otherwise, create a new one.
    let user = await User.findOne({ where: { phone: formattedPhone } });
    
    if (!user) {
      // Create a dummy/shell user account so the order has a user_id
      user = await User.create({
        name: customerName,
        phone: formattedPhone,
        role: 'CUSTOMER',
        is_active: true
      }, { transaction });
    } else {
      // Optionally update the name if the admin enters a better one, 
      // but let's just stick to the existing user record to be safe.
    }

    // Prefer coordinates sent with the address (a pin set on the map); geocode the typed address
    // only when there are none.
    const hasPin = address.latitude && address.longitude;
    const geocoded = hasPin ? null : await geocodeAddress(address);
    const latitude = hasPin ? address.latitude : geocoded?.latitude ?? null;
    const longitude = hasPin ? address.longitude : geocoded?.longitude ?? null;

    // 2. Create the Order
    const order = await Order.create({
      user_id: user.id,
      subtotal_amount: totalAmount,
      total_amount: totalAmount,
      discount_amount: 0,
      delivery_date: deliveryDate || null,
      delivery_slot_id: deliverySlotId || null,
      delivery_slot_label: deliverySlotLabel || null,
      delivery_instruction: 'Manual Order by Admin',
      address_title: address.title || null,
      address_street: address.street,
      address_city: address.city,
      address_pincode: address.pincode || 'N/A',
      address_latitude: latitude,
      address_longitude: longitude,
      payment_method: paymentMethod || 'PREPAID',
      status: 'CONFIRMED' // Manual orders can go straight to CONFIRMED
    }, { transaction });

    // 2.5 Save Address if new
    const { Address } = require('../models');
    // Check if an identical address exists for this user
    const existingAddress = await Address.findOne({
      where: {
        user_id: user.id,
        street: address.street,
        city: address.city
      }
    });

    if (!existingAddress) {
      await Address.create({
        user_id: user.id,
        title: address.title || 'Other',
        street: address.street,
        city: address.city,
        pincode: address.pincode || '000000',
        latitude: latitude || 0,
        longitude: longitude || 0,
        is_deliverable: true
      }, { transaction });
    }

    // 3. Create Order Items
    let totalCost = 0;
    const { ProductVariant } = require('../models');

    for (const item of items) {
      const variant = await ProductVariant.findByPk(item.variantId);
      const costPriceSnapshot = variant && variant.cost_price ? parseFloat(variant.cost_price) : 0;
      totalCost += (costPriceSnapshot * item.quantity);

      await OrderItem.create({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name_snapshot: item.productName,
        variant_name_snapshot: item.variantName,
        cost_price_snapshot: costPriceSnapshot,
        quantity: item.quantity,
        price: item.price,
        instruction: item.instruction || null
      }, { transaction });
    }

    order.total_cost = totalCost;
    order.total_profit = parseFloat(order.total_amount) - parseFloat(order.delivery_charge || 0) - totalCost;
    await order.save({ transaction });

    await transaction.commit();
    res.status(201).json({ message: 'Manual Order placed successfully', orderId: order.id });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating manual order:', error);
    res.status(500).json({ error: 'Failed to create manual order' });
  }
};
