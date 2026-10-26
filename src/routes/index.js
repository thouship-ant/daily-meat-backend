const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Health Check Route
router.get('/health', healthController.checkHealth);

const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

const addressRoutes = require('./addressRoutes');
router.use('/addresses', addressRoutes);

const shopSettingsRoutes = require('./shopSettingsRoutes');
router.use('/shop-settings', shopSettingsRoutes);

const catalogRoutes = require('./catalogRoutes');
router.use('/catalog', catalogRoutes);

const orderRoutes = require('./orderRoutes');
router.use('/orders', orderRoutes);

const couponRoutes = require('./couponRoutes');
router.use('/coupons', couponRoutes);

const paymentRoutes = require('./paymentRoutes');
router.use('/payments', paymentRoutes);

// Mount other routes here in the future
const adminRoutes = require('./adminRoutes');
router.use('/admin', adminRoutes);

const driverRoutes = require('./driverRoutes');
router.use('/driver', driverRoutes);

const helpRoutes = require('./help');
router.use('/help', helpRoutes);

const contactRoutes = require('./contactRoutes');
router.use('/contact', contactRoutes);


module.exports = router;
