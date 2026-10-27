const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'https://dailymeatserver.devmetsolutions.com',
        'http://localhost:5000',
        'http://localhost:3000',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  // ─── Auth Middleware ──────────────────────────────────────────────────────
  // Runs before the 'connection' event for every incoming socket.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.tokens_valid_after && decoded.iat < Math.floor(user.tokens_valid_after.getTime() / 1000)) {
        return next(new Error('Authentication error: Session ended'));
      }

      // Attach verified user to the socket for use in event handlers
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    console.log(`[Socket.io] Authenticated connection: ${socket.id} | User: ${userId} | Role: ${role}`);

    // Auto-join user's personal room on connect (no need for a separate event)
    socket.join(`user_${userId}`);
    if (role === 'ADMIN') {
      socket.join('admin_room');
      console.log(`[Socket.io] ${socket.id} joined admin_room`);
    }

    // Client/Admin subscribes to a specific order to track the driver
    socket.on('subscribeToOrder', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`[Socket.io] ${socket.id} subscribed to order_${orderId}`);
    });

    // Driver emits location update (only DRIVER role should do this)
    socket.on('driverLocationUpdate', (data) => {
      if (role !== 'DRIVER') return; // Ignore if not a driver
      const { orderId, latitude, longitude, speed, heading } = data;
      // Broadcast to all clients in the order's room (except the driver)
      socket.to(`order_${orderId}`).emit('orderLocationUpdate', {
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIo
};

