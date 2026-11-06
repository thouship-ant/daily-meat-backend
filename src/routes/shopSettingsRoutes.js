const express = require('express');
const router = express.Router();
const shopSettingsController = require('../controllers/shopSettingsController');
const { requireAuth } = require('../middleware/authMiddleware');
const { cacheResponse, invalidateOnWrite } = require('../middleware/cache');

// Shop settings change rarely; the PUT clears the cache so changes (e.g. pausing orders) show up immediately
router.use(invalidateOnWrite('settings'));

/**
 * @swagger
 * tags:
 *   name: ShopSettings
 *   description: Shop Configuration Management
 */

/**
 * @swagger
 * /api/shop-settings:
 *   get:
 *     summary: Get the current shop location and delivery radius
 *     tags: [ShopSettings]
 *     responses:
 *       200:
 *         description: Shop settings retrieved successfully
 *       404:
 *         description: Settings not found
 */
router.get('/', cacheResponse({ ns: 'settings', ttl: 120 }), shopSettingsController.getSettings);

/**
 * @swagger
 * /api/shop-settings:
 *   put:
 *     summary: Update shop location and delivery radius (Admin Only recommended)
 *     tags: [ShopSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shop_latitude:
 *                 type: number
 *                 example: 17.385044
 *               shop_longitude:
 *                 type: number
 *                 example: 78.486671
 *               delivery_radius_km:
 *                 type: number
 *                 example: 15.0
 *     responses:
 *       200:
 *         description: Shop settings updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/', requireAuth, shopSettingsController.updateSettings);

module.exports = router;
