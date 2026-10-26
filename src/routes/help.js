const express = require('express');
const router = express.Router();
const { SupportTicket, Order } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Customer support ticket creation and inquiry tracking
 */

/**
 * @swagger
 * /api/help:
 *   post:
 *     summary: Create a customer support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               order_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket created successfully and admins notified
 *       400:
 *         description: Subject and message required
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { subject, message, order_id } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const ticket = await SupportTicket.create({
      user_id: req.user.id,
      subject,
      message,
      order_id: order_id || null
    });

    const notificationService = require('../services/notificationService');
    await notificationService.notifyAdmins({
      title: 'New Support Ticket',
      body: `A new support ticket has been created: "${subject}"`,
      data: { route: 'admin_support', ticketId: ticket.id },
      socketEvent: 'adminNewTicket'
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/help:
 *   get:
 *     summary: Get all support tickets for the logged-in customer
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customer support tickets
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const tickets = await SupportTicket.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'status', 'total_amount', 'createdAt']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
