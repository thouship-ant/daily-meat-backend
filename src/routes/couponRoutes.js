const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Customer coupon browsing and validation
 */

router.use(requireAuth);

/**
 * @swagger
 * /api/coupons/available:
 *   get:
 *     summary: Get all available coupons for the current user
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coupons eligible for the user
 */
router.get('/available', couponController.getAvailableCoupons);

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate a coupon against current cart total
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - couponCode
 *               - orderTotal
 *             properties:
 *               couponCode:
 *                 type: string
 *                 example: 'WELCOME50'
 *               orderTotal:
 *                 type: number
 *                 example: 499.00
 *     responses:
 *       200:
 *         description: Coupon is valid and returns calculated discount
 *       400:
 *         description: Coupon invalid, expired, or minimum cart threshold not met
 */
router.post('/validate', couponController.validateCoupon);

module.exports = router;
