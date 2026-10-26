const { Op } = require('sequelize');
const { Coupon, CouponRedemption, Order, sequelize } = require('../models');

const COUPON_ERROR = {
  NOT_FOUND: 'NOT_FOUND',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
  NOT_STARTED: 'NOT_STARTED',
  ORDER_TOO_LOW: 'ORDER_TOO_LOW',
  ORDER_TOO_HIGH: 'ORDER_TOO_HIGH',
  NOT_FOR_EXISTING_USERS: 'NOT_FOR_EXISTING_USERS',
  USED_ALREADY: 'USED_ALREADY',
  USER_LIMIT_REACHED: 'USER_LIMIT_REACHED',
  LIMIT_REACHED: 'LIMIT_REACHED',
};

function normalizeCode(code) {
  return code ? String(code).trim().toUpperCase() : null;
}

function toMoney(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function buildCouponState(coupon, totalRedemptions) {
  const now = new Date();
  const startAt = coupon.start_at ? new Date(coupon.start_at) : null;
  const endAt = coupon.end_at ? new Date(coupon.end_at) : null;
  const remainingRedemptions = coupon.total_redemption_limit != null
    ? Math.max(coupon.total_redemption_limit - totalRedemptions, 0)
    : null;

  let status = 'active';
  if (!coupon.is_active) status = 'inactive';
  else if (startAt && startAt > now) status = 'scheduled';
  else if (endAt && endAt < now) status = 'expired';
  else if (remainingRedemptions === 0) status = 'limit_reached';

  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    discount_type: coupon.discount_type,
    discount_value: toMoney(coupon.discount_value),
    max_discount_amount: coupon.max_discount_amount != null ? toMoney(coupon.max_discount_amount) : null,
    min_order_amount: coupon.min_order_amount != null ? toMoney(coupon.min_order_amount) : null,
    max_order_amount: coupon.max_order_amount != null ? toMoney(coupon.max_order_amount) : null,
    start_at: coupon.start_at,
    end_at: coupon.end_at,
    is_active: coupon.is_active,
    visibility: coupon.visibility,
    audience_type: coupon.audience_type,
    total_redemption_limit: coupon.total_redemption_limit,
    per_user_limit: coupon.per_user_limit,
    auto_hide_after_use: coupon.auto_hide_after_use,
    total_redemptions: totalRedemptions,
    remaining_redemptions: remainingRedemptions,
    status,
  };
}

async function getCouponWithCounts(couponId) {
  const coupon = await Coupon.findByPk(couponId);
  if (!coupon) return null;

  const totalRedemptions = await CouponRedemption.count({
    where: { coupon_id: coupon.id, status: 'used' }
  });

  return buildCouponState(coupon, totalRedemptions);
}

async function getCouponDetailsForAdmin(couponId) {
  const coupon = await Coupon.findByPk(couponId);
  if (!coupon) return null;

  const [totalRedemptions, totalDiscountGiven, recentOrders] = await Promise.all([
    CouponRedemption.count({ where: { coupon_id: coupon.id, status: 'used' } }),
    CouponRedemption.sum('discount_amount', { where: { coupon_id: coupon.id, status: 'used' } }),
    Order.findAll({
      where: { coupon_id: coupon.id },
      attributes: ['id', 'user_id', 'total_amount', 'discount_amount', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10,
    })
  ]);

  return {
    ...buildCouponState(coupon, totalRedemptions),
    total_discount_given: toMoney(totalDiscountGiven || 0),
    recent_orders: recentOrders,
  };
}

async function listCouponsForAdmin(filters = {}) {
  const where = {};

  if (filters.status === 'active') where.is_active = true;
  if (filters.status === 'inactive') where.is_active = false;
  if (filters.visibility) where.visibility = filters.visibility;
  if (filters.q) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${filters.q.trim()}%` } },
      { title: { [Op.iLike]: `%${filters.q.trim()}%` } }
    ];
  }

  const coupons = await Coupon.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });

  const rows = await Promise.all(coupons.map(async (coupon) => {
    const totalRedemptions = await CouponRedemption.count({
      where: { coupon_id: coupon.id, status: 'used' }
    });
    return buildCouponState(coupon, totalRedemptions);
  }));

  return rows;
}

async function countPreviousOrdersForUser(userId, transaction) {
  return Order.count({
    where: { user_id: userId },
    transaction,
  });
}

// Validates coupon against user history, order amount, and usage limits
async function validateCouponForUser({
  couponCode,
  couponId,
  userId,
  orderTotal,
  transaction,
  includeHidden = false,
}) {
  const normalizedCode = normalizeCode(couponCode);
  const where = couponId ? { id: couponId } : { code: normalizedCode };
  // Acquire row-level update lock inside transaction to prevent concurrent duplicate redemptions
  const coupon = await Coupon.findOne({
    where,
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!coupon) {
    return { valid: false, reason_code: COUPON_ERROR.NOT_FOUND, message: 'Coupon not found.' };
  }

  // Restrict hidden promo codes from general application
  if (!includeHidden && coupon.visibility !== 'public') {
    return { valid: false, reason_code: COUPON_ERROR.NOT_FOUND, message: 'Coupon not found.' };
  }

  const now = new Date();
  const total = toMoney(orderTotal);

  // Check active state & validity date range
  if (!coupon.is_active) {
    return { valid: false, reason_code: COUPON_ERROR.INACTIVE, message: 'Coupon is inactive.' };
  }
  if (coupon.start_at && new Date(coupon.start_at) > now) {
    return { valid: false, reason_code: COUPON_ERROR.NOT_STARTED, message: 'Coupon is not active yet.' };
  }
  if (coupon.end_at && new Date(coupon.end_at) < now) {
    return { valid: false, reason_code: COUPON_ERROR.EXPIRED, message: 'Coupon has expired.' };
  }

  const minOrderAmount = coupon.min_order_amount != null ? toMoney(coupon.min_order_amount) : null;
  const maxOrderAmount = coupon.max_order_amount != null ? toMoney(coupon.max_order_amount) : null;

  if (minOrderAmount != null && total < minOrderAmount) {
    return {
      valid: false,
      reason_code: COUPON_ERROR.ORDER_TOO_LOW,
      message: `Order total must be at least ${minOrderAmount}.`,
    };
  }

  if (maxOrderAmount != null && total > maxOrderAmount) {
    return {
      valid: false,
      reason_code: COUPON_ERROR.ORDER_TOO_HIGH,
      message: `Order total must be at most ${maxOrderAmount}.`,
    };
  }

  if (coupon.audience_type === 'new_users_only') {
    const priorOrders = await countPreviousOrdersForUser(userId, transaction);
    if (priorOrders > 0) {
      return {
        valid: false,
        reason_code: COUPON_ERROR.NOT_FOR_EXISTING_USERS,
        message: 'Coupon is only valid for new customers.',
      };
    }
  }

  const userRedemptions = await CouponRedemption.count({
    where: { coupon_id: coupon.id, user_id: userId, status: 'used' },
    transaction,
  });

  if (coupon.auto_hide_after_use && userRedemptions > 0) {
    return {
      valid: false,
      reason_code: COUPON_ERROR.USED_ALREADY,
      message: 'Coupon has already been used.',
    };
  }

  if (coupon.per_user_limit != null && userRedemptions >= coupon.per_user_limit) {
    return {
      valid: false,
      reason_code: COUPON_ERROR.USER_LIMIT_REACHED,
      message: 'User redemption limit reached for this coupon.',
    };
  }

  const totalRedemptions = await CouponRedemption.count({
    where: { coupon_id: coupon.id, status: 'used' },
    transaction,
  });

  if (coupon.total_redemption_limit != null && totalRedemptions >= coupon.total_redemption_limit) {
    return {
      valid: false,
      reason_code: COUPON_ERROR.LIMIT_REACHED,
      message: 'Coupon redemption limit reached.',
    };
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'flat') {
    discountAmount = toMoney(coupon.discount_value);
  } else {
    discountAmount = toMoney((total * toMoney(coupon.discount_value)) / 100);
    if (coupon.max_discount_amount != null) {
      discountAmount = Math.min(discountAmount, toMoney(coupon.max_discount_amount));
    }
  }

  discountAmount = Math.min(discountAmount, total);

  return {
    valid: true,
    coupon,
    discount_amount: discountAmount,
    payable_total: toMoney(total - discountAmount),
    reason_code: null,
    message: 'Coupon applied successfully.',
  };
}

async function createCouponRedemption({ couponId, userId, orderId, discountAmount, transaction }) {
  return CouponRedemption.create({
    coupon_id: couponId,
    user_id: userId,
    order_id: orderId,
    discount_amount: toMoney(discountAmount),
    status: 'used',
  }, { transaction });
}

async function getAvailableCouponsForUser({ userId, orderTotal }) {
  const coupons = await Coupon.findAll({
    where: {
      is_active: true,
      visibility: 'public',
    },
    order: [['createdAt', 'DESC']]
  });

  const results = [];
  for (const coupon of coupons) {
    const validation = await validateCouponForUser({
      couponId: coupon.id,
      userId,
      orderTotal,
      includeHidden: true,
    });

    if (validation.valid) {
      const totalRedemptions = await CouponRedemption.count({
        where: { coupon_id: coupon.id, status: 'used' }
      });
      results.push({
        ...buildCouponState(coupon, totalRedemptions),
        discount_amount: validation.discount_amount,
        payable_total: validation.payable_total,
      });
    }
  }

  return results;
}

async function createCoupon(data) {
  const payload = {
    ...data,
    code: normalizeCode(data.code),
  };
  const coupon = await Coupon.create(payload);
  return getCouponWithCounts(coupon.id);
}

async function updateCoupon(couponId, data) {
  const coupon = await Coupon.findByPk(couponId);
  if (!coupon) return null;

  const payload = { ...data };
  if (payload.code !== undefined) payload.code = normalizeCode(payload.code);

  await coupon.update(payload);
  return getCouponWithCounts(coupon.id);
}

async function toggleCouponStatus(couponId, isActive) {
  const coupon = await Coupon.findByPk(couponId);
  if (!coupon) return null;

  coupon.is_active = isActive;
  await coupon.save();
  return getCouponWithCounts(coupon.id);
}

module.exports = {
  COUPON_ERROR,
  buildCouponState,
  createCoupon,
  createCouponRedemption,
  getAvailableCouponsForUser,
  getCouponDetailsForAdmin,
  getCouponWithCounts,
  listCouponsForAdmin,
  normalizeCode,
  toMoney,
  toggleCouponStatus,
  updateCoupon,
  validateCouponForUser,
};
