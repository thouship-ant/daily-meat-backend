const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication Endpoints
 */



/**
 * @swagger
 * /api/auth/check-phone:
 *   post:
 *     summary: Check if a phone number exists and get its role
 *     description: Used to determine whether to show the OTP screen or the Password screen on the frontend.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             # either phone or email is required
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919999999999'
 *               email:
 *                 type: string
 *                 example: 'user@example.com'
 *     responses:
 *       200:
 *         description: Successfully checked phone.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                   example: 'CUSTOMER'
 *       400:
 *         description: Bad request.
 */
router.post('/check-phone', authController.checkPhone);

/**
 * @swagger
 * /api/auth/login-with-password:
 *   post:
 *     summary: Login for ADMIN or DRIVER using phone and password
 *     description: Authenticates a staff member using their phone number and password. Returns a JWT token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919999999999'
 *               password:
 *                 type: string
 *                 example: 'Admin@123'
 *     responses:
 *       200:
 *         description: Successfully authenticated.
 *       401:
 *         description: Unauthorized, invalid credentials.
 *       500:
 *         description: Internal server error.
 */
router.post('/login-with-password', authController.loginWithPassword);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh Access Token
 *     description: Uses a valid refresh token to issue a new set of tokens.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully refreshed tokens.
 *       401:
 *         description: Unauthorized, invalid refresh token.
 */
router.post('/refresh-token', authController.refreshToken);

const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidates the user's refresh token. Requires Bearer Token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out.
 *       401:
 *         description: Unauthorized.
 */
router.post('/logout', requireAuth, authController.logout);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the logged-in user's name and email, and marks the profile as completed. Requires Bearer Token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'John Doe'
 *               email:
 *                 type: string
 *                 example: 'john@example.com'
 *     responses:
 *       200:
 *         description: Successfully updated profile.
 *       400:
 *         description: Bad request.
 *       401:
 *         description: Unauthorized.
 */
router.put('/profile', requireAuth, authController.updateProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   delete:
 *     summary: Delete / Anonymize user account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account anonymized and personal addresses deleted
 */
router.delete('/profile', requireAuth, authController.deleteAccount);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change password for staff account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 */
router.put('/change-password', requireAuth, authController.changePassword);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 */
router.get('/me', requireAuth, authController.getMe);

/**
 * @swagger
 * /api/auth/push-token:
 *   put:
 *     summary: Register or update device push notification token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pushToken
 *             properties:
 *               pushToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Push token registered
 */
router.put('/push-token', requireAuth, authController.updatePushToken);

/**
 * @swagger
 * /api/auth/test-notification:
 *   post:
 *     summary: Send a test push notification to user device
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification dispatched
 */
router.post('/test-notification', requireAuth, authController.testNotification);

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to a phone number
 *     description: Sends an OTP to the given phone number for verification.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             # either phone or email is required
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919999999999'
 *               email:
 *                 type: string
 *                 example: 'user@example.com'
 *     responses:
 *       200:
 *         description: Successfully sent OTP.
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Internal server error.
 */
router.post('/send-otp', authController.sendOtp);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP to a phone number or email
 *     description: Resends an OTP to the given phone number or email for verification.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919999999999'
 *               email:
 *                 type: string
 *                 example: 'user@example.com'
 *     responses:
 *       200:
 *         description: Successfully resent OTP.
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Internal server error.
 */
router.post('/resend-otp', authController.resendOtp);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and login
 *     description: Verifies the OTP sent to the phone number and returns user data with tokens.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             # phone or email should also be provided
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919999999999'
 *               email:
 *                 type: string
 *                 example: 'user@example.com'
 *               otp:
 *                 type: string
 *                 example: '123456'
 *     responses:
 *       200:
 *         description: Successfully verified OTP and logged in.
 *       400:
 *         description: Invalid OTP or Bad request.
 */
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
