const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Addresses
 *   description: User Address Management
 */

/**
 * @swagger
 * /api/addresses:
 *   post:
 *     summary: Add a new address for the logged-in user
 *     description: Saves the address and calculates if it falls within the shop's delivery radius.
 *     tags: [Addresses]
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
 *               - street
 *               - city
 *               - pincode
 *               - latitude
 *               - longitude
 *             properties:
 *               title:
 *                 type: string
 *                 example: 'Home'
 *               street:
 *                 type: string
 *                 example: '123 Main St'
 *               city:
 *                 type: string
 *                 example: 'Hyderabad'
 *               pincode:
 *                 type: string
 *                 example: '500001'
 *               latitude:
 *                 type: number
 *                 example: 17.385044
 *               longitude:
 *                 type: number
 *                 example: 78.486671
 *     responses:
 *       201:
 *         description: Address added successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', requireAuth, addressController.addAddress);

/**
 * @swagger
 * /api/addresses:
 *   get:
 *     summary: Get all addresses for the logged-in user
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, addressController.getUserAddresses);

/**
 * @swagger
 * /api/addresses/{id}:
 *   put:
 *     summary: Update an existing address
 *     tags: [Addresses]
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
 *               title:
 *                 type: string
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               pincode:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Address updated successfully
 */
router.put('/:id', requireAuth, addressController.updateAddress);

/**
 * @swagger
 * /api/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Addresses]
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
 *         description: Address deleted successfully
 */
router.delete('/:id', requireAuth, addressController.deleteAddress);

/**
 * @swagger
 * /api/addresses/{id}/default:
 *   put:
 *     summary: Set an address as default
 *     tags: [Addresses]
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
 *         description: Address set as default
 */
router.put('/:id/default', requireAuth, addressController.setDefaultAddress);

module.exports = router;
