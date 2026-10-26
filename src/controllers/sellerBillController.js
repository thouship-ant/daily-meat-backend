const { SellerBill, SellerBillItem, Product } = require('../models');
const { v4: uuidv4 } = require('uuid');
  
const createSellerBill = async (req, res) => {
  try {
    const { items, notes, categoryName, supplierName } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required to create a bill' });
    }

    const bill = await SellerBill.create({
      notes,
      category_name: categoryName,
      supplier_name: supplierName
    });

    const billItems = items.map(item => ({
      id: uuidv4(),
      bill_id: bill.id,
      product_id: item.productId,
      product_name_snapshot: item.productName,
      variant_id: item.variantId || null,
      variant_name_snapshot: item.variantName || null,
      quantity: item.quantity
    }));

    await SellerBillItem.bulkCreate(billItems);

    const createdBill = await SellerBill.findByPk(bill.id, {
      include: [{ model: SellerBillItem, as: 'items' }]
    });

    res.status(201).json({ success: true, message: 'Seller bill generated successfully', data: createdBill });
  } catch (error) {
    console.error('Error creating seller bill:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getAllSellerBills = async (req, res) => {
  try {
    const bills = await SellerBill.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ success: true, data: bills });
  } catch (error) {
    console.error('Error fetching seller bills:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getSellerBillDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await SellerBill.findByPk(id, {
      include: [{ model: SellerBillItem, as: 'items' }]
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    res.status(200).json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching seller bill details:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getRequiredItems = async (req, res) => {
  try {
    const { Order, OrderItem, Product, ProductVariant, Category } = require('../models');
    const { Op } = require('sequelize');

    const { date } = req.query;
    
    const orderWhere = {
      status: {
        [Op.notIn]: ['DELIVERED', 'CANCELLED', 'FAILED']
      }
    };

    if (date) {
      orderWhere.delivery_date = date;
    }

    // 1. Fetch order items for active orders
    const orderItems = await OrderItem.findAll({
      include: [
        {
          model: Order,
          as: 'order',
          where: orderWhere,
          attributes: []
        }
      ]
    });

    // Calculate required quantities per product/variant from orders
    const requiredCounts = {};
    for (const item of orderItems) {
      const key = `${item.product_id}_${item.variant_id || 'null'}`;
      if (!requiredCounts[key]) {
        requiredCounts[key] = 0;
      }
      requiredCounts[key] += item.quantity;
    }

    // 2. Fetch all active products with variants and categories
    const allProducts = await Product.findAll({
      where: { is_active: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: ProductVariant,
          as: 'variants'
        }
      ]
    });

    const result = [];
    for (const product of allProducts) {
      const categoryId = product.category?.id || null;
      const categoryName = product.category?.name || 'Uncategorized';
      
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.is_active !== false) {
            const key = `${product.id}_${variant.id}`;
            result.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName: variant.weight,
              categoryId,
              categoryName,
              requiredQty: requiredCounts[key] || 0
            });
          }
        }
      } else {
        const key = `${product.id}_null`;
        result.push({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantName: null,
          categoryId,
          categoryName,
          requiredQty: requiredCounts[key] || 0
        });
      }
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching required items:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createSellerBill,
  getAllSellerBills,
  getSellerBillDetails,
  getRequiredItems
};
