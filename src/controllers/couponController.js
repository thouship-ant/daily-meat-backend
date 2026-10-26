const {
  getAvailableCouponsForUser,
  validateCouponForUser,
  toMoney,
} = require('../services/couponService');

class CouponController {
  async getAvailableCoupons(req, res) {
    try {
      const orderTotal = toMoney(req.query.orderTotal);
      const coupons = await getAvailableCouponsForUser({
        userId: req.user.id,
        orderTotal,
      });
      res.status(200).json({ data: coupons });
    } catch (error) {
      console.error('Get available coupons error:', error);
      res.status(500).json({ error: 'Failed to fetch available coupons.' });
    }
  }

  async validateCoupon(req, res) {
    try {
      const { couponCode, couponId, orderTotal } = req.body;
      if (!couponCode && !couponId) {
        return res.status(400).json({ error: 'couponCode or couponId is required.' });
      }

      const validation = await validateCouponForUser({
        couponCode,
        couponId,
        userId: req.user.id,
        orderTotal: toMoney(orderTotal),
        includeHidden: true,
      });

      if (!validation.valid) {
        return res.status(400).json({
          valid: false,
          reason_code: validation.reason_code,
          message: validation.message,
        });
      }

      res.status(200).json({
        valid: true,
        data: {
          coupon_id: validation.coupon.id,
          coupon_code: validation.coupon.code,
          title: validation.coupon.title,
          discount_amount: validation.discount_amount,
          payable_total: validation.payable_total,
        }
      });
    } catch (error) {
      console.error('Validate coupon error:', error);
      res.status(500).json({ error: 'Failed to validate coupon.' });
    }
  }
}

module.exports = new CouponController();
