const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminOrderCreationController = require('../controllers/adminOrderCreationController');
const sellerBillController = require('../controllers/sellerBillController');
const analysisController = require('../controllers/analysisController');
const adminCouponController = require('../controllers/adminCouponController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { USER_ROLES } = require('../constants/enum');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Store Administration, Metrics, Orders, Driver Assignments, and Billing
 */

// All routes require ADMIN role
router.use(requireAuth);
router.use(requireRole([USER_ROLES.ADMIN || 'ADMIN']));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics (Revenue, Orders, Deliveries)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, custom]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/logout-all-admins:
 *   post:
 *     summary: Log every admin out of all devices (including the caller)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All admin sessions ended
 */
router.post('/logout-all-admins', adminController.logoutAllAdmins);

/**
 * @swagger
 * /api/admin/analysis/category-wise:
 *   get:
 *     summary: Get sales revenue analysis grouped by category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category analytics
 */
router.get('/analysis/category-wise', analysisController.getCategoryAnalytics);

/**
 * @swagger
 * /api/admin/drivers:
 *   post:
 *     summary: Create a new delivery driver account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *               - name
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Driver account created
 */
router.post('/drivers', adminController.createDriver);

/**
 * @swagger
 * /api/admin/drivers:
 *   get:
 *     summary: Get all delivery drivers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of drivers
 */
router.get('/drivers', adminController.getAllDrivers);

/**
 * @swagger
 * /api/admin/drivers/{id}:
 *   get:
 *     summary: Get driver profile details and delivery history
 *     tags: [Admin]
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
 *         description: Driver details
 */
router.get('/drivers/:id', adminController.getDriverDetails);

/**
 * @swagger
 * /api/admin/drivers/{id}/status:
 *   put:
 *     summary: Toggle driver active status
 *     tags: [Admin]
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
 *         description: Driver status updated
 */
router.put('/drivers/:id/status', adminController.toggleDriverStatus);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Get all customer orders with filtering and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/orders', adminController.getAllOrders);

/**
 * @swagger
 * /api/admin/orders/manual:
 *   post:
 *     summary: Create a phone / manual order directly by admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerPhone
 *               - customerName
 *               - items
 *               - totalAmount
 *             properties:
 *               customerPhone:
 *                 type: string
 *               customerName:
 *                 type: string
 *               items:
 *                 type: array
 *               totalAmount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Manual order created
 */
router.post('/orders/manual', adminOrderCreationController.createManualOrder);

/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   put:
 *     summary: Update order status (CONFIRMED, PREPARING, CANCELLED)
 *     tags: [Admin]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated
 */
router.put('/orders/:id/status', adminController.updateOrderStatus);

/**
 * @swagger
 * /api/admin/orders/{id}/assignment-suggestions:
 *   get:
 *     summary: Suggest eligible delivery drivers sorted by proximity
 *     tags: [Admin]
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
 *         description: Suggested drivers list
 */
router.get('/orders/:id/assignment-suggestions', adminController.getAssignmentSuggestions);

/**
 * @swagger
 * /api/admin/orders/assign-driver:
 *   put:
 *     summary: Assign driver to an order
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_id
 *               - driver_id
 *             properties:
 *               order_id:
 *                 type: string
 *               driver_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Driver assigned and notified
 */
router.put('/orders/assign-driver', adminController.assignDriver);

/**
 * @swagger
 * /api/admin/customers:
 *   get:
 *     summary: List all registered customers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer list
 */
router.get('/customers', adminController.getAllCustomers);

/**
 * @swagger
 * /api/admin/customers/search:
 *   get:
 *     summary: Search customer by phone number
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer search result
 */
router.get('/customers/search', adminController.searchCustomerByPhone);

/**
 * @swagger
 * /api/admin/customers/export:
 *   get:
 *     summary: Export all customers as CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/customers/export', adminController.exportCustomers);

/**
 * @swagger
 * /api/admin/customers/{id}:
 *   get:
 *     summary: Get customer profile and order history
 *     tags: [Admin]
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
 *         description: Customer details
 */
router.get('/customers/:id', adminController.getCustomerDetails);

/**
 * @swagger
 * /api/admin/customers/{id}/status:
 *   put:
 *     summary: Toggle customer active status
 *     tags: [Admin]
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
 *         description: Customer status updated
 */
router.put('/customers/:id/status', adminController.toggleCustomerStatus);

/**
 * @swagger
 * /api/admin/slots:
 *   post:
 *     summary: Create delivery slot
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - start_time
 *               - end_time
 *             properties:
 *               label:
 *                 type: string
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               max_capacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Slot created
 */
router.post('/slots', adminController.createDeliverySlot);

/**
 * @swagger
 * /api/admin/slots:
 *   get:
 *     summary: Get all delivery slots
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Slots list
 */
router.get('/slots', adminController.getDeliverySlots);

/**
 * @swagger
 * /api/admin/slots/{id}:
 *   put:
 *     summary: Update delivery slot
 *     tags: [Admin]
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
 *         description: Slot updated
 */
router.put('/slots/:id', adminController.updateDeliverySlot);

/**
 * @swagger
 * /api/admin/slots/{id}:
 *   delete:
 *     summary: Delete delivery slot
 *     tags: [Admin]
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
 *         description: Slot deleted
 */
router.delete('/slots/:id', adminController.deleteDeliverySlot);

/**
 * @swagger
 * /api/admin/tickets:
 *   get:
 *     summary: Get all customer support tickets
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support tickets list
 */
router.get('/tickets', adminController.getAllTickets);

/**
 * @swagger
 * /api/admin/tickets/{id}/status:
 *   put:
 *     summary: Update support ticket status
 *     tags: [Admin]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket updated
 */
router.put('/tickets/:id/status', adminController.updateTicketStatus);

/**
 * @swagger
 * /api/admin/marketing/send:
 *   post:
 *     summary: Broadcast marketing push notifications to users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               route:
 *                 type: string
 *     responses:
 *       200:
 *         description: Push alerts sent
 */
router.post('/marketing/send', adminController.sendMarketingBroadcast);

/**
 * @swagger
 * /api/admin/coupons:
 *   post:
 *     summary: Create promotional coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - discount_type
 *               - discount_value
 *             properties:
 *               code:
 *                 type: string
 *               discount_type:
 *                 type: string
 *               discount_value:
 *                 type: number
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.post('/coupons', adminCouponController.create);

/**
 * @swagger
 * /api/admin/coupons:
 *   get:
 *     summary: List all coupons
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupons list
 */
router.get('/coupons', adminCouponController.list);

/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   get:
 *     summary: Get coupon details and redemption stats
 *     tags: [Admin]
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
 *         description: Coupon details
 */
router.get('/coupons/:id', adminCouponController.details);

/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   put:
 *     summary: Update coupon rules and limits
 *     tags: [Admin]
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
 *         description: Coupon updated
 */
router.put('/coupons/:id', adminCouponController.update);

/**
 * @swagger
 * /api/admin/coupons/{id}/status:
 *   put:
 *     summary: Toggle coupon active status
 *     tags: [Admin]
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
 *         description: Coupon status updated
 */
router.put('/coupons/:id/status', adminCouponController.updateStatus);

/**
 * @swagger
 * /api/admin/seller-bills:
 *   post:
 *     summary: Create vendor procurement bill
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seller_name
 *               - items
 *             properties:
 *               seller_name:
 *                 type: string
 *               items:
 *                 type: array
 *     responses:
 *       201:
 *         description: Seller bill created
 */
router.post('/seller-bills', sellerBillController.createSellerBill);

/**
 * @swagger
 * /api/admin/seller-bills:
 *   get:
 *     summary: List all seller procurement bills
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller bills list
 */
router.get('/seller-bills', sellerBillController.getAllSellerBills);

/**
 * @swagger
 * /api/admin/seller-bills/required-items:
 *   get:
 *     summary: Get required procurement items based on open customer orders
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Required items
 */
router.get('/seller-bills/required-items', sellerBillController.getRequiredItems);

/**
 * @swagger
 * /api/admin/seller-bills/{id}:
 *   get:
 *     summary: Get seller bill details and item breakdown
 *     tags: [Admin]
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
 *         description: Seller bill details
 */
router.get('/seller-bills/:id', sellerBillController.getSellerBillDetails);

module.exports = router;
