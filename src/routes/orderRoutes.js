const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order placement, delivery slots, history and cancellation
 */

/**
 * @swagger
 * /api/orders/slots:
 *   get:
 *     summary: Get all active delivery slots
 *     description: Returns available scheduled delivery time windows (e.g., 07:00 AM - 09:00 AM).
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: List of active delivery slots
 */
router.get('/slots', orderController.getActiveDeliverySlots);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Place a new order
 *     description: Validates inventory, store opening hours, delivery radius/pincode, and applies coupons in a database transaction. Supports COD and Cashfree ONLINE payment methods.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - address
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     variantId:
 *                       type: integer
 *                     productName:
 *                       type: string
 *                     variantName:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   pincode:
 *                     type: string
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [COD, ONLINE]
 *               deliveryCharge:
 *                 type: number
 *               deliveryDate:
 *                 type: string
 *                 example: '2026-10-25'
 *               deliverySlotId:
 *                 type: integer
 *               deliverySlotLabel:
 *                 type: string
 *               couponCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error (Store closed, pincode unserviceable, out of stock)
 */
router.post('/', requireAuth, orderController.placeOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get order history for the logged-in customer
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user orders
 */
router.get('/', requireAuth, orderController.getUserOrders);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   put:
 *     summary: Cancel an order
 *     description: Cancels order if not yet picked or delivered. Automatically initiates Cashfree refund if prepaid online.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Order cannot be cancelled at this stage
 */
router.put('/:id/cancel', requireAuth, orderController.cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/draft:
 *   delete:
 *     summary: Delete an unpaid draft order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft order deleted
 */
router.delete('/:id/draft', requireAuth, orderController.deleteDraftOrder);

module.exports = router;
