const { Category, Product, ProductVariant, OrderItem, sequelize } = require('../models');

class CatalogService {
  // ===================== CATEGORIES =====================
  // Create a new product category (Chicken, Mutton, etc.)
  async createCategory(data) {
    return await Category.create(data);
  }

  // Fetch all categories sorted by display order
  async getAllCategories() {
    return await Category.findAll({
      order: [['sort_order', 'ASC'], ['createdAt', 'DESC']]
    });
  }

  // Update category and swap sort_order if duplicate
  async updateCategory(id, data) {
    const category = await Category.findByPk(id);
    if (!category) throw new Error('Category not found');

    if (data.sort_order !== undefined) {
      const newSortOrder = parseInt(data.sort_order, 10);
      if (!isNaN(newSortOrder) && newSortOrder !== category.sort_order) {
        const existingCategory = await Category.findOne({ where: { sort_order: newSortOrder } });
        if (existingCategory) {
          // Swap positions to maintain continuous order
          await existingCategory.update({ sort_order: category.sort_order });
        }
      }
      data.sort_order = newSortOrder;
    }

    return await category.update(data);
  }

  async deleteCategory(id) {
    const category = await Category.findByPk(id);
    if (!category) throw new Error('Category not found');
    await category.destroy();
    return true;
  }

  // ===================== PRODUCTS =====================
  async createProduct(data) {
    if (data.sort_order !== undefined) {
      const newSortOrder = parseInt(data.sort_order, 10);
      if (!isNaN(newSortOrder)) {
        const existingProduct = await Product.findOne({ 
          where: { 
            sort_order: newSortOrder,
            category_id: data.category_id 
          } 
        });
        if (existingProduct) {
          // If a product already has this sort_order, push it to 0 (or we could swap, but create doesn't have an old order to swap with, so just reset the existing one or shift. Setting to 0 is safest for create).
          await existingProduct.update({ sort_order: 0 });
        }
        data.sort_order = newSortOrder;
      }
    }
    return await Product.create(data);
  }

  async getAllProducts(categoryId = null, page = null, limit = null) {
    const whereClause = categoryId ? { category_id: categoryId } : {};
    
    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await Product.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: ProductVariant,
            as: 'variants',
            required: false
          }
        ],
        order: [['sort_order', 'ASC'], ['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        distinct: true
      });
      return { data: rows, totalPages: Math.ceil(count / limit) };
    }

    const rows = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: ProductVariant,
          as: 'variants',
          required: false // LEFT JOIN so we get products even if they have no variants yet
        }
      ],
      order: [['sort_order', 'ASC'], ['createdAt', 'DESC']]
    });
    return { data: rows };
  }

  // Aggregate top 10 most ordered products by quantity
  async getBestSellers() {
    const bestSellersData = await OrderItem.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_sold']
      ],
      group: ['product_id'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      limit: 10
    });

    const productIds = bestSellersData.map(item => item.product_id);
    if (productIds.length === 0) return [];

    // Load full product details with variant cuts
    const products = await Product.findAll({
      where: { id: productIds },
      include: [{ model: ProductVariant, as: 'variants' }]
    });

    // Filter to only items that currently have available stock
    const availableProducts = products.filter(p => 
      p.variants && p.variants.some(v => v.in_stock && v.is_active)
    );

    const orderedProducts = [];
    for (const id of productIds) {
      const prod = availableProducts.find(p => p.id === id);
      if (prod) orderedProducts.push(prod);
    }

    return orderedProducts;
  }

  // Fetch product by ID with all active cuts/variants
  async getProductById(id) {
    const product = await Product.findByPk(id, {
      include: [{ model: ProductVariant, as: 'variants' }]
    });
    if (!product) throw new Error('Product not found');
    return product;
  }

  async updateProduct(id, data) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');

    const targetCategoryId = data.category_id || product.category_id;

    if (data.sort_order !== undefined) {
      const newSortOrder = parseInt(data.sort_order, 10);
      
      const sortOrderChanged = newSortOrder !== product.sort_order;
      const categoryChanged = data.category_id !== undefined && data.category_id !== product.category_id;

      if (!isNaN(newSortOrder) && (sortOrderChanged || categoryChanged)) {
        const existingProduct = await Product.findOne({ 
          where: { 
            sort_order: newSortOrder,
            category_id: targetCategoryId
          } 
        });
        if (existingProduct) {
          if (!categoryChanged) {
            await existingProduct.update({ sort_order: product.sort_order });
          } else {
            await existingProduct.update({ sort_order: 0 });
          }
        }
      }
      data.sort_order = newSortOrder;
    }

    return await product.update(data);
  }

  async deleteProduct(id) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    await product.destroy();
    return true;
  }

  // ===================== VARIANTS =====================
  async getAllVariants(categoryId = null, page = null, limit = null) {
    const productWhere = categoryId ? { category_id: categoryId } : {};
    
    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await ProductVariant.findAndCountAll({
        include: [{ model: Product, as: 'product', where: productWhere }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        distinct: true
      });
      return { data: rows, totalPages: Math.ceil(count / limit) };
    }

    const rows = await ProductVariant.findAll({
      include: [{ model: Product, as: 'product', where: productWhere }],
      order: [['createdAt', 'DESC']]
    });
    return { data: rows };
  }

  async createVariant(data) {
    return await ProductVariant.create(data);
  }

  async updateVariant(id, data) {
    const variant = await ProductVariant.findByPk(id);
    if (!variant) throw new Error('Variant not found');
    return await variant.update(data);
  }

  async deleteVariant(id) {
    const variant = await ProductVariant.findByPk(id);
    if (!variant) throw new Error('Variant not found');
    await variant.destroy();
    return true;
  }
}

module.exports = new CatalogService();
