const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { USER_ROLES } = require('../constants/enum');

/**
 * @swagger
 * tags:
 *   name: Driver
 *   description: Delivery Driver operations, order assignments, status progression, and live GPS updates
 */

// All routes require DRIVER role
router.use(requireAuth);
router.use(requireRole([USER_ROLES.DRIVER || 'DRIVER']));

/**
 * @swagger
 * /api/driver/orders/active:
 *   get:
 *     summary: Get active delivery orders assigned to logged-in driver
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ASSIGNED, PICKED, and OUT_FOR_DELIVERY orders
 */
router.get('/orders/active', driverController.getActiveOrders);

/**
 * @swagger
 * /api/driver/orders/completed:
 *   get:
 *     summary: Get completed / delivered orders for the logged-in driver
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of delivered orders
 */
router.get('/orders/completed', driverController.getCompletedOrders);

/**
 * @swagger
 * /api/driver/dashboard/stats:
 *   get:
 *     summary: Get driver dashboard metrics and 7-day delivery counts
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver delivery stats and weekly graph
 */
router.get('/dashboard/stats', driverController.getDashboardStats);

/**
 * @swagger
 * /api/driver/orders/{id}:
 *   get:
 *     summary: Get detailed view of an order assigned to driver
 *     tags: [Driver]
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
 *         description: Order details
 */
router.get('/orders/:id', driverController.getOrderById);

/**
 * @swagger
 * /api/driver/orders/bulk/pick:
 *   put:
 *     summary: Bulk mark multiple orders as PICKED
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_ids
 *             properties:
 *               order_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Orders marked as picked
 */
router.put('/orders/bulk/pick', driverController.markBulkPicked);

/**
 * @swagger
 * /api/driver/orders/bulk/out-for-delivery:
 *   put:
 *     summary: Bulk mark multiple orders as OUT_FOR_DELIVERY
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_ids
 *             properties:
 *               order_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Orders marked as out for delivery and customers notified
 */
router.put('/orders/bulk/out-for-delivery', driverController.markBulkOutForDelivery);

/**
 * @swagger
 * /api/driver/orders/{id}/pick:
 *   put:
 *     summary: Mark single order as PICKED from shop
 *     tags: [Driver]
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
 *         description: Order marked picked
 */
router.put('/orders/:id/pick', driverController.markPicked);

/**
 * @swagger
 * /api/driver/orders/{id}/out-for-delivery:
 *   put:
 *     summary: Mark single order OUT_FOR_DELIVERY
 *     description: Notifies customer via push alert and updates admin real-time map.
 *     tags: [Driver]
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
 *         description: Order marked out for delivery
 */
router.put('/orders/:id/out-for-delivery', driverController.markOutForDelivery);

/**
 * @swagger
 * /api/driver/orders/{id}/deliver:
 *   put:
 *     summary: Mark order DELIVERED
 *     description: Marks order complete. If order was COD, automatically transitions payment_status to PAID.
 *     tags: [Driver]
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
 *         description: Order successfully marked delivered
 */
router.put('/orders/:id/deliver', driverController.markDelivered);

/**
 * @swagger
 * /api/driver/orders/{id}/fail:
 *   put:
 *     summary: Mark delivery as FAILED
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order marked failed
 */
router.put('/orders/:id/fail', driverController.markFailed);

/**
 * @swagger
 * /api/driver/location:
 *   post:
 *     summary: Broadcast driver GPS coordinates (HTTP fallback)
 *     description: Emits live GPS coordinates to Socket.IO room order_{id} for customer tracking.
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderIds
 *               - latitude
 *               - longitude
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               speed:
 *                 type: number
 *               heading:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location broadcasted to Socket.IO clients
 */
router.post('/location', driverController.updateLocation);

module.exports = router;
