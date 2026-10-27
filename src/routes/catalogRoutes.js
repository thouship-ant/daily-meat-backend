const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const bannerController = require('../controllers/bannerController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { upload } = require('../config/upload');
const { getIo } = require('../config/socket');

/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: Product Catalog Management
 */

// Catalog reads must always revalidate, and any successful catalog write (price, stock, product,
// category, banner) tells connected apps to refetch, so customers see changes without placing an order.
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'no-cache');
  } else {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      try {
        const io = getIo();
        io.emit('catalogChanged', { path: req.originalUrl, method: req.method });
        console.log(`[Socket.io] catalogChanged (${req.method} ${req.originalUrl}) sent to ${io.engine.clientsCount} connected client(s)`);
      } catch (error) {
        console.error('catalogChanged emit error:', error.message);
      }
    });
  }
  next();
});

// ===================== PUBLIC ROUTES =====================
/**
 * @swagger
 * /api/catalog/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Catalog]
 */
router.get('/categories', catalogController.getAllCategories);

/**
 * @swagger
 * /api/catalog/products:
 *   get:
 *     summary: Get all products (with their variants)
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filter by category UUID
 */
router.get('/products', catalogController.getAllProducts);

/**
 * @swagger
 * /api/catalog/products/best-sellers:
 *   get:
 *     summary: Get best selling products
 *     tags: [Catalog]
 */
router.get('/products/best-sellers', catalogController.getBestSellers);

/**
 * @swagger
 * /api/catalog/products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/products/:id', catalogController.getProductById);

/**
 * @swagger
 * /api/catalog/variants:
 *   get:
 *     summary: Get all variants (with their products)
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 */
router.get('/variants', catalogController.getAllVariants);

/**
 * @swagger
 * /api/catalog/banners:
 *   get:
 *     summary: Get all active banners
 *     tags: [Catalog]
 */
router.get('/banners', bannerController.getAllBanners);

// ===================== ADMIN ROUTES =====================
// Apply auth and admin role to all routes below this line
router.use(requireAuth);
// Assuming requireRole is a middleware we will create if not already there, 
// wait, we don't have requireRole yet. I will update authMiddleware next to include requireRole.
// For now, I'll just use requireAuth and add a custom inline check for ADMIN
const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(checkAdmin);

/**
 * @swagger
 * /api/catalog/categories:
 *   post:
 *     summary: Create a category (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 */
router.post('/categories', upload.single('image'), catalogController.createCategory);

/**
 * @swagger
 * /api/catalog/categories/{id}:
 *   put:
 *     summary: Update a category (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.put('/categories/:id', upload.single('image'), catalogController.updateCategory);

/**
 * @swagger
 * /api/catalog/categories/{id}:
 *   delete:
 *     summary: Delete a category (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/categories/:id', catalogController.deleteCategory);

/**
 * @swagger
 * /api/catalog/products:
 *   post:
 *     summary: Create a product (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.post('/products', upload.single('image'), catalogController.createProduct);

/**
 * @swagger
 * /api/catalog/products/{id}:
 *   put:
 *     summary: Update a product (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.put('/products/:id', upload.single('image'), catalogController.updateProduct);

/**
 * @swagger
 * /api/catalog/products/{id}:
 *   delete:
 *     summary: Delete a product (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/products/:id', catalogController.deleteProduct);

/**
 * @swagger
 * /api/catalog/variants:
 *   post:
 *     summary: Create a variant for a product (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.post('/variants', catalogController.createVariant);

/**
 * @swagger
 * /api/catalog/variants/{id}:
 *   put:
 *     summary: Update a variant (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.put('/variants/:id', catalogController.updateVariant);

/**
 * @swagger
 * /api/catalog/variants/{id}:
 *   delete:
 *     summary: Delete a variant (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/variants/:id', catalogController.deleteVariant);

/**
 * @swagger
 * /api/catalog/banners:
 *   get:
 *     summary: Get all banners (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.get('/banners/admin', bannerController.getAdminBanners);

/**
 * @swagger
 * /api/catalog/banners:
 *   post:
 *     summary: Create a banner (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.post('/banners', upload.single('image'), bannerController.createBanner);

/**
 * @swagger
 * /api/catalog/banners/{id}:
 *   put:
 *     summary: Update a banner (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.put('/banners/:id', upload.single('image'), bannerController.updateBanner);

/**
 * @swagger
 * /api/catalog/banners/{id}:
 *   delete:
 *     summary: Delete a banner (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/banners/:id', bannerController.deleteBanner);

/**
 * @swagger
 * /api/catalog/banners/{id}/status:
 *   put:
 *     summary: Toggle banner active status (Admin)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 */
router.put('/banners/:id/status', bannerController.toggleBannerStatus);

module.exports = router;
