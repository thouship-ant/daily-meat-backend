const catalogService = require('../services/catalogService');

class CatalogController {
  
  // ===================== CATEGORIES =====================
  async createCategory(req, res) {
    try {
      const data = { ...req.body };
      // If a file was uploaded, multer attaches the URL to req.file.path (Cloudinary) or req.file.location (S3)
      if (req.file) {
        data.image_url = req.file.path || req.file.location;
      }
      
      const category = await catalogService.createCategory(data);
      res.status(201).json({ message: 'Category created successfully', data: category });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllCategories(req, res) {
    try {
      const categories = await catalogService.getAllCategories();
      res.status(200).json({ data: categories });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateCategory(req, res) {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.image_url = req.file.path || req.file.location;
      }
      const category = await catalogService.updateCategory(req.params.id, data);
      res.status(200).json({ message: 'Category updated', data: category });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCategory(req, res) {
    try {
      await catalogService.deleteCategory(req.params.id);
      res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }


  // ===================== PRODUCTS =====================
  async createProduct(req, res) {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.image_url = req.file.path || req.file.location;
      }
      if (data.is_popular !== undefined) {
        data.is_popular = data.is_popular === 'true' || data.is_popular === true;
      }
      
      const product = await catalogService.createProduct(data);
      res.status(201).json({ message: 'Product created successfully', data: product });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllProducts(req, res) {
    try {
      const { category_id, page, limit } = req.query;
      const result = await catalogService.getAllProducts(category_id, page, limit);
      res.status(200).json({ data: result.data, totalPages: result.totalPages || 1 });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getBestSellers(req, res) {
    try {
      const bestSellers = await catalogService.getBestSellers();
      res.status(200).json({ data: bestSellers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getProductById(req, res) {
    try {
      const product = await catalogService.getProductById(req.params.id);
      res.status(200).json({ data: product });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.image_url = req.file.path || req.file.location;
      }
      if (data.is_popular !== undefined) {
        data.is_popular = data.is_popular === 'true' || data.is_popular === true;
      }
      const product = await catalogService.updateProduct(req.params.id, data);
      res.status(200).json({ message: 'Product updated', data: product });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      await catalogService.deleteProduct(req.params.id);
      res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // ===================== VARIANTS =====================
  async getAllVariants(req, res) {
    try {
      const { category_id, page, limit } = req.query;
      const result = await catalogService.getAllVariants(category_id, page, limit);
      res.status(200).json({ data: result.data, totalPages: result.totalPages || 1 });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createVariant(req, res) {
    try {
      const variant = await catalogService.createVariant(req.body);
      res.status(201).json({ message: 'Variant created successfully', data: variant });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateVariant(req, res) {
    try {
      const variant = await catalogService.updateVariant(req.params.id, req.body);
      res.status(200).json({ message: 'Variant updated', data: variant });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteVariant(req, res) {
    try {
      await catalogService.deleteVariant(req.params.id);
      res.status(200).json({ message: 'Variant deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CatalogController();
