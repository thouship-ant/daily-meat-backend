const jwt = require('jsonwebtoken');
const { User } = require('../models');
const userCache = require('../utils/userCache');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token using our secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the user to ensure they still exist and are valid. Served from a short in-memory cache when possible
    // (cleared whenever the user is changed), so most requests skip this database round trip.
    const authStart = Date.now();
    let user = null;
    const cached = userCache.get(decoded.id);
    if (cached) {
      user = User.build(cached, { isNewRecord: false, raw: true });
    } else {
      user = await User.findByPk(decoded.id);
      if (user) userCache.set(decoded.id, user.get({ plain: true }));
    }
    req._authMs = Date.now() - authStart;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Reject tokens issued before a forced logout of all devices
    if (user.tokens_valid_after && decoded.iat < Math.floor(user.tokens_valid_after.getTime() / 1000)) {
      return res.status(401).json({ error: 'Unauthorized: Session ended. Please log in again.', code: 'SESSION_ENDED' });
    }

    // Attach user object to the request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Token expired' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole
};
