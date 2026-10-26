const {
  createCoupon,
  getCouponDetailsForAdmin,
  listCouponsForAdmin,
  toggleCouponStatus,
  updateCoupon,
} = require('../services/couponService');

function parseCouponPayload(body) {
  return {
    code: body.code,
    title: body.title,
    description: body.description || null,
    discount_type: body.discount_type,
    discount_value: body.discount_value,
    max_discount_amount: body.max_discount_amount || null,
    min_order_amount: body.min_order_amount || null,
    max_order_amount: body.max_order_amount || null,
    start_at: body.start_at || null,
    end_at: body.end_at || null,
    is_active: body.is_active !== undefined ? body.is_active : true,
    visibility: body.visibility || 'public',
    audience_type: body.audience_type || 'all_users',
    total_redemption_limit: body.total_redemption_limit || null,
    per_user_limit: body.per_user_limit !== undefined ? body.per_user_limit : 1,
    auto_hide_after_use: body.auto_hide_after_use !== undefined ? body.auto_hide_after_use : true,
  };
}

class AdminCouponController {
  async create(req, res) {
    try {
      const payload = parseCouponPayload(req.body);
      if (!payload.code || !payload.title || !payload.discount_type || payload.discount_value === undefined) {
        return res.status(400).json({ error: 'code, title, discount_type, and discount_value are required.' });
      }

      const coupon = await createCoupon(payload);
      res.status(201).json({ data: coupon, message: 'Coupon created successfully.' });
    } catch (error) {
      console.error('Create coupon error:', error);
      res.status(500).json({ error: 'Failed to create coupon.' });
    }
  }

  async list(req, res) {
    try {
      const coupons = await listCouponsForAdmin(req.query);
      res.status(200).json({ data: coupons });
    } catch (error) {
      console.error('List coupons error:', error);
      res.status(500).json({ error: 'Failed to fetch coupons.' });
    }
  }

  async details(req, res) {
    try {
      const coupon = await getCouponDetailsForAdmin(req.params.id);
      if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
      res.status(200).json({ data: coupon });
    } catch (error) {
      console.error('Coupon details error:', error);
      res.status(500).json({ error: 'Failed to fetch coupon details.' });
    }
  }

  async update(req, res) {
    try {
      const coupon = await updateCoupon(req.params.id, parseCouponPayload(req.body));
      if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
      res.status(200).json({ data: coupon, message: 'Coupon updated successfully.' });
    } catch (error) {
      console.error('Update coupon error:', error);
      res.status(500).json({ error: 'Failed to update coupon.' });
    }
  }

  async updateStatus(req, res) {
    try {
      if (typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be a boolean.' });
      }

      const coupon = await toggleCouponStatus(req.params.id, req.body.is_active);
      if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
      res.status(200).json({ data: coupon, message: 'Coupon status updated successfully.' });
    } catch (error) {
      console.error('Update coupon status error:', error);
      res.status(500).json({ error: 'Failed to update coupon status.' });
    }
  }
}

module.exports = new AdminCouponController();
