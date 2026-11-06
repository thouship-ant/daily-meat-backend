// Tells the customer "your delivery partner has arrived" once, either:
//   - automatically, when the driver's location ping comes within ARRIVAL_RADIUS_METERS of the delivery address, or
//   - manually, when the driver taps "I've arrived" (covers old orders without coordinates and weak GPS).
const { Order } = require('../models');
const notificationService = require('./notificationService');

const ARRIVAL_RADIUS_METERS = Number(process.env.ARRIVAL_RADIUS_METERS) || 150;
const MEMORY_MS = 12 * 60 * 60 * 1000;

const notified = new Map(); // orderId -> time it was sent (never notify the same order twice)
const coords = new Map(); // orderId -> { userId, lat, lng, at } so a location ping does not hit the database

const prune = () => {
  const now = Date.now();
  for (const [id, at] of notified) if (now - at > MEMORY_MS) notified.delete(id);
  for (const [id, c] of coords) if (now - c.at > MEMORY_MS) coords.delete(id);
};

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
};

/** Sends the push once per order. Returns true if it was sent now. */
const notifyArrived = async (orderId, userId) => {
  const id = String(orderId);
  if (notified.has(id)) return false;
  notified.set(id, Date.now()); // set first, so two quick location pings cannot send it twice
  try {
    await notificationService.notifyUser({
      userId,
      title: 'Your delivery partner has arrived',
      body: 'Your Daily Meat order has reached your location. Please be ready to receive it.',
      data: { route: 'tracking', orderId: id },
      socketEvent: 'driverArrived',
    });
    return true;
  } catch (error) {
    notified.delete(id);
    throw error;
  }
};

/** Called for every driver location ping. Cheap: works from memory once an order's coordinates are known. */
const checkArrival = async (driverId, orderIds, latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (Math.random() < 0.02) prune();

  const unknown = orderIds.map(String).filter((id) => !notified.has(id) && !coords.has(id));
  if (unknown.length) {
    const rows = await Order.findAll({
      where: { id: unknown, driver_id: driverId, status: 'OUT_FOR_DELIVERY' },
      attributes: ['id', 'user_id', 'address_latitude', 'address_longitude'],
      raw: true,
    });
    const now = Date.now();
    for (const r of rows) {
      // orders without saved coordinates cannot be checked automatically (the driver can tap "I've arrived")
      coords.set(String(r.id), {
        userId: r.user_id,
        lat: r.address_latitude == null ? null : Number(r.address_latitude),
        lng: r.address_longitude == null ? null : Number(r.address_longitude),
        at: now,
      });
    }
  }

  for (const id of orderIds.map(String)) {
    const c = coords.get(id);
    if (!c || notified.has(id) || c.lat == null || c.lng == null) continue;
    if (distanceMeters(lat, lng, c.lat, c.lng) <= ARRIVAL_RADIUS_METERS) {
      await notifyArrived(id, c.userId).catch((e) => console.error('arrival notify error:', e.message));
    }
  }
};

module.exports = { checkArrival, notifyArrived, distanceMeters };
