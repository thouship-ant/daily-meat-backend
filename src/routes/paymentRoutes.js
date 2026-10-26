const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Cashfree payment verification and webhook processing
 */

/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     summary: Verify payment status after Cashfree Drop-in UI completes
 *     description: App passes order_id and cf_order_id. Backend queries Cashfree server to verify payment signature, marks order PAID, and notifies store admins.
 *     tags: [Payments]
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
 *               - cf_order_id
 *             properties:
 *               order_id:
 *                 type: string
 *               cf_order_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment successfully verified and order marked PAID
 *       400:
 *         description: Payment verification failed or was cancelled
 */
router.post('/verify', requireAuth, paymentController.verifyPayment);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Asynchronous Cashfree Payment Webhook Receiver
 *     description: Public endpoint receiving server-to-server notifications from Cashfree when payments succeed, fail, or expire.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook', paymentController.paymentWebhook);

module.exports = router;
