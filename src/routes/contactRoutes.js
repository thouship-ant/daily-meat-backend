const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { USER_ROLES } = require('../constants/enum');

/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Public website contact inquiries and admin management
 */

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit contact inquiry form (Public)
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message submitted successfully
 */
router.post('/', contactController.submitContact);

// Admin-only routes
/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get all contact submissions (Admin)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contact messages
 */
router.get('/', requireAuth, requireRole([USER_ROLES.ADMIN || 'ADMIN']), contactController.getAllContacts);

/**
 * @swagger
 * /api/contact/{id}/status:
 *   put:
 *     summary: Update contact inquiry status (Admin)
 *     tags: [Contact]
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
 *             properties:
 *               status:
 *                 type: string
 *                 example: 'CONTACTED'
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put('/:id/status', requireAuth, requireRole([USER_ROLES.ADMIN || 'ADMIN']), contactController.updateContactStatus);

/**
 * @swagger
 * /api/contact/{id}:
 *   delete:
 *     summary: Delete contact message (Admin)
 *     tags: [Contact]
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
 *         description: Message deleted
 */
router.delete('/:id', requireAuth, requireRole([USER_ROLES.ADMIN || 'ADMIN']), contactController.deleteContact);

module.exports = router;
